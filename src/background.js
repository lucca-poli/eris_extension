import { agentOptions, actionOptions } from "./utils/types.js"

//chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
//    if (message.action !== actionOptions.init_auditable_button_clicked) return;
//    console.log("Received:", message);
//
//    /** @type {import("./utils/types.js").InternalMessage} internalMessage */
//    const internalMessage = {
//        action: message.action,
//        data: message.data,
//        from: agentOptions.background,
//        to: agentOptions.wa_js
//    };
//    chrome.tabs.sendMessage(internalMessage);
//});
