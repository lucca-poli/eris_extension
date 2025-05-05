import "@wppconnect/wa-js"
import WPP from "@wppconnect/wa-js"
import { ActionOptions, InternalMessage, AuditableMessage } from "./utils/types";

// @ts-ignore
const WhatsappLayer: typeof WPP = window.WPP;

WhatsappLayer.on('chat.new_message', async (chatMessage) => {
    const arrivedMessage: AuditableMessage = {
        content: chatMessage.body as string,
        chatId: chatMessage.from?._serialized as string,
        authorIsMe: chatMessage.id.fromMe,
        hash: chatMessage.description,
    };
    window.postMessage({
        action: ActionOptions.PROCESS_AUDITABLE_MESSAGE,
        payload: arrivedMessage,
    } as InternalMessage, "*");
});
