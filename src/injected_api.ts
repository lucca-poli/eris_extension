import "@wppconnect/wa-js"
import WPP from "@wppconnect/wa-js"
import { AgentOptions, ActionOptions, AuditableChatOptions, InternalMessage, InternalMessageMetadata, chatMessage } from "./utils/types"
import { InternalMessager, WindowMessager } from "./utils/InternalMessager";

// @ts-ignore
const WhatsappLayer: typeof WPP = window.WPP;

const InjectedWindowMessager = new WindowMessager(AgentOptions.INJECTED, AgentOptions.CONTENT);
const InjectedMessager = new InternalMessager([InjectedWindowMessager]);

const denyAuditableButtonClicked: InternalMessageMetadata = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.INJECTED,
    action: ActionOptions.REQUEST_DENY_AUDITABLE_BUTTON_CLICKED
};
InjectedMessager.listenMessage(denyAuditableButtonClicked, (payload: string) => {
    WhatsappLayer.chat.sendTextMessage(payload, AuditableChatOptions.DENY);
})

const newMessageArrived: InternalMessage = {
    from: AgentOptions.INJECTED,
    to: AgentOptions.CONTENT,
    action: ActionOptions.RECEIVED_NEW_MESSAGE,
}
WhatsappLayer.on('chat.new_message', async (chatMessage) => {
    //console.log('New message received:', chatMessage);
    const arrivedMessage: chatMessage = {
        content: chatMessage.body as string,
        author: chatMessage.from?._serialized as string,
    }
    const response: InternalMessage = {
        from: AgentOptions.INJECTED,
        to: AgentOptions.CONTENT,
        action: ActionOptions.RECEIVED_NEW_MESSAGE,
        payload: arrivedMessage
    }
    InjectedMessager.sendMessage(response);
});

const acceptAuditableButtonClicked: InternalMessageMetadata = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.INJECTED,
    action: ActionOptions.REQUEST_ACCEPT_AUDITABLE_BUTTON_CLICKED
};
InjectedMessager.listenMessage(acceptAuditableButtonClicked, (payload: string) => {
    WhatsappLayer.chat.sendTextMessage(payload, AuditableChatOptions.ACCEPT);
})

const endAuditableButtonClicked: InternalMessageMetadata = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.INJECTED,
    action: ActionOptions.REQUEST_END_AUDITABLE_BUTTON_CLICKED
};
InjectedMessager.listenMessage(endAuditableButtonClicked, (payload: string) => {
    WhatsappLayer.chat.sendTextMessage(payload, AuditableChatOptions.END);
})

const auditableButtonClicked: InternalMessageMetadata = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.INJECTED,
    action: ActionOptions.REQUEST_AUDITABLE_BUTTON_CLICKED
};
InjectedMessager.listenMessage(auditableButtonClicked, (payload: string) => {
    WhatsappLayer.chat.sendTextMessage(payload, AuditableChatOptions.REQUEST);
})

const getLastMessageFilter: InternalMessageMetadata = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.INJECTED,
    action: ActionOptions.GET_LAST_CHAT_MESSAGE
};
InjectedMessager.listenMessage(getLastMessageFilter, async (payload: string) => {
    const chatMessages = await WhatsappLayer.chat.getMessages(payload, { count: 1 });
    const lastMessage = chatMessages[0];
    //console.log("last message: ", lastMessage)

    const lastChatMessage: chatMessage = {
        content: lastMessage.body as string,
        author: lastMessage.from?._serialized as string
    }
    const sendResponse: InternalMessage = {
        to: AgentOptions.CONTENT,
        from: AgentOptions.INJECTED,
        action: ActionOptions.GET_LAST_CHAT_MESSAGE,
        payload: lastChatMessage
    };
    InjectedMessager.sendMessage(sendResponse);
})

const currentChat: InternalMessageMetadata = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.INJECTED,
    action: ActionOptions.GET_CURRENT_CHAT
};
InjectedMessager.listenMessage(currentChat, () => {
    const activeChat = WhatsappLayer.chat.getActiveChat();

    const currentChatResponse: InternalMessage = {
        from: AgentOptions.INJECTED,
        to: AgentOptions.CONTENT,
        action: ActionOptions.GET_CURRENT_CHAT,
        payload: undefined
    }
    if (activeChat?.isUser) {
        currentChatResponse.payload = activeChat.id._serialized;
    }
    InjectedMessager.sendMessage(currentChatResponse);
})
