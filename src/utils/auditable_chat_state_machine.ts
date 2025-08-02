import { finishingAuditableChatRoutine } from "./finishing_routine";
import { AckMetadata, AckMetadataSchema, AuditableControlMessage, InternalAuditableChatVariables, AuditableChatStates, AuditableMessage, ChatState, AuditableMessageMetadataSchema, ActionOptions, InternalMessage } from "./types";

export class AuditableChatStateMachine {
    private chatId: string;
    private currentState: AuditableChatStates;
    private static STORAGE_KEY = 'chats';
    private static USER_ID = 'userId';

    constructor(chatId: string, currentState?: AuditableChatStates) {
        this.chatId = chatId;
        this.currentState = currentState || AuditableChatStates.IDLE;
    };

    static async updateState(chatId: string, incomingMessage: AuditableMessage | AckMetadata, options?: { messageId?: string, seed?: string }) {
        const auditableState = await AuditableChatStateMachine.getAuditableChat(chatId);
        const auditableChat = new AuditableChatStateMachine(chatId, auditableState?.currentState);

        console.log("incomingMessage: ", incomingMessage);
        const ackMetadata = AckMetadataSchema.safeParse(incomingMessage);
        console.log("Is ack: ", ackMetadata.success);
        const auditableMessageMetadata = AuditableMessageMetadataSchema.safeParse((incomingMessage as AuditableMessage).metadata);
        console.log("Is auditableMessage: ", auditableMessageMetadata.success);
        const messageIsOfExpectedType = auditableMessageMetadata.success || ackMetadata.success;

        switch (auditableChat.getCurrentState()) {
            case AuditableChatStates.IDLE:
                if (incomingMessage.content === AuditableControlMessage.REQUEST) {
                    const authorIsMe = (await AuditableChatStateMachine.getUserId()) === (incomingMessage as AuditableMessage).author;
                    if (authorIsMe) {
                        auditableChat.currentState = AuditableChatStates.REQUEST_SENT;
                    } else {
                        auditableChat.currentState = AuditableChatStates.REQUEST_RECEIVED;
                    }
                }
                break;
            case AuditableChatStates.REQUEST_SENT:
                if (incomingMessage.content === AuditableControlMessage.ACCEPT) {
                    console.log("Seed arrived: ", options?.seed)
                    if (!options?.seed) {
                        console.error("Acceptation message: ", incomingMessage);
                        throw new Error("Seed not sent in acceptation message. 1");
                    }
                    await AuditableChatStateMachine.setAuditableChatStart(chatId, options.seed);

                    auditableChat.currentState = AuditableChatStates.ONGOING;
                }
                if (incomingMessage.content === AuditableControlMessage.DENY || incomingMessage.content === AuditableControlMessage.CANCEL) auditableChat.currentState = AuditableChatStates.IDLE
                break;
            case AuditableChatStates.REQUEST_RECEIVED:
                if (incomingMessage.content === AuditableControlMessage.ACCEPT) {
                    auditableChat.currentState = AuditableChatStates.ONGOING;
                }
                if (incomingMessage.content === AuditableControlMessage.DENY || incomingMessage.content === AuditableControlMessage.CANCEL) auditableChat.currentState = AuditableChatStates.IDLE
                break;
            case AuditableChatStates.ONGOING:
                if (incomingMessage.content === AuditableControlMessage.END || incomingMessage.content === AuditableControlMessage.ABORT) {
                    await AuditableChatStateMachine.removeAuditableChatReference(chatId);
                    auditableChat.currentState = AuditableChatStates.IDLE;
                    break;
                }

                if (!messageIsOfExpectedType) {
                    const counter = auditableState?.internalAuditableChatVariables?.counter;
                    if (!counter) throw new Error("No chat counter found.");
                    if (!options?.seed) throw new Error("Seed not sent in acceptation message. 2");
                    if (!options?.messageId) throw new Error("MessageId not sent in acceptation message.");

                    await chrome.runtime.sendMessage({
                        action: ActionOptions.SEND_TEXT_MESSAGE,
                        payload: {
                            content: AuditableControlMessage.ABORT,
                            chatId,
                            author: await AuditableChatStateMachine.getUserId()
                        } as AuditableMessage
                    } as InternalMessage);

                    await finishingAuditableChatRoutine(
                        chatId,
                        options.seed,
                        options.messageId,
                        counter * 2
                    );

                    await AuditableChatStateMachine.removeAuditableChatReference(chatId);
                    auditableChat.currentState = AuditableChatStates.IDLE;
                    break;
                }

                if (!ackMetadata.success && (incomingMessage as AuditableMessage).author !== chatId) auditableChat.currentState = AuditableChatStates.WAITING_ACK;

                break;
            case AuditableChatStates.WAITING_ACK:
                if (incomingMessage.content === AuditableControlMessage.END || incomingMessage.content === AuditableControlMessage.ABORT) {
                    await AuditableChatStateMachine.removeAuditableChatReference(chatId);
                    auditableChat.currentState = AuditableChatStates.IDLE;
                    break;
                }

                if (!messageIsOfExpectedType) {
                    const counter = auditableState?.internalAuditableChatVariables?.counter;
                    if (!counter) throw new Error("No chat counter found.");
                    if (!options?.seed) throw new Error("Seed not sent in acceptation message. 3");
                    if (!options?.messageId) throw new Error("MessageId not sent in acceptation message.");

                    await chrome.runtime.sendMessage({
                        action: ActionOptions.SEND_TEXT_MESSAGE,
                        payload: {
                            content: AuditableControlMessage.ABORT,
                            chatId,
                            author: await AuditableChatStateMachine.getUserId()
                        } as AuditableMessage
                    } as InternalMessage);

                    await finishingAuditableChatRoutine(
                        chatId,
                        options.seed,
                        options.messageId,
                        counter * 2
                    );

                    await AuditableChatStateMachine.removeAuditableChatReference(chatId);
                    auditableChat.currentState = AuditableChatStates.IDLE;
                    break;
                }

                const internalCounter = auditableState?.internalAuditableChatVariables?.counter;
                if (!ackMetadata.success && (incomingMessage as AuditableMessage).author === (incomingMessage as AuditableMessage).chatId) throw new Error("Message arrived instead of ACK, should start AtD Block.");
                console.log("Ack received!", ackMetadata.data);
                console.log("internal state: ", auditableState?.internalAuditableChatVariables);
                if (!internalCounter) throw new Error("No internal counter present.");
                if (ackMetadata.success && ackMetadata.data.counter + 1 > internalCounter) throw new Error("Messages arrived out of order.");
                // If the ack counter is less than the internal counter, should keep at WAITING_ACK state

                // TODO: Include signature verifying in the future

                if (ackMetadata.success && ackMetadata.data.counter + 1 === internalCounter) auditableChat.currentState = AuditableChatStates.ONGOING;
                break;
            default:
                throw new Error(`Unexpected State in conversation: ${auditableChat.currentState}`)
        }

        const stateChanged = auditableState?.currentState !== auditableChat.getCurrentState();
        if (!stateChanged) return undefined;
        const newChatState: ChatState = {
            internalAuditableChatVariables: (await AuditableChatStateMachine.getAuditableChat(chatId))?.internalAuditableChatVariables,
            currentState: auditableChat.getCurrentState(),
        };
        await AuditableChatStateMachine.setAuditableChat(chatId, newChatState);
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

    static async getAuditableChat(chatId: string): Promise<ChatState | undefined> {
        const chats = await this.getAll();
        return chats[chatId];
    }

    static async setAuditableChatStart(chatId: string, seed: string): Promise<ChatState> {
        const chat = await this.getAuditableChat(chatId);
        if (!chat) throw new Error("Trying to set the init Id in an unexistent chat.");

        const internalAuditableChatVariables: InternalAuditableChatVariables = {
            counter: 0,
            previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
            auditableChatSeed: seed,
        };
        chat.internalAuditableChatVariables = internalAuditableChatVariables;

        console.log("Auditable Chat is now: ", chat);
        await this.setAuditableChat(chatId, chat);

        return chat
    }

    static async updateAuditableChatState(chatId: string, newHashReference: string): Promise<void> {
        const chat = await this.getAuditableChat(chatId);
        if (!chat) throw new Error("Trying to get an unexistent chat.");

        const chatInternalState = chat.internalAuditableChatVariables;
        if (!chatInternalState) throw new Error("Chat has no internal state initialized.");
        console.log("State before updating", chatInternalState);

        chatInternalState.counter += 1;
        chatInternalState.previousHash = newHashReference;

        await this.setAuditableChat(chatId, {
            currentState: chat.currentState,
            internalAuditableChatVariables: chatInternalState
        });
    }

    static async setAuditableChat(chatId: string, state: ChatState): Promise<void> {
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
            const auditableChatState = await AuditableChatStateMachine.getAuditableChat(chatId) as ChatState;
            const auditableState = auditableChatState.currentState;
            if (auditableState === AuditableChatStates.IDLE) await AuditableChatStateMachine.removeAuditableChat(chatId);
        });
    }

    static async removeAuditableChat(chatId: string): Promise<void> {
        const chats = await this.getAll();
        delete chats[chatId];
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.STORAGE_KEY]: chats }, () => resolve());
        });
    }

    static async removeAuditableChatReference(chatId: string): Promise<void> {
        const chats = await this.getAll();
        const chat = chats[chatId];
        delete chat?.internalAuditableChatVariables;
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.STORAGE_KEY]: chats }, () => resolve());
        });
    }

    static async removeAllChats(): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.remove(this.STORAGE_KEY, () => resolve());
        });
    }
}
