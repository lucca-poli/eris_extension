import { ActionOptions, InternalMessage, AuditableMessage, AuditableChatStates, AuditableChatOptions, ProcessAuditableMessage, GetMessages, SendFileMessage, AuditableBlock, PRFArgs, CommitArgs, HashArgs, AuditableMessageContent, GetCommitedKeys } from "./utils/types";
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
        const seed = initMessageId;
        const initMetadata = new Date().toISOString().split('T')[0];
        console.log("Timestamp is: ", initMetadata);
        const previousHash = "0000000000000000000000000000000000000000000000000000000000000000";

        const commitedKey = await AuditableChat.prf({
            seed,
            counter: initCounter
        });
        const commitedMessage = await AuditableChat.#commitFunction({
            commitedKey,
            message: initMetadata
        });
        const initHash = await AuditableChat.#hashFunction({
            previousHash,
            counter: initCounter,
            commitedMessage
        });

        const initBlock: AuditableBlock = {
            previousHash,
            counter: initCounter,
            hash: initHash,
            commitedMessage
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

    static async generateNewBlock(chatId: string, messageToProcess: AuditableMessageContent) {
        const lastMessage = await AuditableChat.#getPreviousMessage(chatId);
        let lastBlock = lastMessage.hash;
        if (!lastBlock && lastMessage.content === AuditableChatOptions.ACCEPT) {
            const auditableState = await AuditableChatStateMachine.getAuditable(chatId);
            if (!auditableState?.auditableChatReference) throw new Error(`New auditable chat has no reference to chat.`);
            lastBlock = auditableState.auditableChatReference.initialBlock;
        }
        if (!lastBlock) throw new Error(`No initial block found in new auditable chat.`);

        const seed = await AuditableChatStateMachine.retrieveSeed(chatId);

        const { counter, hash } = lastBlock;
        const updatedCounter = counter + 1;

        const commitedKey = await AuditableChat.prf({
            seed,
            counter: updatedCounter
        });
        console.log("commited args: ", {
            commitedKey,
            message: JSON.stringify(messageToProcess)
        } as CommitArgs)
        const commitedMessage = await AuditableChat.#commitFunction({
            commitedKey,
            message: JSON.stringify(messageToProcess)
        });

        const newHash = await AuditableChat.#hashFunction({
            previousHash: hash,
            counter: updatedCounter,
            commitedMessage
        });
        return {
            hash: newHash,
            previousHash: hash,
            counter: updatedCounter,
            commitedMessage
        } as AuditableBlock;
    }

    static async #commitFunction(args: CommitArgs) {
        const serializedData = JSON.stringify(args);

        // 1. Encode the string as UTF-8
        const encoder = new TextEncoder();
        const data = encoder.encode(serializedData);

        // 2. Hash it
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);

        // 3. Convert ArrayBuffer to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return hashHex;
    }

    static async #hashFunction(args: HashArgs) {
        const serializedData = JSON.stringify(args);

        // 1. Encode the string as UTF-8
        const encoder = new TextEncoder();
        const data = encoder.encode(serializedData);

        // 2. Hash it
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);

        // 3. Convert ArrayBuffer to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return hashHex;
    }

    static async prf(args: PRFArgs): Promise<string> {
        const { seed, counter } = args;

        const enc = new TextEncoder();

        // Import the key into a CryptoKey object
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            enc.encode(seed),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        // Run HMAC
        const signature = await crypto.subtle.sign(
            'HMAC',
            cryptoKey,
            enc.encode(String(counter))
        );

        // Convert ArrayBuffer to hex
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
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
        // InitBlock generation
        // Vai bugar se o cara mandar a mesma mensagem de aceite durante um chat auditável
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

        // Generate hash block and send it with message if it comes from sender
        if (incomingChatMessage.toCalculateHash) {
            console.log("processingAuditableMessage: ", auditableMessage)

            const authorIsMe = (await AuditableChatStateMachine.getUserId()) === auditableMessage.author;
            if (authorIsMe) {
                const auditableContent: AuditableMessageContent = {
                    content: auditableMessage.content as string,
                    author: auditableMessage.author
                }
                auditableMessage.hash = await AuditableChat.generateNewBlock(chatId, auditableContent);

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
