import "@wppconnect/wa-js"
import WPP from "@wppconnect/wa-js"
import { AgentOptions, ActionOptions, AuditableChatOptions, InternalMessage, InternalMessageMetadata, chatMessage } from "./utils/types"
import { InternalMessager, WindowMessager } from "./utils/InternalMessager";

// @ts-ignore
const WhatsappLayer: typeof WPP = window.WPP;

const InjectedWindowMessager = new WindowMessager(AgentOptions.INJECTED, AgentOptions.CONTENT);
const InjectedMessager = new InternalMessager([InjectedWindowMessager]);

//WhatsappLayer.on('chat.new_message', async (chatMessage) => {
//    const arrivedMessage: chatMessage = {
//        content: chatMessage.body as string,
//        author: chatMessage.from?._serialized as string,
//    }
//    const response: InternalMessage = {
//        from: AgentOptions.INJECTED,
//        to: AgentOptions.CONTENT,
//        action: ActionOptions.RECEIVED_NEW_MESSAGE,
//        payload: arrivedMessage
//    }
//    InjectedMessager.sendMessage(response);
//});

const getLastMessageFilter: InternalMessageMetadata = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.INJECTED,
    action: ActionOptions.GET_LAST_CHAT_MESSAGE
};
InjectedMessager.listenMessage(getLastMessageFilter, async (payload: string) => {
    const chatMessages = await WhatsappLayer.chat.getMessages(payload, { count: 1 });
    const lastMessage = chatMessages[0];

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

const responseCleanInputBox: InternalMessageMetadata = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.INJECTED,
    action: ActionOptions.CLEAN_INPUT_TEXT_BOX
};
InjectedMessager.listenMessage(responseCleanInputBox, (chatId: string) => {
    WhatsappLayer.chat.setInputText('', chatId);
})

