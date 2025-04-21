import { ChromeMessager } from "./utils/InternalMessager";
import { ActionOptions, AgentOptions, chatMessage, InternalMessageMetadata, InternalMessageV2, SendMessage } from "./utils/types";
import { sendTextMessage, getCurrentTab, getCurrentChat, getLastChatMessage } from "./utils/chrome_lib"

const BackChromeMessager = new ChromeMessager(AgentOptions.CONTENT, AgentOptions.BACKGROUND);

console.log("background loaded");

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
        const response = await sendTextMessage(tabId, "5513991570735@c.us", "oiiiiii, to testando");
        console.log("response found: ", response);
    })();
    return new Promise((resolve) => resolve(incomingMessage.content));
})

chrome.runtime.onMessage.addListener((internalMessage: InternalMessageV2, _sender, sendResponse) => {
    if (internalMessage.action !== ActionOptions.SEND_TEXT_MESSAGE) return;

    (async () => {
        const tabId = (await getCurrentTab()).id as number;
        const { chatId, message } = internalMessage.payload as SendMessage;
        const messageReturn = await sendTextMessage(tabId, chatId, message);
        // Cannot send complex objects
        sendResponse(messageReturn?.id);
    })();

    return true;
});

chrome.runtime.onMessage.addListener((internalMessage: InternalMessageV2, _sender, sendResponse) => {
    if (internalMessage.action !== ActionOptions.GET_CURRENT_CHAT) return;

    (async () => {
        const tabId = (await getCurrentTab()).id as number;
        const currentChatId = await getCurrentChat(tabId);
        // Cannot send complex objects
        sendResponse(currentChatId)
    })();

    return true;
});

chrome.runtime.onMessage.addListener((internalMessage: InternalMessageV2, _sender, sendResponse) => {
    if (internalMessage.action !== ActionOptions.GET_LAST_CHAT_MESSAGE) return;

    (async () => {
        const tabId = (await getCurrentTab()).id as number;
        const chatId = internalMessage.payload as string;
        const lastChatMessage = await getLastChatMessage(tabId, chatId);
        // Cannot send complex objects
        sendResponse(lastChatMessage)
    })();

    return true;
});
