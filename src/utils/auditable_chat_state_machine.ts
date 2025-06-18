import { AckMetadata, AckMetadataSchema, AuditableChatOptions, AuditableChatReference, AuditableChatStates, AuditableMessage, ChatState } from "./types";

export class AuditableChatStateMachine {
    private chatId: string;
    private currentState: AuditableChatStates;
    private static STORAGE_KEY = 'chats';
    private static USER_ID = 'userId';

    constructor(chatId: string, currentState?: AuditableChatStates) {
        this.chatId = chatId;
        this.currentState = currentState || AuditableChatStates.IDLE;
    };

    static async updateState(chatId: string, incomingMessage: AuditableMessage | AckMetadata, seed?: string) {
        const auditableState = await AuditableChatStateMachine.getAuditable(chatId);
        const auditableChat = new AuditableChatStateMachine(chatId, auditableState?.currentState);

        const ackMetadata = AckMetadataSchema.safeParse(incomingMessage);

        switch (auditableChat.getCurrentState()) {
            case AuditableChatStates.IDLE:
                if (incomingMessage.content === AuditableChatOptions.REQUEST) {
                    const authorIsMe = (await AuditableChatStateMachine.getUserId()) === (incomingMessage as AuditableMessage).author;
                    if (authorIsMe) {
                        auditableChat.currentState = AuditableChatStates.REQUEST_SENT;
                    } else {
                        auditableChat.currentState = AuditableChatStates.REQUEST_RECEIVED;
                    }
                }
                break;
            case AuditableChatStates.REQUEST_SENT:
                if (incomingMessage.content === AuditableChatOptions.ACCEPT) {
                    console.log("Seed arrived: ", seed)
                    if (!seed) {
                        console.error("Acceptation message: ", incomingMessage);
                        throw new Error("Seed not sent in acceptation message.");
                    }
                    await AuditableChatStateMachine.setAuditableStart(chatId, seed);

                    auditableChat.currentState = AuditableChatStates.ONGOING;
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
                if (incomingMessage.content === AuditableChatOptions.END) {
                    await AuditableChatStateMachine.removeAuditableChatReference(chatId);
                    auditableChat.currentState = AuditableChatStates.IDLE;
                    break;
                }

                if (!ackMetadata.success && (incomingMessage as AuditableMessage).author !== chatId) auditableChat.currentState = AuditableChatStates.WAITING_ACK;

                break;
            case AuditableChatStates.WAITING_ACK:
                const internalCounter = auditableState?.auditableChatReference?.counter;
                if (!ackMetadata.success) throw new Error("Message arrived instead of ACK, should start AtD Block.");
                if (!internalCounter) throw new Error("No internal counter present.");
                if (ackMetadata.data.counter > internalCounter) throw new Error("Messages arrived out of order.");
                // If the ack counter is less than the internal counter, should keep at WAITING_ACK state

                // TODO: Include signature verifying in the future

                if (ackMetadata.data.counter === internalCounter) auditableChat.currentState = AuditableChatStates.ONGOING;
                break;
            default:
                throw new Error(`Unexpected State in conversation: ${auditableChat.currentState}`)
        }

        const stateChanged = auditableState?.currentState !== auditableChat.getCurrentState();
        if (!stateChanged) return undefined;
        const newChatState: ChatState = {
            auditableChatReference: (await AuditableChatStateMachine.getAuditable(chatId))?.auditableChatReference,
            currentState: auditableChat.getCurrentState(),
        };
        await AuditableChatStateMachine.setAuditable(chatId, newChatState);
        return newChatState;
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

    static async setAuditableStart(chatId: string, seed: string): Promise<ChatState> {
        const chat = await this.getAuditable(chatId);
        if (!chat) throw new Error("Trying to set the init Id in an unexistent chat.");

        const auditableChatReference: AuditableChatReference = {
            counter: 0,
            previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
            auditableChatSeed: seed,
        };
        chat.auditableChatReference = auditableChatReference;

        console.log("Auditable Chat is now: ", chat);
        await this.setAuditable(chatId, chat);

        return chat
    }

    static async updateAuditableChatState(chatId: string, newHashReference: string): Promise<void> {
        const chat = await this.getAuditable(chatId);
        if (!chat) throw new Error("Trying to get an unexistent chat.");

        const chatInternalState = chat.auditableChatReference;
        if (!chatInternalState) throw new Error("Chat has no internal state initialized.");
        console.log("State before updating", chatInternalState);

        chatInternalState.counter += 1;
        chatInternalState.previousHash = newHashReference;

        await this.setAuditable(chatId, {
            currentState: chat.currentState,
            auditableChatReference: chatInternalState
        });
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
