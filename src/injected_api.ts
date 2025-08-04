import "@wppconnect/wa-js"
import WPP from "@wppconnect/wa-js"
import { ActionOptions, InternalMessage, WhatsappMessage, AckMetadata, AuditableControlMessage, AuditableMetadata, MetadataOptions } from "./utils/types";

// @ts-ignore
const WhatsappLayer: typeof WPP = window.WPP;

WhatsappLayer.on('chat.new_message', async (chatMessage) => {
    const incomingMetadataString = chatMessage.description as string | undefined;
    const incomingMetadataObject = (typeof (incomingMetadataString) === "string")
        ? JSON.parse(incomingMetadataString) as AuditableMetadata | AckMetadata
        : undefined;
    const arrivedMessage: WhatsappMessage = {
        content: chatMessage.body,
        chatId: chatMessage.id?.remote?._serialized as string,
        author: chatMessage.from?._serialized as string,
        metadata: incomingMetadataObject,
        messageId: chatMessage.id._serialized,
        timestamp: chatMessage.t,
    };

    if (!chatMessage?.from?.isUser()) return;
    if (!arrivedMessage.chatId) throw new Error(`New message has no message: ${arrivedMessage}`);
    if (!arrivedMessage.author) throw new Error(`New message has no author: ${arrivedMessage}`);

    const metadataIsAck = arrivedMessage.metadata?.kind === MetadataOptions.ACK;

    // Ignorar a mensagem se é um ACK na minha visão se fui eu que enviei
    if (metadataIsAck && chatMessage.id.fromMe) return;

    if (metadataIsAck) {
        if (chatMessage.body !== AuditableControlMessage.ACK) throw new Error("Ack message differs from expected message.");
        await WhatsappLayer.chat.deleteMessage(arrivedMessage.chatId, arrivedMessage.messageId as string);
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

