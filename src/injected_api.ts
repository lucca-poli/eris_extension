// @ts-ignore: library doesnt exists in this path alias
import WPP from "@wppconnect/wa-js"
import { AgentOptions, ActionOptions, AuditableChatOptions, InternalMessage } from "./utils/types.js"
import { WindowMessager } from "./utils/InternalMessager.js";

declare global {
    interface Window {
        WPP: typeof WPP;
    }
}

const WhatsappLayer = window.WPP;

const InjectedMessager = new WindowMessager();

const filter: InternalMessage = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.INJECTED,
    action: ActionOptions.INIT_AUDITABLE_BUTTON_CLICKED
}
InjectedMessager.listenMessage(filter, async () => {
    const activeChat = WhatsappLayer.chat.getActiveChat();
    const returnMessage = await WhatsappLayer.chat.sendTextMessage(activeChat.id._serialized, AuditableChatOptions.REQUEST);

    if (returnMessage.ack === 1) {
        const message: InternalMessage = {
            from: AgentOptions.INJECTED,
            to: AgentOptions.CONTENT,
            action: ActionOptions.INIT_AUDITABLE_BUTTON_CLICKED,
            payload: activeChat.id
        }
        InjectedMessager.sendMessage(message);
    }
});

/** @type {import('./utils/types.js').InternalMessage} getLastMessageFilter */
const getLastMessageFilter: InternalMessage = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.INJECTED,
    action: ActionOptions.GET_LAST_CHAT_MESSAGE
};
InjectedMessager.listenMessage(getLastMessageFilter, async (payload: string) => {
    const chatMessages = await WhatsappLayer.chat.getMessages(payload, { count: 1 });
    //console.log(chatMessages);
})
