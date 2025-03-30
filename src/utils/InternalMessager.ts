import { InternalMessage, MessagerService } from "./types";

//export class InternalMessager {
// 1. Recebe os serviços de transmissão no constructor e o Owner. serviços é um array de InternalMessagerService
// O objeto message deve estabelecer suas próprias rotas na construção
/**
 * @param {string} owner
 * @param {Array} messagerServices
*/
//private owner;
//private messagerServices;
//constructor(messagerServices: [], owner: string) {
//    this.owner = owner;
//}
// 2. Send and receive messages: make the routing and decide the services per route
//}

export class WindowMessager implements MessagerService {
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
