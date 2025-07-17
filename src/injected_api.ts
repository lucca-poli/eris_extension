import "@wppconnect/wa-js"
import WPP from "@wppconnect/wa-js"
import { ActionOptions, InternalMessage, AuditableMessage, AckMetadataSchema, AckMetadata, AuditableControlMessage, AuditableMessageMetadata } from "./utils/types";

// @ts-ignore
const WhatsappLayer: typeof WPP = window.WPP;

WhatsappLayer.on('chat.new_message', async (chatMessage) => {
    const incomingMetadataString = chatMessage.description as string | undefined;
    const incomingMetadataObject = (typeof (incomingMetadataString) === "string")
        ? JSON.parse(incomingMetadataString) as AuditableMessageMetadata | AckMetadata
        : undefined;
    let arrivedMessage: AuditableMessage | AckMetadata;

    const ackMetadata = AckMetadataSchema.safeParse(incomingMetadataObject);

    // Ignorar a mensagem se é um ACK na minha visão se fui eu que enviei
    if (ackMetadata.success && chatMessage.id.fromMe) return;

    if (ackMetadata.success) {
        if (chatMessage.body !== AuditableControlMessage.ACK) throw new Error("Ack message differs from expected message.");
        arrivedMessage = ackMetadata.data;
        const chatId = chatMessage.id?.remote?._serialized as string;
        const messageId = chatMessage.id._serialized;
        if (!chatId) throw new Error(`New ack has no message: ${arrivedMessage}`);
        await WhatsappLayer.chat.deleteMessage(chatId, messageId);
    } else { // The incoming message can either be an auditable message or a normal message.
        arrivedMessage = {
            content: chatMessage.body,
            chatId: chatMessage.id?.remote?._serialized as string,
            author: chatMessage.from?._serialized as string,
            metadata: incomingMetadataObject as AuditableMessageMetadata | undefined,
            messageId: chatMessage.id._serialized,
            timestamp: chatMessage.t,
        };

        if (!chatMessage?.from?.isUser()) return;
        if (!arrivedMessage.chatId) throw new Error(`New message has no message: ${arrivedMessage}`);
        if (!arrivedMessage.author) throw new Error(`New message has no author: ${arrivedMessage}`);
    }

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

