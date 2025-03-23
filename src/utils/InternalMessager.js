export class WindowMessager {
    constructor() {
        /** @type {Map<Function, Function>} */
        this.listenerMap = new Map();
    }

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
        const wrappedListener = (event) => {
            console.log("🛠️ Receiving event from window.postMessage:", event);
            /** @type {import("./types.js").InternalMessage} */
            const message = event.data;

            const matchesFilter =
                message.from === filter.from &&
                message.to === filter.to &&
                message.action === filter.action;
            if (!matchesFilter) return;

            callback(message.payload);
        };

        window.addEventListener("message", wrappedListener);
    }
}
