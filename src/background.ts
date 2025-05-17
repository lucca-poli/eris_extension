import { ActionOptions, InternalMessage, AuditableMessage, ChatState, AuditableChatStates, AuditableChatOptions, ProcessAuditableMessage, GetMessages, SendFileMessage } from "./utils/types";
import { sendTextMessage, getChatMessages, setInputbox, sendFileMessage, getUserId } from "./utils/chrome_lib"
import { AuditableChatStateMachine } from "./utils/auditable_chat_state_machine";

// Tab manager - Manages current whatsapp web session
class TabManager {
    private currentTab?: chrome.tabs.Tab;
    constructor() {
        this.getLatestWhatsappTab();
    }

    private async getLatestWhatsappTab() {
        const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
            chrome.tabs.query({}, resolve);
        });
        const whatsappTabs = tabs.filter(tab =>
            tab.url?.includes("https://web.whatsapp.com/") && !!tab.lastAccessed
        ).sort(
            (a, b) => (b.lastAccessed! - a.lastAccessed!)
        );

        if (whatsappTabs) this.currentTab = whatsappTabs[0];
    }

    updateTab(newTab?: chrome.tabs.Tab) {
        this.currentTab = newTab;
    }

    getWhatsappTab() {
        if (!this.currentTab) throw new Error("No Whatsapp Web tab available");
        return this.currentTab
    }
}

const tabManager = new TabManager();

chrome.tabs.onUpdated.addListener((_tabId, _changeInfo, tab) => {
    if (!tab.url?.includes("https://web.whatsapp.com/")) return;
    tabManager.updateTab(tab);
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabManager.getWhatsappTab().id === tabId) {
        tabManager.updateTab();
        // Remover a conversa do storage se o estado for idle
    }
});

chrome.commands.onCommand.addListener((shortcut) => {
    if (shortcut === "reload") {
        console.log("Reloaded extension!");
        chrome.runtime.reload();
    }
})

console.log("background loaded");

class AuditableChat {
    lastHash: string;
    private chatId: string;
    static STORAGE_KEY = 'chats';

    constructor(chatId: string) {
        this.chatId = chatId;
        this.lastHash = this.initAuditableChat();
    };

    private initAuditableChat() {
        const initialization_process = "init_";
        console.log("Starting auditable chat: ", this.chatId)
        return initialization_process;
    };

    calculateHash(messageToProcess: string) {
        const newHash = this.lastHash + messageToProcess.trim() + "_";
        return newHash;
    }

    updateHash(incomingHash: string) {
        this.lastHash = incomingHash;
    }
}

const auditableChats: Map<string, AuditableChat> = new Map([]);

chrome.storage.onChanged.addListener((changes) => {
    const entries = Object.entries(changes) as [string, {
        oldValue?: Record<string, ChatState>,
        newValue?: Record<string, ChatState>,
    }][];
    for (const [key, { oldValue, newValue }] of entries) {
        if (key !== AuditableChat.STORAGE_KEY || !oldValue || !newValue) continue;

        const oldChatIds = Object.keys(oldValue);
        const newChatIds = Object.keys(newValue);
        const chatIds = Array.from(new Set([...oldChatIds, ...newChatIds]));

        chatIds.forEach((chatId) => {
            const oldState = oldValue[chatId]?.currentState;
            const newState = newValue[chatId]?.currentState;

            const oldStateIsRequest = oldState === AuditableChatStates.REQUEST_SENT || oldState === AuditableChatStates.REQUEST_RECEIVED;
            if (oldStateIsRequest && newState === AuditableChatStates.ONGOING) auditableChats.set(chatId, new AuditableChat(chatId));
        });
    }
})

function processAuditableMessage(tabManager: TabManager, auditableChats: Map<string, AuditableChat>, incomingMessage: AuditableMessage) {
    // Se for uma string é uma mensagem do usuário e devo processar, se não a mensagem vem de fora
    console.log("processingAuditableMessage: ", incomingMessage)
    let auditableChat = auditableChats.get(incomingMessage.chatId)
    if (!auditableChat) auditableChat = new AuditableChat(incomingMessage.chatId);

    (async () => {
        const authorIsMe = (await AuditableChatStateMachine.getUserId()) === incomingMessage.author;
        if (authorIsMe) {
            incomingMessage.hash = auditableChat.calculateHash(incomingMessage.content as string);

            const tabId = tabManager.getWhatsappTab().id as number;
            await sendTextMessage(tabId, incomingMessage);
        }
        auditableChat.updateHash(incomingMessage.hash as string);
    })();
}

chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
    if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_MESSAGE) return;

    const incomingChatMessage = internalMessage.payload as ProcessAuditableMessage;
    const { chatId, ...auditableMessage } = incomingChatMessage.incomingMessage;
    console.log("IncomingMessage: ", incomingChatMessage);

    (async () => {
        const currentState = await AuditableChatStateMachine.getAuditable(chatId);
        // Vai bugar se o cara mandar a mesma mensagem de aceite
        if (currentState?.currentState === AuditableChatStates.ONGOING && auditableMessage.content === AuditableChatOptions.ACCEPT) {
            const messageId = auditableMessage.messageId;
            if (!messageId) throw new Error("Auditable MessageId not found.");
            AuditableChatStateMachine.setAuditableStart(chatId, messageId);
        }

        if (incomingChatMessage.toCalculateHash) {
            processAuditableMessage(tabManager, auditableChats, incomingChatMessage.incomingMessage);
            AuditableChatStateMachine.increaseAuditableCounter(chatId);
        }
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
        const { chatId, fileContent } = internalMessage.payload as SendFileMessage;
        const result = await sendFileMessage(tabId, chatId, fileContent);
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
