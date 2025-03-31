import "@wppconnect/wa-js"
import WPP from "@wppconnect/wa-js"
import { AgentOptions, ActionOptions, AuditableChatOptions, InternalMessage } from "./utils/types"
import { InternalMessager, WindowMessager } from "./utils/InternalMessager";

// @ts-ignore
const WhatsappLayer: typeof WPP = window.WPP;

const InjectedWindowMessager = new WindowMessager(AgentOptions.INJECTED, AgentOptions.CONTENT);
const InjectedMessager = new InternalMessager([InjectedWindowMessager]);

const filter: InternalMessage = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.INJECTED,
    action: ActionOptions.INIT_AUDITABLE_BUTTON_CLICKED
}
InjectedMessager.listenMessage(filter, async () => {
    const activeChat = WhatsappLayer.chat.getActiveChat() as WPP.whatsapp.ChatModel;
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

const getLastMessageFilter: InternalMessage = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.INJECTED,
    action: ActionOptions.GET_LAST_CHAT_MESSAGE
};
InjectedMessager.listenMessage(getLastMessageFilter, async (payload: string) => {
    const chatMessages = await WhatsappLayer.chat.getMessages(payload, { count: 1 });
    //console.log(chatMessages);
})
