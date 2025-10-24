import { getPublicKey } from "../back_utils/auditable_chat";
import { fetchLastMessagesFront } from "../core_utils/data_aquisition";
import { ActionOptions, AuditableBlock, AuditableControlMessage, WhatsappMessage, GetCommitedKeys, InternalMessage, SendFileMessage, MetadataOptions, AuditableMetadata, GetMessagesOptions, AgreeToDisagreeMetadata, PrivateLog, AuditableMessageContent, AuditableChatMetadata } from "./types";
import { AuditableChatStateMachine } from "./auditable_chat_state_machine";

async function getAuditableChat(chatId: string, chatSeed: string, finishMessageId: string, initialGuess: number): Promise<WhatsappMessage[]> {
    let numMessagesToSearch = initialGuess;
    let whatsappMessages: WhatsappMessage[] = [];
    let initialAuditableMessage: WhatsappMessage | undefined = undefined;

    // Search until finding the initial message
    while (!initialAuditableMessage) {
        const getMessagesOptions: GetMessagesOptions = {
            count: numMessagesToSearch,
            id: finishMessageId,
            direction: "before"
        };
        whatsappMessages = await fetchLastMessagesFront(chatId, getMessagesOptions);

        const agreeToDisagreeResolvesLenght: number = whatsappMessages
            .filter((whatsappMessage) => whatsappMessage.content === AuditableControlMessage.AGREE_TO_DISAGREE_RESOLVE && whatsappMessage.metadata?.kind === MetadataOptions.AGREE_TO_DISAGREE)
            .map((whatsappMessage) => whatsappMessage.metadata as AgreeToDisagreeMetadata)
            .filter((agreeToDisagree, index, arr) => {
                const hashArray = arr.map((agreeToDisagreeInner) => agreeToDisagreeInner.block.hash);
                return hashArray.indexOf(agreeToDisagree.block.hash) === index;
            })
            .map((agreeToDisagree) => agreeToDisagree.block.counter - (agreeToDisagree.disagreeRoot.metadata as AuditableMetadata).block.counter)
            .reduce((currentValue, acc) => currentValue + acc, 0);
        numMessagesToSearch += agreeToDisagreeResolvesLenght;

        initialAuditableMessage = whatsappMessages
            .filter((whatsappMessage) => whatsappMessage.metadata?.kind === MetadataOptions.AUDITABLE)
            .find((auditableMessage) => (auditableMessage.metadata as AuditableMetadata).block.counter === 0);
        if (initialAuditableMessage && (initialAuditableMessage.metadata as AuditableMetadata).seed !== chatSeed)
            throw new Error("Found initial message from another chat");
    }

    const initialIndex = whatsappMessages.findIndex((whatsappMessage) => {
        if (whatsappMessage.metadata?.kind === MetadataOptions.AUDITABLE) {
            return (whatsappMessage.metadata as AuditableMetadata).block.hash === (initialAuditableMessage.metadata as AuditableMetadata).block.hash;
        }
        return false;
    });
    if (initialIndex === -1) throw new Error("Couldnt find starting message.");
    const fullChat = whatsappMessages.slice(0, initialIndex + 1);
    const chatWithoutAcks = fullChat
        .filter((auditableMessage) => auditableMessage.metadata?.kind === MetadataOptions.AUDITABLE || auditableMessage.metadata?.kind === MetadataOptions.AGREE_TO_DISAGREE);
    // Removed AgreeToDisagree intermediate attempts
    const cleanChat = chatWithoutAcks.filter((auditableMessage, index, arr) => {
        const isMetadataAuditable = auditableMessage.metadata?.kind === MetadataOptions.AUDITABLE;
        const isMetadataAgreeToDisagree = auditableMessage.metadata?.kind === MetadataOptions.AGREE_TO_DISAGREE;
        let isUniqueAgreeToDisagreeResolve: boolean = false;
        if (isMetadataAgreeToDisagree && auditableMessage.content === AuditableControlMessage.AGREE_TO_DISAGREE_RESOLVE) {
            const hashArray = arr.map((auditableMessageInner) => (auditableMessageInner.metadata as AgreeToDisagreeMetadata).block.hash);
            isUniqueAgreeToDisagreeResolve = hashArray.indexOf((auditableMessage.metadata as AgreeToDisagreeMetadata).block.hash) === index;
        }
        return isMetadataAuditable || isUniqueAgreeToDisagreeResolve;
    })

    return cleanChat.reverse();
}


export async function finishingAuditableChatRoutine(chatId: string, chatSeed: string, finishMessageId: string, initialGuess: number) {
    const auditableMessages = await getAuditableChat(chatId, chatSeed, finishMessageId, initialGuess);
    console.log("Auditable Messages: ", auditableMessages);
    const auditableState = await AuditableChatStateMachine.getAuditableChat(chatId);
    const userId = await AuditableChatStateMachine.getUserId();
    if (!userId) throw new Error("Couldnt find userID");

    const publicLogs = auditableMessages.map((message) => (message.metadata as AuditableMetadata)?.block as AuditableBlock);
    const ownPublicKey = await getPublicKey();
    if (!ownPublicKey) throw new Error("Couldnt find own public key.");
    const ownPublicKeyReadable = await crypto.subtle.exportKey('jwk', ownPublicKey);
    const counterpartPublicKey = auditableState?.internalAuditableChatVariables?.counterpartPublicKey;
    if (!counterpartPublicKey) throw new Error("Couldnt find counterpart public key.");
    const publicKeys = {
        [userId]: ownPublicKeyReadable,
        [chatId]: counterpartPublicKey
    };
    if (!auditableState.internalAuditableChatVariables?.selfSignature) throw new Error("Own signature not found.");
    if (!auditableState.internalAuditableChatVariables.counterpartSignature) throw new Error("Counterpart signature not found");
    const lastSignatures = {
        [userId]: auditableState.internalAuditableChatVariables.selfSignature,
        [chatId]: auditableState.internalAuditableChatVariables.counterpartSignature
    };
    const publicJson = JSON.stringify({
        logs: publicLogs,
        lastSignatures,
        publicKeys
    });

    console.log("Public Logs: ", publicLogs);
    const counters = publicLogs.map((hashblock) => hashblock.counter);
    console.log("counters: ", counters);
    const commitedKeys: string[] = await chrome.runtime.sendMessage({
        action: ActionOptions.GET_COMMITED_KEYS,
        payload: { counters, seed: chatSeed } as GetCommitedKeys
    } as InternalMessage);
    console.log("commited keys: ", commitedKeys)

    const initialHash = "0000000000000000000000000000000000000000000000000000000000000000";
    const initialBlock = auditableMessages.filter((auditableMessage) => (auditableMessage.metadata as AuditableMetadata).block.previousHash === initialHash);
    if (initialBlock.length !== 1) throw new Error("There should be only one initial block.");
    const initialTimestamp = (initialBlock[0].metadata as AuditableMetadata).initialTimestamp;
    if (!initialTimestamp) throw new Error("No initial timestamp found in initial block.");
    const initialLog: PrivateLog[] = [{
        content: { timestamp: initialTimestamp } as AuditableChatMetadata,
        commitedKey: commitedKeys[0],
        counter: 0
    }];
    const privateLogs: PrivateLog[] = auditableMessages.map((message, index) => {
        const commitedKey = commitedKeys[index]
        if (!commitedKey) {
            console.error(message);
            throw new Error("No counter for HashBlock.");
        }
        const content: AuditableMessageContent = {
            message: message.content as string,
            author: message.author,
        };
        return {
            commitedKey,
            counter: counters[index],
            content
        };
    });


    const privateJson = JSON.stringify({
        logs: initialLog.concat(privateLogs.slice(1))
    });

    const dateToday = new Date().toISOString();
    await chrome.runtime.sendMessage({
        action: ActionOptions.SEND_FILE_MESSAGE,
        payload: {
            chatId,
            fileContent: privateJson,
            fileName: `private_logs_${dateToday}.json`
        } as SendFileMessage
    } as InternalMessage);

    await chrome.runtime.sendMessage({
        action: ActionOptions.SEND_FILE_MESSAGE,
        payload: {
            chatId,
            fileContent: publicJson,
            fileName: `public_logs_${dateToday}.json`
        } as SendFileMessage
    } as InternalMessage);
}
