import { ActionOptions, GetMessages, GetMessagesOptions, InternalMessage, WhatsappMessage } from "../utils/types";
import { logger } from "./logger";

// Returns WhatsappMessage[] with the last received message being the first element
export async function fetchLastMessagesFront(chatId: string, options: GetMessagesOptions): Promise<WhatsappMessage[]> {
    const delayTime = 200;
    const maxRetries = 150;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const getMessages: GetMessages = {
                chatId,
                options,
            };

            const whatsappMessages: WhatsappMessage[] | null = await chrome.runtime.sendMessage({
                action: ActionOptions.GET_MESSAGES,
                payload: getMessages
            } as InternalMessage);
            // put in DEBUG
            // console.log("Return from GET_MESSAGES: ", whatsappMessages)

            if (whatsappMessages && Array.isArray(whatsappMessages)) {
                return whatsappMessages.reverse(); // Reversed to ensure last received message comes first
            }

            // If we got null, retry
            if (attempt < maxRetries) {
                // put in DEBUG
                // console.log(`Attempt ${attempt} failed, retrying in ${attempt * delayTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, attempt * delayTime));
            }

        } catch (error) {
            if (attempt === maxRetries) {
                break;
            }
        }
    }

    logger.warn(`Failed to fetch messages for chat ${chatId} after ${maxRetries} attempts, returning empty array`);
    return [];
}
