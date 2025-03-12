import { communicationActions, receivers } from "./utils/types.js"

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.to !== receivers.background) return;

    switch (message.action) {
        case communicationActions.init_auditable_button_clicked:
            console.log("Chegou no background");
            sendResponse(`Message arrived: ${message.data}`);
            break;
        default:
            console.log("Action to execute not found.");
            console.log("Action: ", message.action);
    }
});
