import { ChatMessage } from "./types";
import WPP from "@wppconnect/wa-js"

export async function sendTextMessage(tabId: number, chatId: string, message: string) {
    const [{ result }] = await chrome.scripting.executeScript({
        func: (chatId, message) => {
            // @ts-ignore
            const WhatsappLayer: typeof WPP = window.WPP;
            return WhatsappLayer.chat.sendTextMessage(chatId, message);
        },
        args: [chatId, message],
        target: { tabId },
        world: 'MAIN',
    });
    return result;
}

export async function getCurrentChat(tabId: number) {
    const [{ result }] = await chrome.scripting.executeScript({
        func: () => {
            // @ts-ignore
            const WhatsappLayer: typeof WPP = window.WPP;
            const activeChat = WhatsappLayer.chat.getActiveChat();
            if (activeChat?.isUser) return activeChat?.id._serialized;
            return undefined;
        },
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
                        console.log("Got messages:", messages);
                        const lastMessage = messages[0];

                        if (!lastMessage) {
                            console.log("No messages found");
                            resolve(null);
                            return;
                        }

                        console.log("Last message body:", lastMessage.body);
                        console.log("Last message from:", lastMessage.from?._serialized);

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

