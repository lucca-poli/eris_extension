import { ActionOptions, InternalMessage, AuditableMessage, ChatState, AuditableChatStates } from "./utils/types";
import { sendTextMessage, getLastChatMessage, setInputbox } from "./utils/chrome_lib"

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
    tabManager.updateTab(tab)
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabManager.getWhatsappTab().id === tabId) {
        tabManager.updateTab();
        // Remover a conversa do storage se o estado for idle
    }
})

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
    console.log("Changes: ", changes)
    const entries = Object.entries(changes) as [string, {
        oldValue?: Record<string, ChatState>,
        newValue?: Record<string, ChatState>,
    }][];
    for (const [key, { oldValue, newValue }] of entries) {
        if (key !== AuditableChat.STORAGE_KEY || !oldValue || !newValue) continue;

        console.log("Old state: ", oldValue)
        console.log("New state: ", newValue)
        const oldChatIds = Object.keys(oldValue);
        const newChatIds = Object.keys(newValue);
        const chatIds = Array.from(new Set([...oldChatIds, ...newChatIds]));

        chatIds.forEach((chatId) => {
            const oldState = oldValue[chatId]?.currentState;
            const newState = newValue[chatId]?.currentState;

            const oldStateIsRequest = oldState === AuditableChatStates.REQUEST_SENT || oldState === AuditableChatStates.REQUEST_RECEIVED;
            console.log("Old state: ", oldState)
            console.log("New state: ", newState)
            if (oldStateIsRequest && newState === AuditableChatStates.ONGOING) auditableChats.set(chatId, new AuditableChat(chatId));
        });
    }
})

chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
    if (internalMessage.action !== ActionOptions.PROCESS_AUDITABLE_MESSAGE) return;

    // Se for uma string é uma mensagem do usuário e devo processar, se não a mensagem vem de fora
    const arrivedMessage = internalMessage.payload as AuditableMessage;
    console.log("Message to process: ", arrivedMessage);

    let auditableChat = auditableChats.get(arrivedMessage.chatId)
    if (!auditableChat) auditableChat = new AuditableChat(arrivedMessage.chatId);

    if (arrivedMessage.authorIsMe) {
        arrivedMessage.hash = auditableChat.calculateHash(arrivedMessage.content as string);

        (async () => {
            const tabId = tabManager.getWhatsappTab().id as number;
            await sendTextMessage(tabId, arrivedMessage);
        })();
    }
    auditableChat.updateHash(arrivedMessage.hash as string)
});

chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
    if (internalMessage.action !== ActionOptions.SET_INPUT_BOX) return;

    const message = internalMessage.payload as string;
    (async () => {
        const tabId = tabManager.getWhatsappTab().id as number;
        setInputbox(tabId, message);
    })();
})

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

chrome.runtime.onMessage.addListener((internalMessage: InternalMessage, _sender, sendResponse) => {
    if (internalMessage.action !== ActionOptions.GET_LAST_CHAT_MESSAGE) return;

    (async () => {
        const tabId = tabManager.getWhatsappTab().id as number;
        const chatId = internalMessage.payload as string;
        const lastChatMessage = await getLastChatMessage(tabId, chatId);
        // Cannot send complex objects
        sendResponse(lastChatMessage)
    })();

    return true;
});
