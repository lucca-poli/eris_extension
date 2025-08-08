import { assembleAgreeToDisagreeBlock } from "../back_utils/auditable_chat";
import { verificationRoutine } from "../core_utils/verify";
import { finishingAuditableChatRoutine } from "./finishing_routine";
import { AckMetadata, AuditableControlMessage, InternalAuditableChatVariables, AuditableChatStates, WhatsappMessage, ChatState, ActionOptions, InternalMessage, MetadataOptions, AuditableMetadata, GetMessages, PreviousHashes, AgreeToDisagreeMetadata, PreviousBlockVerificationData, PreviousData } from "./types";

// Returns WhatsappMessage[] with the last received message being the first element
async function fetchLastMessages(chatId: string, count: number) {
    const getMessages: GetMessages = {
        chatId,
        options: {
            count,
        }
    };
    const whatsappMessages: WhatsappMessage[] = await chrome.runtime.sendMessage({
        action: ActionOptions.GET_MESSAGES,
        payload: getMessages
    } as InternalMessage);

    return whatsappMessages.reverse(); // Reversed to ensure last received message comes first
}

// returns undefined if not found and the hash of the root if found
function searchCollidedInBatch(whatsappMessages: WhatsappMessage[]): string | undefined {
    const auditableMessages = whatsappMessages.filter((whatsappMessage) => whatsappMessage.metadata?.kind === MetadataOptions.AUDITABLE);
    const registeredMessagesPreviousHashes = new Set<string>();

    for (const auditableMessage of auditableMessages) {
        const previousHash = (auditableMessage.metadata as AuditableMetadata).block.previousHash;

        if (registeredMessagesPreviousHashes.has(previousHash)) return previousHash;
        registeredMessagesPreviousHashes.add(previousHash);
    }

    return undefined;
}

// Return a WhatsappMessage[] with the last element being the root of the collision
async function getCollidedMessages(chatId: string) {
    let numMessagesToSearch = 4; // Arbitrary number
    let collisionRootHash = undefined;

    while (!collisionRootHash) {
        const whatsappMessages = await fetchLastMessages(chatId, numMessagesToSearch);
        let collisionRootHash = searchCollidedInBatch(whatsappMessages);
        if (numMessagesToSearch >= 100) throw new Error("Too many messages in collision. Aborting operation.");
        if (!collisionRootHash) numMessagesToSearch += 2;
    }

    const whatsappMessages = await fetchLastMessages(chatId, numMessagesToSearch);
    const indexOfCollision = whatsappMessages
        .filter((whatsappMessage) => whatsappMessage.metadata?.kind === MetadataOptions.AUDITABLE)
        .map((auditableMessage) => (auditableMessage.metadata as AuditableMetadata).block.hash)
        .findIndex((blockHash) => blockHash === collisionRootHash);

    return whatsappMessages.slice(0, indexOfCollision + 1);
}

export class AuditableChatStateMachine {
    private chatId: string;
    private currentState: AuditableChatStates;
    private static STORAGE_KEY = 'chats';
    private static USER_ID = 'userId';

    constructor(chatId: string, currentState?: AuditableChatStates) {
        this.chatId = chatId;
        this.currentState = currentState || AuditableChatStates.IDLE;
    };

    static async updateState(chatId: string, incomingMessage: WhatsappMessage, options?: { messageId?: string, seed?: string }) {
        const auditableState = await AuditableChatStateMachine.getAuditableChat(chatId);
        const auditableChat = new AuditableChatStateMachine(chatId, auditableState?.currentState);
        const internalVariables = (await AuditableChatStateMachine.getAuditableChat(chatId))?.internalAuditableChatVariables;

        console.log("incomingMessage: ", incomingMessage);
        const metadataIsAck = incomingMessage.metadata?.kind === MetadataOptions.ACK;
        console.log("Is ack: ", metadataIsAck);
        const metadataIsAuditable = incomingMessage.metadata?.kind === MetadataOptions.AUDITABLE;
        console.log("Is auditableMessage: ", metadataIsAuditable);
        const messageIsOfExpectedType = metadataIsAuditable || metadataIsAck;
        const agreeToDisagreeAtempt = auditableState?.internalAuditableChatVariables?.agreeToDisagreeAtempt;

        switch (auditableChat.getCurrentState()) {
            case AuditableChatStates.IDLE:
                if (incomingMessage.content === AuditableControlMessage.REQUEST) {
                    const authorIsMe = (await AuditableChatStateMachine.getUserId()) === incomingMessage.author;
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
                        } as WhatsappMessage
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

                if (!metadataIsAck && incomingMessage.author !== chatId) auditableChat.currentState = AuditableChatStates.WAITING_ACK;

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
                        } as WhatsappMessage
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
                const messageIsFromPartner = incomingMessage.author === incomingMessage.chatId;
                if (!metadataIsAck && messageIsFromPartner) throw new Error("Message arrived instead of ACK, should start AtD Block.");
                if (metadataIsAuditable && messageIsFromPartner && !agreeToDisagreeAtempt) {
                    // 1. Aquire messages until the root of disagreement (should also change how the verifying is done, based on aquired messages)
                    const collidedMessages = await getCollidedMessages(chatId);
                    const collisionMessage = collidedMessages[collidedMessages.length - 1];
                    // 2. Verify coeherence based on the root of disagreement (a bit slow now because rechecks for every new attempt)
                    collidedMessages.forEach(async (auditableMessage, index) => {
                        if (index === collidedMessages.length - 1) return;
                        const previousHash = (auditableMessage.metadata as AuditableMetadata).block.previousHash;
                        const previousBlock = collidedMessages
                            .map((message) => (message.metadata as AuditableMetadata).block)
                            .find((auditableBlock) => auditableBlock.hash === previousHash);
                        await verificationRoutine(chatId, incomingMessage, false, previousBlock);
                    });
                    // 3. Assemble/Create AtD metadata
                    const userId = await AuditableChatStateMachine.getUserId();
                    if (!userId) throw new Error("User number not found");
                    const lastUserMessage = collidedMessages.filter((auditableMessage) => auditableMessage.author === userId);
                    const lastUserData: PreviousBlockVerificationData = {
                        previousHash: (lastUserMessage[0].metadata as AuditableMetadata).block.hash,
                        counter: (lastUserMessage[0].metadata as AuditableMetadata).block.counter,
                    };
                    const lastCounterpartMessage = collidedMessages.filter((auditableMessage) => auditableMessage.author !== userId);
                    const lastCounterpartData: PreviousBlockVerificationData = {
                        previousHash: (lastCounterpartMessage[0].metadata as AuditableMetadata).block.hash,
                        counter: (lastCounterpartMessage[0].metadata as AuditableMetadata).block.counter,
                    };
                    if (lastUserMessage.length === 0 || lastCounterpartMessage.length === 0) throw new Error("Both parties should have at least one message.");
                    const previousData: PreviousData = {
                        user: lastUserData,
                        counterpart: lastCounterpartData
                    };
                    const newCounter = (collisionMessage.metadata as AuditableMetadata).block.counter + collidedMessages.length;
                    const agreeToDisagreeBlock = await assembleAgreeToDisagreeBlock(previousData, newCounter);
                    const agreeToDisagreeMetadata: AgreeToDisagreeMetadata = {
                        kind: MetadataOptions.AGREE_TO_DISAGREE,
                        block: agreeToDisagreeBlock,
                        disagreeRoot: collisionMessage
                    };
                    // 4. Store it on memory
                    if (!internalVariables) throw new Error("No internal variables found.");
                    internalVariables.agreeToDisagreeAtempt = agreeToDisagreeMetadata;
                    // 5. Send this AtD attempt on chat
                    await chrome.runtime.sendMessage({
                        action: ActionOptions.SEND_TEXT_MESSAGE,
                        payload: {
                            content: AuditableControlMessage.AGREE_TO_DISAGREE_ATTEMPT,
                            chatId,
                            author: await AuditableChatStateMachine.getUserId(),
                            metadata: agreeToDisagreeMetadata
                        } as WhatsappMessage
                    } as InternalMessage);
                }
                if (agreeToDisagreeAtempt) {
                    if (incomingMessage.metadata === agreeToDisagreeAtempt) {
                        // 1. Update counter and previous_hash on memory based on conclusion AtD Block
                        if (!internalVariables) throw new Error("No internal variables found.");
                        if (!internalVariables.agreeToDisagreeAtempt) throw new Error("No AtD attempt found.");
                        internalVariables.counter = internalVariables.agreeToDisagreeAtempt.block.counter + 1;
                        internalVariables.previousHash = internalVariables.agreeToDisagreeAtempt.block.hash;
                        // 2. Delete AtD attempt from memory
                        delete internalVariables.agreeToDisagreeAtempt;
                        // 3. Change state to ONGOING
                        auditableChat.currentState = AuditableChatStates.ONGOING;
                        // 4. Send confirmation in chat
                        await chrome.runtime.sendMessage({
                            action: ActionOptions.SEND_TEXT_MESSAGE,
                            payload: {
                                content: AuditableControlMessage.AGREE_TO_DISAGREE_RESOLVE,
                                chatId,
                                author: await AuditableChatStateMachine.getUserId(),
                                metadata: internalVariables.agreeToDisagreeAtempt
                            } as WhatsappMessage
                        } as InternalMessage);
                    } else if (metadataIsAuditable) {
                        // 1. Verify coeherence based on previous hashes and counters in the AtD block
                        if (!internalVariables?.agreeToDisagreeAtempt) throw new Error("No AtD attempt found.");
                        // Assuming that if a new block arrives it's for sure from the counterpart
                        const previousData: PreviousBlockVerificationData = {
                            previousHash: internalVariables.agreeToDisagreeAtempt.block.previousData.counterpart.previousHash,
                            counter: internalVariables.agreeToDisagreeAtempt.block.previousData.counterpart.counter
                        }
                        await verificationRoutine(chatId, incomingMessage, false, previousData);
                        // 2. Update AtD block based on message received and store it on memory
                        internalVariables.agreeToDisagreeAtempt.block.counter += 1;
                        // internalVariables.agreeToDisagreeAtempt.block.hash = generateAgreeToDisagreeHash();
                        internalVariables.agreeToDisagreeAtempt.block.previousData.counterpart = {
                            previousHash: (incomingMessage.metadata as AuditableMetadata).block.hash,
                            counter: (incomingMessage.metadata as AuditableMetadata).block.counter
                        };
                        // 3. Send this AtD attempt on chat
                        await chrome.runtime.sendMessage({
                            action: ActionOptions.SEND_TEXT_MESSAGE,
                            payload: {
                                content: AuditableControlMessage.AGREE_TO_DISAGREE_ATTEMPT,
                                chatId,
                                author: await AuditableChatStateMachine.getUserId(),
                                metadata: internalVariables.agreeToDisagreeAtempt
                            } as WhatsappMessage
                        } as InternalMessage);
                    } else {
                        break;
                    }
                }
                const ack = incomingMessage.metadata as AckMetadata;
                console.log("Ack received!", ack);
                console.log("internal state: ", auditableState?.internalAuditableChatVariables);
                if (!internalCounter) throw new Error("No internal counter present.");
                if (ack.counter + 1 > internalCounter) throw new Error("Messages arrived out of order.");
                // If the ack counter is less than the internal counter, should keep at WAITING_ACK state

                // TODO: Include signature verifying in the future

                if (ack.counter + 1 === internalCounter) auditableChat.currentState = AuditableChatStates.ONGOING;
                break;
            default:
                throw new Error(`Unexpected State in conversation: ${auditableChat.currentState}`)
        }

        const stateChanged = auditableState?.currentState !== auditableChat.getCurrentState();
        if (!stateChanged) return undefined;
        const newChatState: ChatState = {
            internalAuditableChatVariables: internalVariables,
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
