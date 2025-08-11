import { ActionOptions, GetMessages, GetMessagesOptions, InternalMessage, WhatsappMessage } from "../utils/types";

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
            console.log("Return from GET_MESSAGES: ", whatsappMessages)

            if (whatsappMessages && Array.isArray(whatsappMessages)) {
                return whatsappMessages.reverse(); // Reversed to ensure last received message comes first
            }

            // If we got null, retry
            if (attempt < maxRetries) {
                console.log(`Attempt ${attempt} failed, retrying in ${attempt * delayTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, attempt * delayTime));
            }

        } catch (error) {
            console.error(`Error fetching messages (attempt ${attempt}):`, error);
            if (attempt === maxRetries) {
                break;
            }
        }
    }

    console.warn(`Failed to fetch messages for chat ${chatId} after ${maxRetries} attempts, returning empty array`);
    return [];
}
