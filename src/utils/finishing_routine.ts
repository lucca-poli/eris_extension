import { ActionOptions, AuditableBlock, AuditableControlMessage, AuditableMessage, AuditableMessageMetadataSchema, GetCommitedKeys, GetMessages, InternalMessage, SendFileMessage } from "./types";

export async function finishingAuditableChatRoutine(chatId: string, chatSeed: string, finishMessageId: string, scan_range: number) {

    const getMessages: GetMessages = {
        chatId,
        options: {
            // Getting double the amount to avoid problems with acks
            count: scan_range,
            direction: "before",
            id: finishMessageId
        }
    }
    const auditableMessagesRaw: AuditableMessage[] = await chrome.runtime.sendMessage({
        action: ActionOptions.GET_MESSAGES,
        payload: getMessages
    } as InternalMessage);
    console.log("Auditable Messages raw: ", auditableMessagesRaw);

    // 1. Tirar as mensagens antes da inicial
    const firstStartingMessageIndex = auditableMessagesRaw.reverse().findIndex((auditableMessage) =>
        (auditableMessage.content === AuditableControlMessage.ACCEPT && auditableMessage.metadata?.block.counter === 0)
    );
    if (firstStartingMessageIndex === -1) throw new Error("Couldnt find starting message.");
    const currentAuditableMessages = auditableMessagesRaw.slice(0, firstStartingMessageIndex + 1).reverse();
    // 2. Tirar as mensagens de ACK
    const auditableMessages = currentAuditableMessages.filter((auditableMessage) => {
        const auditableMetadata = AuditableMessageMetadataSchema.safeParse(auditableMessage.metadata);
        return auditableMetadata.success;
    });

    console.log("Auditable Messages: ", auditableMessages);

    const publicLogs = auditableMessages.map((message) => message.metadata?.block as AuditableBlock);
    const publicJson = JSON.stringify(publicLogs);

    console.log("Public Logs: ", publicLogs);
    const counters = publicLogs.map((hashblock) => hashblock.counter);
    console.log("counters: ", counters);
    const commitedKeys: string[] = await chrome.runtime.sendMessage({
        action: ActionOptions.GET_COMMITED_KEYS,
        payload: { counters, seed: chatSeed } as GetCommitedKeys
    } as InternalMessage);
    console.log("commited keys: ", commitedKeys)

    const privateLogs = auditableMessages.map((message, index) => {
        const commitedKey = commitedKeys[index]
        if (!commitedKey) {
            console.error(message);
            throw new Error("No counter for HashBlock.");
        }
        return {
            content: message.content as string,
            author: message.author,
            commitedKey,
            counter: counters[index]
        };
    });
    const privateJson = JSON.stringify({
        initialCommitedKey: commitedKeys[0],
        logMessages: privateLogs.slice(1)
    });

    const dateToday = new Date().toISOString().split('T')[0];

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
