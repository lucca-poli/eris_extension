import { AuditableMessage, GetMessagesOptions } from "./types";
import WPP from "@wppconnect/wa-js"

export function setInputbox(tabId: number, message: string) {
    chrome.scripting.executeScript({
        func: (message) => {
            // @ts-ignore
            const WhatsappLayer: typeof WPP = window.WPP;
            WhatsappLayer.chat.setInputText(message);
        },
        args: [message],
        target: { tabId },
        world: 'MAIN',
    });
}

export async function getUserId(tabId: number) {
    const [{ result }] = await chrome.scripting.executeScript({
        func: () => {
            // @ts-ignore
            const WhatsappLayer: typeof WPP = window.WPP;
            return WhatsappLayer.conn.getMyUserId();
        },
        target: { tabId },
        world: 'MAIN',
    });
    return result?._serialized;
}

export async function sendTextMessage(tabId: number, chatMessage: AuditableMessage) {
    const { chatId, content, hash } = chatMessage;
    const hashString = hash ? JSON.stringify(hash) : "";
    const [{ result }] = await chrome.scripting.executeScript({
        func: (chatId: string, content: string, hash?: string) => {
            // @ts-ignore
            const WhatsappLayer: typeof WPP = window.WPP;

            if (hash) return WhatsappLayer.chat.sendTextMessage(chatId, content, {
                // @ts-ignore: talvez de merda depois ignorar esse erro
                linkPreview: {
                    description: hash,
                }
            });
            return WhatsappLayer.chat.sendTextMessage(chatId, content);
        },
        args: [chatId, content as string, hashString],
        target: { tabId },
        world: 'MAIN',
    });
    return result;
}

export async function sendFileMessage(tabId: number, chatId: string, fileContent: string) {
    const [{ result }] = await chrome.scripting.executeScript({
        func: (chatId: string, fileContent: string) => {
            // @ts-ignore
            const WhatsappLayer: typeof WPP = window.WPP;

            const file = new File([fileContent], 'data.json', { type: 'application/json' });
            return WhatsappLayer.chat.sendFileMessage(chatId, file, { type: "document" });
        },
        args: [chatId, fileContent],
        target: { tabId },
        world: 'MAIN',
    });

    console.log("result is: ", result)
    return result;
}

export async function getChatMessages(tabId: number, chatId: string, options?: GetMessagesOptions) {
    if (options?.count === 0) return [];
    console.log("getMessages args: ");
    console.log("tabId: ", tabId);
    console.log("chatId: ", chatId);
    console.log("options: ", options);

    const [{ result }] = await chrome.scripting.executeScript({
        func: (chatId: string, options?: GetMessagesOptions) => {
            // Return a promise that we'll resolve in the injected context
            return new Promise((resolve) => {
                // @ts-ignore
                const WhatsappLayer: typeof WPP = window.WPP;

                WhatsappLayer.chat.getMessages(chatId, options)
                    .then((messages) => {
                        const auditableMessages = messages.map((message) => {
                            const auditableBlockString = message.description as string | undefined;
                            const hash = auditableBlockString ? JSON.parse(auditableBlockString) : undefined;
                            return {
                                content: message.body,
                                author: message.from?._serialized,
                                chatId: message.id?.remote._serialized,
                                hash,
                                messageId: message.id?._serialized,
                                timestamp: message.t
                            } as AuditableMessage;
                        })

                        resolve(auditableMessages);
                    })
                    .catch((error: any) => {
                        console.error("Error getting messages:", error);
                        resolve(null); // Resolve with null on error
                    });
            });
        },
        args: [chatId, options],
        target: { tabId },
        world: 'MAIN',
    });

    return result as AuditableMessage[];
}

