import { ChromeMessager } from "./utils/InternalMessager";
import { ActionOptions, AgentOptions, chatMessage, InternalMessageMetadata } from "./utils/types";

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
    //(async () => {
    //    console.log("this is tab", tabId)
    //    const v = await getPageVar('origin', tabId);
    //    console.log("variable found: ", v);
    //})();
    return new Promise((resolve) => resolve(incomingMessage.content));
})

async function getPageVar(name: string, tabId?: any) {
    const [{ result }] = await chrome.scripting.executeScript({
        // @ts-ignore
        func: name => window[name],
        args: [name],
        target: {
            tabId: tabId ??
                (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id
        },
        world: 'MAIN',
    });
    const scripts = await chrome.scripting.getRegisteredContentScripts();
    const scriptIds = scripts.map(script => script.id);
    chrome.scripting.unregisterContentScripts({ ids: scriptIds });
    return result;
}

