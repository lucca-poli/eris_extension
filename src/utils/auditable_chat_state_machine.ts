import { AuditableBlock, AuditableChatOptions, AuditableChatReference, AuditableChatStates, AuditableMessage, ChatState, RandomSeedSalt } from "./types";

export class AuditableChatStateMachine {
    private chatId: string;
    private currentState: AuditableChatStates;
    private static STORAGE_KEY = 'chats';
    private static USER_ID = 'userId';

    constructor(chatId: string, currentState?: AuditableChatStates) {
        this.chatId = chatId;
        this.currentState = currentState || AuditableChatStates.IDLE;
    };

    static async updateState(chatId: string, incomingMessage: AuditableMessage): Promise<ChatState | undefined> {
        const auditableState = await AuditableChatStateMachine.getAuditable(chatId);
        const auditableChat = new AuditableChatStateMachine(chatId, auditableState?.currentState);

        switch (auditableChat.getCurrentState()) {
            case AuditableChatStates.IDLE:
                if (incomingMessage.content === AuditableChatOptions.REQUEST) {
                    const authorIsMe = (await AuditableChatStateMachine.getUserId()) === incomingMessage.author;
                    if (authorIsMe) {
                        auditableChat.currentState = AuditableChatStates.REQUEST_SENT;
                    } else {
                        auditableChat.currentState = AuditableChatStates.REQUEST_RECEIVED;
                    }
                }
                break;
            case AuditableChatStates.REQUEST_SENT:
                if (incomingMessage.content === AuditableChatOptions.ACCEPT) {
                    auditableChat.currentState = AuditableChatStates.ONGOING;
                    // Get last message id and store in storage.local
                }
                if (incomingMessage.content === AuditableChatOptions.DENY) auditableChat.currentState = AuditableChatStates.IDLE
                break;
            case AuditableChatStates.REQUEST_RECEIVED:
                if (incomingMessage.content === AuditableChatOptions.ACCEPT) {
                    auditableChat.currentState = AuditableChatStates.ONGOING;
                }
                if (incomingMessage.content === AuditableChatOptions.DENY) auditableChat.currentState = AuditableChatStates.IDLE
                break;
            case AuditableChatStates.ONGOING:
                if (incomingMessage.content === AuditableChatOptions.END) auditableChat.currentState = AuditableChatStates.IDLE
                break;
            default:
                throw new Error(`Unexpected State in conversation: ${auditableChat.currentState}`)
        }

        const stateChanged = auditableState?.currentState !== auditableChat.getCurrentState();
        if (!stateChanged) return undefined;
        const newChatState: ChatState = {
            ...auditableState,
            currentState: auditableChat.getCurrentState(),
        };
        await AuditableChatStateMachine.setAuditable(chatId, newChatState);
        return auditableState;
    }

    getCurrentState() {
        return this.currentState;
    }

    getCurrentChat() {
        return this.chatId;
    }

    static async retrieveSeed(chatId: string) {
        const currentAuditableState = await AuditableChatStateMachine.getAuditable(chatId);
        if (!currentAuditableState?.auditableChatReference) throw new Error(`No current auditable chat reference in chat with id: ${chatId}`);
        const messageId = currentAuditableState.auditableChatReference.currentAuditableChatInitId;

        const messageIdItems = messageId?.split("_");
        const itemsLength = messageIdItems?.length;
        if (!itemsLength) throw new Error("Auditable MessageId splited is empty.");
        const pureMessageId = messageIdItems[itemsLength - 1];
        if (!pureMessageId) throw new Error("Auditable MessageId not found.");

        return pureMessageId;
    }

    static async getAll(): Promise<Record<string, ChatState>> {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.STORAGE_KEY], (result) => {
                resolve(result[this.STORAGE_KEY] || {});
            });
        });
    }

    static async getAuditable(chatId: string): Promise<ChatState | undefined> {
        const chats = await this.getAll();
        return chats[chatId];
    }

    static async setAuditableStart(chatId: string, messageId: string, initialBlock: AuditableBlock): Promise<void> {
        const chat = await this.getAuditable(chatId);
        if (!chat) throw new Error("Trying to set the init Id in an unexistent chat.");

        const auditableChatReference: AuditableChatReference = {
            auditableMessagesCounter: 0,
            currentAuditableChatInitId: messageId,
            initialBlock
        }
        chat.auditableChatReference = auditableChatReference;

        console.log("Auditable Chat is now: ", chat);
        await this.setAuditable(chatId, chat);
    }

    static async increaseAuditableCounter(chatId: string): Promise<void> {
        const chat = await this.getAuditable(chatId);
        console.log("Chat before trying to increase: ", chat)
        if (!chat?.auditableChatReference) throw new Error("Auditable chat reference doesn't exist.");

        chat.auditableChatReference.auditableMessagesCounter += 1;
        await this.setAuditable(chatId, chat);
    }

    static async setAuditable(chatId: string, state: ChatState): Promise<void> {
        const chats = await this.getAll();
        chats[chatId] = state;
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.STORAGE_KEY]: chats }, () => resolve());
        });
    }

    static async setUserId(userId: string): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.USER_ID]: userId }, () => resolve());
        });
    }

    static async getUserId(): Promise<string | undefined> {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.USER_ID], (result) => {
                resolve(result[this.USER_ID]);
            });
        });
    }

    static async removeIdleChats(): Promise<void> {
        const chats = await this.getAll();
        Object.keys(chats).forEach(async (chatId) => {
            const auditableChatState = await AuditableChatStateMachine.getAuditable(chatId) as ChatState;
            const auditableState = auditableChatState.currentState;
            if (auditableState === AuditableChatStates.IDLE) await AuditableChatStateMachine.removeAuditable(chatId);
        });
    }

    static async removeAuditable(chatId: string): Promise<void> {
        const chats = await this.getAll();
        delete chats[chatId];
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.STORAGE_KEY]: chats }, () => resolve());
        });
    }

    static async removeAuditableChatReference(chatId: string): Promise<void> {
        const chats = await this.getAll();
        const chat = chats[chatId];
        delete chat?.auditableChatReference;
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.STORAGE_KEY]: chats }, () => resolve());
        });
    }

    static async removeAll(): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.remove(this.STORAGE_KEY, () => resolve());
        });
    }
}
