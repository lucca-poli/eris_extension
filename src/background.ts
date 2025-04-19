import { ChromeMessager } from "./utils/InternalMessager";
import { ActionOptions, AgentOptions, chatMessage, InternalMessageMetadata } from "./utils/types";
import "@wppconnect/wa-js"
import WPP from "@wppconnect/wa-js"

// @ts-ignore
const WhatsappLayer: typeof WPP = window.WPP;

const BackChromeMessager = new ChromeMessager(AgentOptions.CONTENT, AgentOptions.BACKGROUND);

console.log("background loaded");
let tabId: number;
(async () => {
    // @ts-ignore
    tabId = await chrome.tabs.query({ active: true, currentWindow: true })[0].id;
    console.log("this is tab", tabId)
})();

const lastMessageBackground: InternalMessageMetadata = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.BACKGROUND,
    action: ActionOptions.SEND_MESSAGE_TO_BACKGROUND,
}
BackChromeMessager.listenMessage(lastMessageBackground, (incomingMessage: chatMessage) => {
    console.log("payload arrived: ", incomingMessage);
    (async () => {
        const tabId = (await getCurrentTab()).id as number;
        console.log("this is tab", tabId)
        const func = await injectScript(tabId, (name: string));
        console.log("variable found: ", v);
    })();
    return new Promise((resolve) => resolve(incomingMessage.content));
})

async function sendTextMessage(chatId: string, message: string) {
    const func = (chatId: string, message: string) => {
        WhatsappLayer.chat.sendTextMessage(chatId, message);
    };
    const [{ result }] = await chrome.scripting.executeScript({
        // @ts-ignore
        func: func(chatId, message),
        args: [chatId, message],
        target: {
            tabId: (await getCurrentTab()).id as number
        },
        world: 'MAIN',
    });
    const scripts = await chrome.scripting.getRegisteredContentScripts();
    const scriptIds = scripts.map(script => script.id);
    chrome.scripting.unregisterContentScripts({ ids: scriptIds });
    return result;
}

async function getCurrentTab(): Promise<chrome.tabs.Tab> {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    const [tab] = await chrome.tabs.query(queryOptions);
    if (tab === undefined) throw new Error("Fatal: couldn't fetch current Tab.");
    return tab;
}

