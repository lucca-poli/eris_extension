import { ActionOptions, AgentOptions, InternalMessage, MessagerService, RouteEndpoints } from "./types";

export class InternalMessager {
    private messagerServices: MessagerService[];
    constructor(messagerServices: MessagerService[]) {
        this.messagerServices = messagerServices;
    }

    sendMessage(internalMessage: InternalMessage): void {
        const [service, message] = this.searchSendRoute(internalMessage);
        service.sendMessage(message);
    }

    listenMessage(filter: InternalMessage, callback: Function): void {
        if (filter.action === ActionOptions.REPASS_INTERNAL_MESSAGE) {
            this.sendMessage(filter.payload as InternalMessage);
            return;
        }
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
    constructor(owner: AgentOptions, counterpart: AgentOptions) {
        this.route = { owner, counterpart }
    };

    getRoute(): RouteEndpoints {
        return this.route;
    }

    sendMessage(internalMessage: InternalMessage): void {
        console.log("🛠️ Sending message via window.postMessage:", internalMessage);
        window.postMessage(internalMessage, "*");
    }

    listenMessage(filter: InternalMessage, callback: Function): void {
        const listener = (event: MessageEvent) => {
            console.log("🛠️ Receiving event from window.postMessage:", event.data);
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

        window.addEventListener("message", listener);
    }
}
