import { AuditableChatOptions, AuditableChatStates, ChatMessageV2, ChatState } from "./types";

export class AuditableChatStateMachine {
    private chatId: string;
    private currentState: AuditableChatStates;
    private static STORAGE_KEY = 'chats';

    constructor(chatId: string, currentState?: AuditableChatStates) {
        this.chatId = chatId;
        this.currentState = currentState || AuditableChatStates.IDLE;
    };

    static async updateState(chatId: string, incomingMessage: ChatMessageV2) {
        const auditableChat = await AuditableChatStateMachine.getAuditable(chatId);
        if (!auditableChat) throw new Error("Auditable chat not in memory.");

        switch (auditableChat.currentState) {
            case AuditableChatStates.IDLE:
                if (incomingMessage.content === AuditableChatOptions.REQUEST) {
                    if (incomingMessage.authorIsMe) {
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

        await AuditableChatStateMachine.setAuditable(chatId, auditableChat);

        return auditableChat;
    }

    getCurrentState() {
        return this.currentState;
    }

    getCurrentChat() {
        return this.chatId;
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

    static async setAuditableStart(chatId: string, messageId: string): Promise<void> {
        const chat = await this.getAuditable(chatId);
        if (!chat) throw new Error("Trying to set the init Id in an unexistent chat.");

        chat.currentAuditableChatInitId = messageId;
        chat.auditableMessagesCounter = 0;
        console.log("Auditable Chat is now: ", chat);
        await this.setAuditable(chatId, chat);
    }

    static async increaseAuditableCounter(chatId: string): Promise<void> {
        const chat = await this.getAuditable(chatId);
        console.log("Chat before trying to increase: ", chat)
        if (!chat) throw new Error("Trying to set the init Id in an unexistent chat.");
        if (chat.auditableMessagesCounter === undefined) throw new Error("Trying to increase an unexistent chat.");

        chat.auditableMessagesCounter = chat.auditableMessagesCounter + 1;
        await this.setAuditable(chatId, chat);
    }

    static async setAuditable(chatId: string, state: ChatState): Promise<void> {
        const chats = await this.getAll();
        chats[chatId] = state;
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.STORAGE_KEY]: chats }, () => resolve());
        });
    }

    static async removeAuditable(chatId: string): Promise<void> {
        const chats = await this.getAll();
        delete chats[chatId];
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
