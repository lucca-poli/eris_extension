import { ActionOptions, AgentOptions, InternalMessage, MessagerService, RouteEndpoints } from "./types";

export class InternalMessager {
    private messagerServices: MessagerService[];
    constructor(messagerServices: MessagerService[]) {
        this.messagerServices = messagerServices;
    }

    private searchRoute(crudeMessage: InternalMessage): [MessagerService, InternalMessage] {
        const originalReceiver = crudeMessage.to;
        const originalSender = crudeMessage.from;


        for (const service of this.messagerServices) {
            const { owner, receiver } = service.getRoute();
            if (owner !== originalSender) {
                throw new Error("Wrong sender specified.")
            }

            if (receiver === originalReceiver) {
                const message: InternalMessage = {
                    from: owner,
                    to: receiver,
                    action: crudeMessage.action,
                    payload: crudeMessage.payload
                }
                return [service, message];
            }
        }

        // Pressuposto que só tem 1 disponível
        const onlyServiceAvailable = this.messagerServices[0];
        const possibleReceiver = onlyServiceAvailable.getRoute().receiver;
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
    constructor(owner: AgentOptions, receiver: AgentOptions) {
        this.route = { owner, receiver }
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
