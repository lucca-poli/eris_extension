import { ActionOptions, InternalMessage, AuditableMessage, AuditableChatStates, AuditableChatOptions, ProcessAuditableMessage, GetMessages, SendFileMessage, AuditableBlock } from "./utils/types";
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

chrome.tabs.onUpdated.addListener(async (_tabId, _changeInfo, tab) => {
    if (!tab.url?.includes("https://web.whatsapp.com/")) return;
    await AuditableChatStateMachine.removeIdleChats();
    tabManager.updateTab(tab);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
    if (tabManager.getWhatsappTab().id === tabId) {
        await AuditableChatStateMachine.removeIdleChats();
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
    static STORAGE_KEY = 'chats';

    constructor() {
        console.log("Non expected call to constructor.")
    };

    //static async #getCounter(chatId: string): Promise<number> {
    //    const auditableChatState = await AuditableChatStateMachine.getAuditable(chatId);
    //    const auditableReference = auditableChatState?.auditableChatReference;
    //    if (!auditableReference) throw new Error(`Chat with id ${chatId} still has no reference. ${auditableChatState}`);
    //
    //    return auditableReference.auditableMessagesCounter
    //}

    static async generateInitBlock(initMessageId: string): Promise<AuditableBlock> {
        const initCounter = 0;
        const initMetadata = initMessageId;
        const previousHash = "0000";

        // initMetadata pode ser ou metadata ou message_i
        // Ignorando a seed por enquanto
        const ck = await AuditableChat.#hashFunction([String(initCounter)]);
        const commitedMessage = AuditableChat.#commitFunction([ck, initMetadata]);
        const initHash = await AuditableChat.#hashFunction([previousHash, ck, commitedMessage]);

        const initBlock: AuditableBlock = {
            previousHash,
            counter: initCounter,
            hash: initHash,
            commitedMessage: AuditableChat.#commitFunction([initMetadata])
        }
        return initBlock;
    };

    static async #getPreviousMessage(chatId: string) {
        const tabId = tabManager.getWhatsappTab().id;
        if (!tabId) throw new Error("No tabId available");

        const lastMessage = (await getChatMessages(tabId, chatId, { count: 1 }))[0];
        if (!lastMessage) throw new Error("No message available");
        return lastMessage;
    }

    // Ignorando a seed por enquanto
    static async generateNewBlock(chatId: string, messageToProcess: string) {
        const lastMessage = await AuditableChat.#getPreviousMessage(chatId);
        let lastBlock = lastMessage.hash;
        if (!lastBlock && lastMessage.content === AuditableChatOptions.ACCEPT) {
            const auditableState = await AuditableChatStateMachine.getAuditable(chatId);
            if (!auditableState?.auditableChatReference) throw new Error(`New auditable chat has no reference to chat.`);
            lastBlock = auditableState.auditableChatReference.initialBlock;
        }
        if (!lastBlock) throw new Error(`No initial block found in new auditable chat.`);

        const { counter, hash } = lastBlock;
        const updatedCounter = counter + 1;

        const commitedKey = await AuditableChat.#hashFunction([String(updatedCounter)]);
        const commitedMessage = AuditableChat.#commitFunction([commitedKey, messageToProcess]);

        const newHash = await AuditableChat.#hashFunction([hash, String(updatedCounter), commitedMessage]);
        return {
            hash: newHash,
            previousHash: hash,
            counter: updatedCounter,
            commitedMessage
        } as AuditableBlock;
    }

    static #commitFunction(itemsToHash: string[]) {
        const concatenatedItems = itemsToHash.reduce((accumulator, currentValue) => accumulator + currentValue, "");

        return concatenatedItems;
    }

    static async #hashFunction(itemsToHash: string[]) {
        const concatenatedItems = itemsToHash.reduce((accumulator, currentValue) => accumulator + currentValue, "");
        // 1. Encode the string as UTF-8
        const encoder = new TextEncoder();
        const data = encoder.encode(concatenatedItems);

        // 2. Hash it
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);

        // 3. Convert ArrayBuffer to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return hashHex;
    }
}

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

chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
    if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_MESSAGE) return;

    const incomingChatMessage = internalMessage.payload as ProcessAuditableMessage;
    const { chatId } = incomingChatMessage.incomingMessage;
    const auditableMessage = incomingChatMessage.incomingMessage;
    console.log("IncomingMessage: ", incomingChatMessage);

    (async () => {
        const currentState = await AuditableChatStateMachine.getAuditable(chatId);
        // Vai bugar se o cara mandar a mesma mensagem de aceite
        if (currentState?.currentState === AuditableChatStates.ONGOING && auditableMessage.content === AuditableChatOptions.ACCEPT) {
            const messageId = auditableMessage.messageId;
            if (!messageId) throw new Error("Auditable MessageId not found.");

            const messageIdItems = messageId?.split("_");
            const itemsLength = messageIdItems?.length;
            if (!itemsLength) throw new Error("Auditable MessageId splited is empty.");
            const pureMessageId = messageIdItems[itemsLength - 1];
            console.log("Last message from listener perspective: ", auditableMessage);
            if (!pureMessageId) throw new Error("Auditable MessageId not found.");

            const initialBlock = await AuditableChat.generateInitBlock(pureMessageId);
            AuditableChatStateMachine.setAuditableStart(chatId, messageId, initialBlock);
        }

        if (incomingChatMessage.toCalculateHash) {
            // Se for uma string é uma mensagem do usuário e devo processar, se não a mensagem vem de fora
            console.log("processingAuditableMessage: ", auditableMessage)

            const authorIsMe = (await AuditableChatStateMachine.getUserId()) === auditableMessage.author;
            if (authorIsMe) {
                auditableMessage.hash = await AuditableChat.generateNewBlock(chatId, auditableMessage.content as string);

                const tabId = tabManager.getWhatsappTab().id as number;
                await sendTextMessage(tabId, auditableMessage);
            }
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
