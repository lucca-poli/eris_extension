import WPP from "@wppconnect/wa-js"
import { chatMessage } from "./types";

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
            console.log("trying to get chat");
            const activeChat = WhatsappLayer.chat.getActiveChat();
            if (activeChat?.isUser) return activeChat;
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
            // @ts-ignore
            const WhatsappLayer: typeof WPP = window.WPP;
            // @ts-ignore
            const chatMessages = WhatsappLayer.chat.getMessages(chatId, { count: 1 }) as WPP.chat.RawMessage[];
            const lastMessage = chatMessages[0];

            const lastChatMessage: chatMessage = {
                content: lastMessage.body as string,
                author: lastMessage.from?._serialized as string
            }
            return lastChatMessage;
        },
        args: [chatId],
        target: { tabId },
        world: 'MAIN',
    });
    return result;
}

export async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    const [tab] = await chrome.tabs.query(queryOptions);
    if (tab === undefined) throw new Error("Fatal: couldn't fetch current Tab.");
    return tab;
}
