chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.to !== "background") return;

    switch (message.action) {
        case "init-auditable-button-clicked":
            console.log("Chegou no background");
            sendResponse(`Message arrived: ${message.data}`);
            break;
        default:
            console.log("Action to execute not found.");
            console.log("Action: ", message.action);
    }
});
