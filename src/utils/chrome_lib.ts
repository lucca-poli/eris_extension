import { AuditableMessage, ChatMessage } from "./types";
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

export async function getLastChatMessage(tabId: number, chatId: string) {
    const [{ result }] = await chrome.scripting.executeScript({
        func: (chatId) => {
            // Return a promise that we'll resolve in the injected context
            return new Promise((resolve) => {
                // @ts-ignore
                const WhatsappLayer: typeof WPP = window.WPP;

                WhatsappLayer.chat.getMessages(chatId, { count: 1 })
                    .then((messages) => {
                        const lastMessage = messages[0];

                        if (!lastMessage) {
                            resolve(null);
                            return;
                        }

                        const lastChatMessage = {
                            content: lastMessage.body,
                            author: lastMessage.from?._serialized
                        } as ChatMessage;

                        resolve(lastChatMessage);
                    })
                    .catch((error: any) => {
                        console.error("Error getting messages:", error);
                        resolve(null); // Resolve with null on error
                    });
            });
        },
        args: [chatId],
        target: { tabId },
        world: 'MAIN',
    });

    return result as ChatMessage | null;
}

export async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    const [tab] = await chrome.tabs.query(queryOptions);
    if (tab === undefined) throw new Error("Fatal: couldn't fetch current Tab.");
    return tab;
}

