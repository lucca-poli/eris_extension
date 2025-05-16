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

export async function sendTextMessage(tabId: number, chatMessage: AuditableMessage) {
    const { chatId, content } = chatMessage;
    let { hash } = chatMessage;
    if (!hash) hash = '';
    const [{ result }] = await chrome.scripting.executeScript({
        func: (chatId, content, hash) => {
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
        args: [chatId, content, hash],
        target: { tabId },
        world: 'MAIN',
    });
    return result;
}

// Por padrão pega a última mensagem do chat e a direção é after
export async function getChatMessages(tabId: number, chatId: string, options: GetMessagesOptions) {
    const [{ result }] = await chrome.scripting.executeScript({
        func: (chatId: string, options: GetMessagesOptions) => {
            // Return a promise that we'll resolve in the injected context
            return new Promise((resolve) => {
                // @ts-ignore
                const WhatsappLayer: typeof WPP = window.WPP;

                WhatsappLayer.chat.getMessages(chatId, options)
                    .then((messages) => {
                        const auditableMessages = messages.map((message) => {
                            return {
                                content: message.body,
                                authorIsMe: message.id?.fromMe,
                                chatId: message.id?.remote._serialized,
                                hash: message.description,
                                messageId: message.id?._serialized
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

