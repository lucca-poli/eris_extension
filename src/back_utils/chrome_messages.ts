import { AuditableChatStateMachine } from "../utils/auditable_chat_state_machine";
import { AckMetadata, ActionOptions, AuditableChatMetadata, WhatsappMessage, AuditableMessageContent, AuditableMetadata, BlockState, GenerateWhatsappMessage, GetCommitedKeys, GetMessages, InternalMessage, SendFileMessage, MetadataOptions, AuditableControlMessage } from "../utils/types";
import { AuditableChat } from "./auditable_chat";
import { deleteMessage, getChatMessages, getUserId, sendFileMessage, sendTextMessage, setInputbox } from "../utils/chrome_lib";
import { TabManager } from "./tab_manager";

// Fazer que função que processa ACK e função que processa mensagem auditavel e botar pra rodar uma ou outra dependendo do conteudo da mensagem auditavel
async function verificationRoutine(chatId: string, whatsappMessage: WhatsappMessage, startingMessage: boolean) {
    const metadataIsAuditable = whatsappMessage.metadata?.kind === MetadataOptions.AUDITABLE;
    if (!metadataIsAuditable) throw new Error("Incoming auditable message has no block.");
    const auditableBlock = (whatsappMessage.metadata as AuditableMetadata)?.block;

    // Verifying incomingMessage content
    const auditableState = (
        await AuditableChatStateMachine.getAuditableChat(chatId)
    )?.internalAuditableChatVariables;
    if (!auditableState) throw new Error("Auditable chat has no state.");
    const { previousHash, counter } = auditableState;
    console.log("auditable state: ", auditableState)

    // Verifying counter - Todos os erros a seguir deveriam encerrar a conversa auditavel
    if (auditableBlock.counter < counter) throw new Error("Invalid message counter, ending current auditable chat!");
    if (auditableBlock.counter > counter) throw new Error("Incoming message out of order.");

    // Verifying hashes
    const generatedBlock = await AuditableChat.generateBlock(auditableBlock.commitedMessage, {
        counter: auditableBlock.counter,
        hash: auditableBlock.previousHash
    });
    console.log("generated block from incoming message: ", generatedBlock);
    if (generatedBlock.hash !== auditableBlock.hash) throw new Error("Hash created from block items is diferent from incoming hash.");
    if (auditableBlock.previousHash !== previousHash) throw new Error("Previous hash from incoming message and internal state differs.");

    // Verifying commitedMessage
    const messageToProcess: AuditableMessageContent | AuditableChatMetadata = startingMessage ?
        {
            timestamp: new Date().toISOString().split('T')[0]
        } :
        {
            content: whatsappMessage.content as string,
            author: whatsappMessage.author
        };
    const commitedMessage = await AuditableChat.generateCommitedMessage(chatId, messageToProcess, auditableBlock.counter);
    if (commitedMessage !== auditableBlock.commitedMessage) throw new Error("Commited message created from block items is diferent from incoming commited message.")
}

export function setupChromeListeners(tabManager: TabManager) {

    // Receive message routine
    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_MESSAGE) return;

        const { whatsappMessage, startingMessage } = internalMessage.payload as GenerateWhatsappMessage;
        const { chatId } = whatsappMessage;
        const metadataIsAuditable = whatsappMessage.metadata?.kind === MetadataOptions.AUDITABLE;
        if (!metadataIsAuditable) throw new Error("Incoming message is not auditable.");
        const tabId = tabManager.getWhatsappTab().id as number;
        const auditableBlock = (whatsappMessage.metadata as AuditableMetadata)?.block;
        if (!auditableBlock) throw new Error("Incoming auditable message has no block.");
        console.log("IncomingMessage: ", whatsappMessage);

        (async () => {
            const userId = await AuditableChatStateMachine.getUserId();
            if (!userId) throw new Error("No user id found.");
            if (whatsappMessage.author === userId) return;

            const auditableState = (
                await AuditableChatStateMachine.getAuditableChat(chatId)
            )?.internalAuditableChatVariables;
            if (!auditableState) throw new Error("Auditable chat has no state.");
            const { counter } = auditableState;

            await verificationRoutine(chatId, whatsappMessage, startingMessage);

            // Updating internal state
            await AuditableChatStateMachine.updateAuditableChatState(chatId, auditableBlock.hash);
            console.log("State after updating: ", await AuditableChatStateMachine.getAuditableChat(chatId));

            // Send ACK
            const ackMetadata: AckMetadata = {
                kind: MetadataOptions.ACK,
                counter,
                blockHash: auditableBlock.hash,
            };
            const messageToSend: WhatsappMessage = {
                author: userId,
                chatId,
                metadata: ackMetadata,
                content: AuditableControlMessage.ACK
            }
            console.log("Ack sent: ", ackMetadata);
            const ackResponse = await sendTextMessage(tabId, messageToSend);
            if (!ackResponse) throw new Error("Problem in sending ACK.");
            await deleteMessage(tabId, chatId, ackResponse.id);
            console.log("Ack message deleted.")

            console.log("State after ack sent: ", await AuditableChatStateMachine.getAuditableChat(chatId));
        })();
    });

    // Send message routine
    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.GENERATE_AND_SEND_BLOCK) return;

        const { whatsappMessage, startingMessage } = internalMessage.payload as GenerateWhatsappMessage;
        const chatId = whatsappMessage.chatId;
        const tabId = tabManager.getWhatsappTab().id as number;

        (async () => {
            if (startingMessage) {
                // User envia mensagem de aceite
                const seed = await AuditableChat.generateAuditableSeed(chatId)
                console.log("Seed created: ", seed)
                const auditableState = await AuditableChatStateMachine.setAuditableChatStart(chatId, seed);
                if (!auditableState.internalAuditableChatVariables) throw new Error("Chat has no state");

                const auditableMetadata: AuditableChatMetadata = {
                    timestamp: new Date().toISOString().split('T')[0]
                }

                const initChatState: BlockState = {
                    hash: auditableState.internalAuditableChatVariables?.previousHash,
                    counter: auditableState.internalAuditableChatVariables?.counter
                }

                const commitedMessage = await AuditableChat.generateCommitedMessage(chatId, auditableMetadata, initChatState.counter);

                whatsappMessage.metadata = {
                    kind: MetadataOptions.AUDITABLE,
                    block: await AuditableChat.generateBlock(commitedMessage, initChatState),
                    seed
                } as AuditableMetadata;
            } else {
                // User envia mensagem normal com hashchain
                const auditableContent: AuditableMessageContent = {
                    content: whatsappMessage.content as string,
                    author: whatsappMessage.author
                }

                const auditableChat = await AuditableChatStateMachine.getAuditableChat(chatId);
                console.log("Current State before sending message: ", auditableChat);
                if (!auditableChat) throw new Error("No auditable chat found.");
                const internalState = auditableChat.internalAuditableChatVariables;
                if (!internalState) throw new Error("No chat reference found.");

                const previousBlockState: BlockState = {
                    hash: internalState.previousHash,
                    counter: internalState.counter
                };

                const commitedMessage = await AuditableChat.generateCommitedMessage(chatId, auditableContent, previousBlockState.counter);

                whatsappMessage.metadata = {
                    kind: MetadataOptions.AUDITABLE,
                    block: await AuditableChat.generateBlock(commitedMessage, previousBlockState),
                    seed: undefined
                } as AuditableMetadata;
            }

            await sendTextMessage(tabId, whatsappMessage);

            const updatedHash = whatsappMessage.metadata.block.hash;
            await AuditableChatStateMachine.updateAuditableChatState(chatId, updatedHash);
        })();
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.SET_INPUT_BOX) return;

        const message = internalMessage.payload as string;
        const tabId = tabManager.getWhatsappTab().id as number;
        setInputbox(tabId, message);
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage, _sender, sendResponse) => {
        if (internalMessage.action !== ActionOptions.GET_MESSAGES) return;

        const { chatId, options } = internalMessage.payload as GetMessages;
        const tabId = tabManager.getWhatsappTab().id as number;

        (async () => {
            const messages = await getChatMessages(tabId, chatId, options);
            //
            // Cannot send complex objects
            sendResponse(messages);
        })();

        return true;
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage, _sender, sendResponse) => {
        if (internalMessage.action !== ActionOptions.GET_COMMITED_KEYS) return;

        const { seed, counters } = internalMessage.payload as GetCommitedKeys;

        (async () => {
            const keys = counters.map(async (counter) => {
                return AuditableChat.prf({
                    seed,
                    counter
                })
            });
            const commitedKeys = await Promise.all(keys);
            // Cannot send complex objects
            sendResponse(commitedKeys);
        })();

        return true;
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage, _sender, sendResponse) => {
        if (internalMessage.action !== ActionOptions.SEND_TEXT_MESSAGE) return;

        (async () => {
            const tabId = tabManager.getWhatsappTab().id as number;
            const messageReturn = await sendTextMessage(tabId, internalMessage.payload as WhatsappMessage);
            // Cannot send complex objects
            sendResponse(messageReturn?.id);
        })();

        return true;
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.SEND_FILE_MESSAGE) return;

        (async () => {
            const tabId = tabManager.getWhatsappTab().id as number;
            const { chatId, fileContent, fileName } = internalMessage.payload as SendFileMessage;
            const result = await sendFileMessage(tabId, chatId, fileContent, fileName);
            if (!result) throw new Error("Could not send file.");
        })();
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_CHAT) return;

        (async () => {
            const tabId = tabManager.getWhatsappTab().id as number;
            const userId = await getUserId(tabId);
            const oldUserId = await AuditableChatStateMachine.getUserId();
            if (userId && userId !== oldUserId) AuditableChatStateMachine.setUserId(userId);
        })();
    });
}

