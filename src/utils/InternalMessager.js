export class WindowMessager {
    /**
     * @param {import("./types.js").InternalMessage} internalMessage
     * @returns {void}
    */
    sendMessage(internalMessage) {
        console.log("🛠️ Sending message via window.postMessage:", internalMessage);
        window.postMessage(internalMessage, "*");
    }

    /**
     * @param {import("./types.js").InternalMessage} internalMessage
     * @param {Function} callback
     * @returns {void}
    */
    listenMessage(filter, callback) {
        const listener = (event) => {
            console.log("🛠️ Receiving event from window.postMessage:", event.data);
            /** @type {import("./types.js").InternalMessage} */
            const message = event.data;

            const matchesFilter =
                message.from === filter.from &&
                message.to === filter.to &&
                message.action === filter.action;
            if (!matchesFilter) return;

            console.log("Message reached callback");
            callback(message.payload);
            console.log("Callback processed");
        };

        window.addEventListener("message", listener);
    }
}
