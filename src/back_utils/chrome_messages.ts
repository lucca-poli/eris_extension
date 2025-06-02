import { AuditableChatStateMachine } from "../utils/auditable_chat_state_machine";
import { ActionOptions, AuditableChatOptions, AuditableChatStates, AuditableMessage, AuditableMessageContent, GetCommitedKeys, GetMessages, InternalMessage, SendFileMessage } from "../utils/types";
import { AuditableChat } from "./auditable_chat";
import { getChatMessages, getUserId, sendFileMessage, sendTextMessage, setInputbox } from "../utils/chrome_lib";
import { TabManager } from "./tab_manager";

export function setupChromeListeners(tabManager: TabManager) {

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_MESSAGE) return;

        const auditableMessage = internalMessage.payload as AuditableMessage;
        const { chatId } = auditableMessage;
        console.log("IncomingMessage: ", auditableMessage);

        (async () => {
            const currentState = await AuditableChatStateMachine.getAuditable(chatId);
            // InitBlock generation
            // Vai bugar se o cara mandar a mesma mensagem de aceite durante um chat auditável
            if (currentState?.currentState === AuditableChatStates.ONGOING && auditableMessage.content === AuditableChatOptions.ACCEPT) {
                const messageId = auditableMessage.messageId;
                if (!messageId) throw new Error("Auditable MessageId not found.");

                const initialBlock = await AuditableChat.generateInitBlock(chatId);
                AuditableChatStateMachine.setAuditableStart(chatId, messageId, initialBlock);
            }

            AuditableChatStateMachine.increaseAuditableCounter(chatId);
        })();
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.GENERATE_AND_SEND_BLOCK) return;

        const auditableMessage = internalMessage.payload as AuditableMessage;
        const chatId = auditableMessage.chatId;
        const tabId = tabManager.getWhatsappTab().id as number;

        (async () => {
            const auditableContent: AuditableMessageContent = {
                content: auditableMessage.content as string,
                author: auditableMessage.author
            }
            auditableMessage.hash = await AuditableChat.generateNewBlock(tabId, chatId, auditableContent);

            await sendTextMessage(tabId, auditableMessage);
        })();
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.SET_INPUT_BOX) return;

        const message = internalMessage.payload as string;
        const tabId = tabManager.getWhatsappTab().id as number;
        setInputbox(tabId, message);
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage, _sender, sendResponse) => {
        if (internalMessage.action !== ActionOptions.GET_MESSAGES) return;

        const { chatId, options } = internalMessage.payload as GetMessages;
        const tabId = tabManager.getWhatsappTab().id as number;

        (async () => {
            const messages = await getChatMessages(tabId, chatId, options);
            //
            // Cannot send complex objects
            sendResponse(messages);
        })();

        return true;
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage, _sender, sendResponse) => {
        if (internalMessage.action !== ActionOptions.GET_COMMITED_KEYS) return;

        const { seed, counters } = internalMessage.payload as GetCommitedKeys;

        (async () => {
            const keys = counters.map(async (counter) => {
                return AuditableChat.prf({
                    seed,
                    counter
                })
            });
            const commitedKeys = await Promise.all(keys);
            // Cannot send complex objects
            sendResponse(commitedKeys);
        })();

        return true;
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage, _sender, sendResponse) => {
        if (internalMessage.action !== ActionOptions.SEND_TEXT_MESSAGE) return;

        (async () => {
            const tabId = tabManager.getWhatsappTab().id as number;
            const messageReturn = await sendTextMessage(tabId, internalMessage.payload as AuditableMessage);
            // Cannot send complex objects
            sendResponse(messageReturn?.id);
        })();

        return true;
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.SEND_FILE_MESSAGE) return;

        (async () => {
            const tabId = tabManager.getWhatsappTab().id as number;
            const { chatId, fileContent, fileName } = internalMessage.payload as SendFileMessage;
            const result = await sendFileMessage(tabId, chatId, fileContent, fileName);
            if (!result) throw new Error("Could not send file.");
        })();
    });

    chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
        if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_CHAT) return;

        (async () => {
            const tabId = tabManager.getWhatsappTab().id as number;
            const userId = await getUserId(tabId);
            const oldUserId = await AuditableChatStateMachine.getUserId();
            if (userId && userId !== oldUserId) AuditableChatStateMachine.setUserId(userId);
        })();
    });
}

