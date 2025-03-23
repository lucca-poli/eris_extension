export class WindowMessager {
    constructor() {
        /** @type {import("./types.js").InternalMessage[]} */
        this.messageQueue = [];
        this.isListening = false;
    }

    /**
     * @param {import("./types.js").InternalMessage} internalMessage
     * @returns {void}
    */
    sendMessage(internalMessage) {
        if (this.isListening) {
            this.messageQueue.push(internalMessage);
        } else {
            console.log("🛠️ Sending message via window.postMessage:", internalMessage);
            console.log("State of queue:", this.messageQueue);
            window.postMessage(internalMessage, "*");
        }
    }

    /**
     * @param {import("./types.js").InternalMessage} internalMessage
     * @param {Function} callback
     * @returns {void}
    */
    listenMessage(filter, callback) {
        window.addEventListener("message", (event) => {
            this.isListening = true;
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
            this.isListening = false;
            console.log("Callback processed");
        });

        console.log("Callback really processed?");
    }
}
