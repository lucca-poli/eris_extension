import { TabManager, setupTabsListeners } from "./back_utils/tab_manager";
import { setupChromeListeners } from "./back_utils/chrome_messages";

console.log("background loaded");

const tabManager = new TabManager();
setupTabsListeners(tabManager);
setupChromeListeners(tabManager);

// On state changes
//chrome.storage.onChanged.addListener((changes) => {
//    const entries = Object.entries(changes) as [string, {
//        oldValue?: Record<string, ChatState>,
//        newValue?: Record<string, ChatState>,
//    }][];
//    for (const [key, { oldValue, newValue }] of entries) {
//        if (key !== AuditableChat.STORAGE_KEY || !oldValue || !newValue) continue;
//
//        const oldChatIds = Object.keys(oldValue);
//        const newChatIds = Object.keys(newValue);
//        const chatIds = Array.from(new Set([...oldChatIds, ...newChatIds]));
//
//        chatIds.forEach((chatId) => {
//            const oldState = oldValue[chatId]?.currentState;
//            const newState = newValue[chatId]?.currentState;
//
//            const oldStateIsRequest = oldState === AuditableChatStates.REQUEST_SENT || oldState === AuditableChatStates.REQUEST_RECEIVED;
//            if (oldStateIsRequest && newState === AuditableChatStates.ONGOING) auditableChats.set(chatId, new AuditableChat(chatId));
//        });
//    }
//})
