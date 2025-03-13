import { actionOptions, receiverOptions } from "./utils/types.js"

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.to !== receiverOptions.background) return;

    switch (message.action) {
        case actionOptions.init_auditable_button_clicked:
            console.log("Chegou no background");
            sendResponse(`Message arrived: ${message.data}`);
            break;
        default:
            console.log("Action to execute not found.");
            console.log("Action: ", message.action);
    }
});
