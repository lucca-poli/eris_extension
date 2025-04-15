import { ActionOptions, AgentOptions, InternalMessage, InternalMessageMetadata, MessagerService, RouteEndpoints } from "./types";

export class InternalMessager {
    private messagerServices: MessagerService[];
    constructor(messagerServices: MessagerService[]) {
        this.messagerServices = messagerServices;
    }

    sendMessage(internalMessage: InternalMessage): void {
        const [service, message] = this.searchSendRoute(internalMessage);
        service.sendMessage(message);
    }

    listenMessage(filter: InternalMessageMetadata, callback: Function): void {
        const receiverService = this.getListenerMessagerService({ owner: filter.to, counterpart: filter.from });
        receiverService.listenMessage(filter, callback);
    }

    private getListenerMessagerService(messageEndpoints: RouteEndpoints): MessagerService {
        const originalReceiver = messageEndpoints.owner;
        const originalSender = messageEndpoints.counterpart;

        for (const service of this.messagerServices) {
            const { owner, counterpart } = service.getRoute();
            if (owner !== originalReceiver) {
                throw new Error("Wrong sender specified.")
            }

            if (counterpart === originalSender) {
                return service;
            }
        }

        throw new Error("Couldn't find a receiver service.");
    }

    private searchSendRoute(crudeMessage: InternalMessage): [MessagerService, InternalMessage] {
        const originalReceiver = crudeMessage.to;
        const originalSender = crudeMessage.from;

        for (const service of this.messagerServices) {
            const { owner, counterpart } = service.getRoute();
            if (owner !== originalSender) {
                throw new Error("Wrong sender specified.")
            }

            if (counterpart === originalReceiver) {
                const message: InternalMessage = {
                    from: owner,
                    to: counterpart,
                    action: crudeMessage.action,
                    payload: crudeMessage.payload
                }
                return [service, message];
            }
        }

        // Pressuposto que só tem 1 serviço disponível
        const onlyServiceAvailable = this.messagerServices[0];
        const possibleReceiver = onlyServiceAvailable.getRoute().counterpart;
        const message: InternalMessage = {
            from: originalSender,
            to: possibleReceiver,
            action: ActionOptions.REPASS_INTERNAL_MESSAGE,
            payload: {
                from: possibleReceiver,
                to: crudeMessage.to,
                action: crudeMessage.action,
                payload: crudeMessage.payload
            } as InternalMessage
        }
        return [onlyServiceAvailable, message];
    }
}

export class WindowMessager implements MessagerService {
    private route: RouteEndpoints;
    private listenerIds: Set<string>;
    constructor(owner: AgentOptions, counterpart: AgentOptions) {
        this.route = { owner, counterpart }
        this.listenerIds = new Set([]);
    };

    private generateListenerKey(listenerFilter: InternalMessageMetadata): string {
        return `${listenerFilter.from}_${listenerFilter.to}_${listenerFilter.action}`
    }

    getRoute(): RouteEndpoints {
        return this.route;
    }

    sendMessage(internalMessage: InternalMessage): void {
        window.postMessage(internalMessage, "*");
    }

    listenMessage(filter: InternalMessageMetadata, callback: Function): void {
        const listener = (event: MessageEvent) => {
            const message: InternalMessage = event.data;

            const matchesFilter =
                message.from === filter.from &&
                message.to === filter.to &&
                message.action === filter.action;
            if (!matchesFilter) return;

            try {
                callback(message.payload);
            } catch (error) {
                console.error("Error in callback processing:", error);
            }
        };
        const listenerKey = this.generateListenerKey(filter);

        if (this.listenerIds.has(listenerKey)) {
            window.removeEventListener("message", listener);
            this.listenerIds.delete(listenerKey)
        }
        window.addEventListener("message", listener);
        this.listenerIds.add(listenerKey);
    }
}

export class ChromeMessager {
    private route: RouteEndpoints;
    private listenerIds: Set<string>;
    constructor(owner: AgentOptions, counterpart: AgentOptions) {
        this.route = { owner, counterpart }
        this.listenerIds = new Set([]);
    };

    private generateListenerKey(listenerFilter: InternalMessageMetadata): string {
        return `${listenerFilter.from}_${listenerFilter.to}_${listenerFilter.action}`
    }

    getRoute(): RouteEndpoints {
        return this.route;
    }

    sendMessage(internalMessage: InternalMessage, responseCallback?: (response: any) => void): void {
        chrome.runtime.sendMessage(internalMessage, (response) => {
            if (response && responseCallback) responseCallback(response)
        })
    }

    listenMessage(filter: InternalMessageMetadata, callback: (data: any) => any): void {
        const chromeCallback = (message: InternalMessage, _sender: any, sendResponse: Function) => {
            const matchesFilter =
                message.from === filter.from &&
                message.to === filter.to &&
                message.action === filter.action;
            if (!matchesFilter) return;

            (async () => {
                try {
                    // Await the callback response
                    const response = await callback(message);
                    // Send the response (or null if no response)
                    sendResponse(response || null);
                } catch (error) {
                    console.error("Error in async callback:", error);
                    sendResponse({ error: "Error processing request" });
                }
            })();

            // Return true to keep the message channel open for the async response
            return true;
        };

        const listenerKey = this.generateListenerKey(filter);
        if (this.listenerIds.has(listenerKey)) {
            this.listenerIds.delete(listenerKey)
            chrome.runtime.onMessage.removeListener(chromeCallback)
        }

        this.listenerIds.add(listenerKey);

        chrome.runtime.onMessage.addListener(chromeCallback);
    }
}
