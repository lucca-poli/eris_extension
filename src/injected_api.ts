import "@wppconnect/wa-js"
import WPP from "@wppconnect/wa-js"
import { ActionOptions, InternalMessage, AuditableMessage } from "./utils/types";

// @ts-ignore
const WhatsappLayer: typeof WPP = window.WPP;

WhatsappLayer.on('chat.new_message', async (chatMessage) => {
    const arrivedMessage: AuditableMessage = {
        content: chatMessage.body as string,
        chatId: chatMessage.id?.remote?._serialized as string,
        authorIsMe: chatMessage.id.fromMe,
        hash: chatMessage.description,
    };

    if (!chatMessage?.from?.isUser()) return;
    if (!arrivedMessage.chatId) throw new Error(`New message has no message: ${arrivedMessage}`);
    if (!arrivedMessage.content) throw new Error(`New message has no content: ${arrivedMessage}`);
    if (!arrivedMessage.authorIsMe) throw new Error(`New message has no author: ${arrivedMessage}`);

    window.postMessage({
        action: ActionOptions.PROPAGATE_NEW_MESSAGE,
        payload: arrivedMessage,
    } as InternalMessage, "*");
});

WhatsappLayer.on('chat.active_chat', async (chat) => {
    const chatId = chat?.id._serialized as string;

    if (!chat?.isUser) return;
    if (!chatId) throw new Error(`New chat has no chatId: ${chatId}`);

    window.postMessage({
        action: ActionOptions.PROPAGATE_NEW_CHAT,
        payload: chatId,
    } as InternalMessage, "*");
});

