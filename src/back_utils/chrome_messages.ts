import { AuditableChatStateMachine } from "../utils/auditable_chat_state_machine";
import {
    AckMetadata,
    ActionOptions,
    AuditableChatMetadata,
    WhatsappMessage,
    AuditableMessageContent,
    AuditableMetadata,
    BlockState,
    GenerateWhatsappMessage,
    GetCommitedKeys,
    GetMessages,
    InternalMessage,
    SendFileMessage,
    MetadataOptions,
    AuditableControlMessage,
    MessagesToDelete,
    AuditableChatStates,
    InternalAuditableChatVariables,
    Signature
} from "../utils/types";
import {
    convertTextKey,
    generateAuditableSeed,
    generateBlock,
    generateCommitedMessage,
    generateSignature,
    getPrivateKey,
    getPublicKey,
    prf,
    verifySignature
} from "./auditable_chat";
import { deleteMessage, getChatMessages, getUserId, sendFileMessage, sendTextMessage, setInputbox } from "../utils/chrome_lib";
import { TabManager } from "./tab_manager";
import { verificationRoutine } from "../core_utils/verify";

async function processAuditableMetadata(tabId: number, chatId: string, whatsappMessage: WhatsappMessage, startingMessage: boolean, internalVariables: InternalAuditableChatVariables) {
    const auditableMetadata = whatsappMessage.metadata as AuditableMetadata;
    const auditableBlock = auditableMetadata?.block;
    if (!auditableBlock) throw new Error("Incoming auditable message has no block.");

    const userId = await AuditableChatStateMachine.getUserId();
    if (!userId) throw new Error("No user id found.");
    if (whatsappMessage.author === userId) return;

    await verificationRoutine(chatId, whatsappMessage, startingMessage);

    // Updating counterpart signature reference
    const counterpartSignature = {
        signature: auditableMetadata.signature,
        counter: auditableBlock.counter,
        blockHash: auditableBlock.hash
    };
    await updateSignature(chatId, counterpartSignature, false);

    const privateKey = await getPrivateKey();
    if (!privateKey) throw new Error("No private key found.");
    const signature = await generateSignature(privateKey, auditableBlock);

    // Updating own signature reference
    const ownSignature = {
        signature,
        counter: auditableBlock.counter,
        blockHash: auditableBlock.hash
    };
    await updateSignature(chatId, ownSignature, true);

    // Updating internal state
    await AuditableChatStateMachine.updateAuditableChatState(chatId, auditableBlock.hash);
    console.log("State after updating: ", await AuditableChatStateMachine.getAuditableChat(chatId));


    // Send ACK
    const publicKey = await getPublicKey();
    if (!publicKey) throw new Error("No public key found.");
    const exportablePublicKey = await crypto.subtle.exportKey("jwk", publicKey);
    const publicKeyToSend = startingMessage ? exportablePublicKey : undefined;
    const ackMetadata: AckMetadata = {
        kind: MetadataOptions.ACK,
        block: auditableBlock,
        signature,
        counterpartPublicKey: publicKeyToSend
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
}

// Responsabilidades: checar pela chave publica da outra parte e verificar os acks
async function processAckMetadata(chatId: string, whatsappMessage: WhatsappMessage, internalVariables: InternalAuditableChatVariables) {
    const ackMetadata = (whatsappMessage.metadata as AckMetadata);

    // Set public key from counterpart
    if (!internalVariables.counterpartPublicKey && ackMetadata.counterpartPublicKey) {
        internalVariables.counterpartPublicKey = ackMetadata.counterpartPublicKey;
        const auditableState = await AuditableChatStateMachine.getAuditableChat(chatId);
        if (!auditableState) throw new Error("Auditable chat has no state.");
        auditableState.internalAuditableChatVariables = internalVariables;
        await AuditableChatStateMachine.setAuditableChat(chatId, auditableState);
    }

    // Process counterpart signature
    if (!internalVariables.counterpartPublicKey) throw new Error("Counterpart public key not found.");
    console.log("Checking signature in ack.");
    const counterpartPublicKeyReadable = await convertTextKey(internalVariables.counterpartPublicKey);
    const signResult = await verifySignature(counterpartPublicKeyReadable, ackMetadata.signature, ackMetadata.block);
    if (!signResult) {
        console.error("ackMetadata:", ackMetadata);
        throw new Error("False signature!");
    }

    // Updating counterpart signature reference
    const counterpartSignature = {
        signature: ackMetadata.signature,
        counter: ackMetadata.block.counter,
        blockHash: ackMetadata.block.hash
    };
    await updateSignature(chatId, counterpartSignature, false);
}

export async function updateSignature(chatId: string, newSignature: Signature, ownSignature: boolean) {
    const currentAuditableState = await AuditableChatStateMachine.getAuditableChat(chatId);
    if (!currentAuditableState) throw new Error("No state found for this chat.");
    if (!currentAuditableState.internalAuditableChatVariables) throw new Error("No internal state found for this chat.");
    console.log("current state of signatures: ", currentAuditableState.internalAuditableChatVariables);

    const counterpartCounter = currentAuditableState.internalAuditableChatVariables.counterpartSignature?.counter || -1;
    const ownCounter = currentAuditableState.internalAuditableChatVariables.selfSignature?.counter || -1;

    if (ownSignature && newSignature.counter > ownCounter) {
        currentAuditableState.internalAuditableChatVariables.selfSignature = newSignature;
    }
    if (!ownSignature && newSignature.counter > counterpartCounter) {
        currentAuditableState.internalAuditableChatVariables.counterpartSignature = newSignature;
    }

    await AuditableChatStateMachine.setAuditableChat(chatId, currentAuditableState);
}

export function setupChromeListeners(tabManager: TabManager) {

    // Receive message routine
    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_MESSAGE) return;

        const { whatsappMessage, startingMessage } = internalMessage.payload as GenerateWhatsappMessage;
        const { chatId } = whatsappMessage;
        const metadataIsAuditable = whatsappMessage.metadata?.kind === MetadataOptions.AUDITABLE;
        const metadataIsAck = whatsappMessage.metadata?.kind === MetadataOptions.ACK;
        const tabId = tabManager.getWhatsappTab().id as number;
        console.log("IncomingMessage: ", whatsappMessage);

        (async () => {
            const auditableState = await AuditableChatStateMachine.getAuditableChat(chatId);
            if (!auditableState) throw new Error("Auditable chat is not present.");

            // Separar em processamento de mensagem de chat auditavel e de ack
            const stateIsWaitingAck = auditableState.currentState === AuditableChatStates.WAITING_ACK;
            const messageIsFromPartner = whatsappMessage.author === whatsappMessage.chatId;
            const chatHasDisagree = stateIsWaitingAck && metadataIsAuditable && messageIsFromPartner;
            if (metadataIsAuditable && !chatHasDisagree) {
                const internalVariables = auditableState?.internalAuditableChatVariables;
                if (!internalVariables) throw new Error("Auditable chat has no internal variables.");
                await processAuditableMetadata(tabId, chatId, whatsappMessage, startingMessage, internalVariables);
            } else if (metadataIsAck) {
                const internalVariables = auditableState?.internalAuditableChatVariables;
                if (!internalVariables) throw new Error("Auditable chat has no internal variables.");
                await processAckMetadata(chatId, whatsappMessage, internalVariables);
            };

        })();
    });

    // Send message routine
    chrome.runtime.onMessage.addListener(async (internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.GENERATE_AND_SEND_BLOCK) return;

        const { whatsappMessage, startingMessage } = internalMessage.payload as GenerateWhatsappMessage;
        const chatId = whatsappMessage.chatId;
        const tabId = tabManager.getWhatsappTab().id as number;
        const privateKey = await getPrivateKey();
        if (!privateKey) throw new Error("No private key found.");

        if (startingMessage) {
            // User envia mensagem de aceite
            const seed = await generateAuditableSeed(chatId)
            console.log("Seed created: ", seed)
            const currentAuditableState = await AuditableChatStateMachine.getAuditableChat(chatId);
            if (!currentAuditableState) throw new Error("No auditable chat found.");
            const internalState = await AuditableChatStateMachine.assembleAuditableChatStart(seed);
            currentAuditableState.internalAuditableChatVariables = internalState;
            await AuditableChatStateMachine.setAuditableChat(chatId, currentAuditableState);
            if (!internalState) throw new Error("Chat has no state");

            const auditableMetadata: AuditableChatMetadata = {
                timestamp: new Date().toISOString().split('T')[0]
            }

            const initChatState: BlockState = {
                hash: internalState?.previousHash,
                counter: internalState?.counter
            }

            const commitedMessage = await generateCommitedMessage(chatId, auditableMetadata, initChatState.counter);
            const initialBlock = await generateBlock(commitedMessage, initChatState);

            const publicKey = await getPublicKey();
            if (!publicKey) throw new Error("No public key found.");
            const exportablePublicKey = await crypto.subtle.exportKey("jwk", publicKey);
            const signature = await generateSignature(privateKey, initialBlock);

            whatsappMessage.metadata = {
                kind: MetadataOptions.AUDITABLE,
                block: initialBlock,
                counterpartPublicKey: exportablePublicKey,
                signature,
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

            const commitedMessage = await generateCommitedMessage(chatId, auditableContent, previousBlockState.counter);
            const auditableBlock = await generateBlock(commitedMessage, previousBlockState);
            const signature = await generateSignature(privateKey, auditableBlock);
            console.log("Signing on: ", auditableBlock);
            console.log("Resulting signature: ", signature);

            whatsappMessage.metadata = {
                kind: MetadataOptions.AUDITABLE,
                block: auditableBlock,
                signature,
                seed: undefined
            } as AuditableMetadata;
        }

        const updatedHash = whatsappMessage.metadata.block.hash;
        await AuditableChatStateMachine.updateAuditableChatState(chatId, updatedHash);

        // Updating own signature reference
        const auditableMetadata = whatsappMessage.metadata as AuditableMetadata;
        const ownSignature = {
            signature: auditableMetadata.signature,
            counter: auditableMetadata.block.counter,
            blockHash: auditableMetadata.block.hash
        };
        await updateSignature(chatId, ownSignature, true);

        const returnStatus = await sendTextMessage(tabId, whatsappMessage);
        console.log("Message sent: ", returnStatus);
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
                return prf({
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

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.DELETE_MESSAGES) return;

        const tabId = tabManager.getWhatsappTab().id as number;
        const { messages, chatId } = internalMessage.payload as MessagesToDelete;
        messages.forEach(async (id) => {
            await deleteMessage(tabId, chatId, id);
        });
    });
}

