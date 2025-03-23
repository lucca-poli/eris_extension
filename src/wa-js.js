import WPP from "@wppconnect/wa-js"
import { agentOptions, actionOptions } from "./utils/types.js"
import { FrontMessager } from "./utils/InternalMessager.js";

/** @type {typeof WPP} */
const WhatsappLayer = window.WPP;

/** @type {import('./utils/types.js').InternalMessage} */
const filter = {
    from: agentOptions.content,
    to: agentOptions.injected,
    action: actionOptions.init_auditable_button_clicked
}
FrontMessager.listenMessage(filter, () => {
    const activeChat = WhatsappLayer.chat.getActiveChat();
    console.log("Got active chat:", activeChat);

    /** @type {import('./utils/types.js').InternalMessage} */
    const message = {
        from: agentOptions.injected,
        to: agentOptions.content,
        action: actionOptions.debug,
        payload: activeChat
    }
    FrontMessager.sendMessage(message);
});
