import WPP from "@wppconnect/wa-js"
import { agentOptions, actionOptions } from "./utils/types.js"
import { WindowMessager } from "./utils/InternalMessager.js";

/** @type {typeof WPP} */
const WhatsappLayer = window.WPP;

const FrontMessager = new WindowMessager();

/** @type {import('./utils/types.js').InternalMessage} */
const filter = {
    from: agentOptions.content,
    to: agentOptions.injected,
    action: actionOptions.init_auditable_button_clicked
}
FrontMessager.listenMessage(filter, async () => {
    const activeChat = WhatsappLayer.chat.getActiveChat();
    const returnMessage = await WhatsappLayer.chat.sendTextMessage(activeChat.id._serialized, "Requesting Auditable Message");

    /** @type {import('./utils/types.js').InternalMessage} */
    const message = {
        from: agentOptions.injected,
        to: agentOptions.content,
        action: actionOptions.debug,
        payload: { ack: returnMessage.ack, id: activeChat.id }
    }
    FrontMessager.sendMessage(message);
});

