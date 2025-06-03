import "@wppconnect/wa-js"
import WPP from "@wppconnect/wa-js"
import { ActionOptions, InternalMessage, AuditableMessage, AuditableMessageMetadata } from "./utils/types";

// @ts-ignore
const WhatsappLayer: typeof WPP = window.WPP;

WhatsappLayer.on('chat.new_message', async (chatMessage) => {
    const auditableBlockString = chatMessage.description as string | undefined;

    const metadata: AuditableMessageMetadata = auditableBlockString ? JSON.parse(auditableBlockString) : undefined;

    const arrivedMessage: AuditableMessage = {
        content: chatMessage.body,
        chatId: chatMessage.id?.remote?._serialized as string,
        author: chatMessage.from?._serialized as string,
        metadata,
        messageId: chatMessage.id._serialized,
        timestamp: chatMessage.t,
    };

    if (!chatMessage?.from?.isUser()) return;
    if (!arrivedMessage.chatId) throw new Error(`New message has no message: ${arrivedMessage}`);
    if (!arrivedMessage.author) throw new Error(`New message has no author: ${arrivedMessage}`);

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

