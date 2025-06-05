import { AuditableChatStateMachine } from "../utils/auditable_chat_state_machine";
import { AuditableBlock, AuditableChatMetadata, AuditableMessageContent, BlockState, CommitArgs, HashArgs, PRFArgs, RandomSeedSalt } from "../utils/types";

export class AuditableChat {
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

    static async generateAuditableSeed(chatId: string): Promise<string> {
        const userId = await AuditableChatStateMachine.getUserId();
        if (!userId) throw new Error("No userId found.");

        const seedSaltObject: RandomSeedSalt = {
            currentTime: Date.now(),
            chatId,
            userId,
        };
        const seedSalt = JSON.stringify(seedSaltObject);

        const encoder = new TextEncoder();
        const data = encoder.encode(seedSalt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hashBuffer);

        // Convert to a number seed (32-bit)
        const randomNumber = (hashArray[0] << 24) | (hashArray[1] << 16) | (hashArray[2] << 8) | hashArray[3];
        const length = 8;
        const seed = randomNumber.toString(16).padStart(length, '0');
        return (seed.charAt(0) === '-') ? seed.slice(1) : seed; // Convert to unsigned 32-bit integer
    }

    static async generateCommitedMessage(chatId: string, messageToProcess: AuditableMessageContent | AuditableChatMetadata, counter: number) {
        const auditableState = await AuditableChatStateMachine.getAuditable(chatId);
        if (!auditableState?.auditableChatReference) throw new Error("Internal state for this chat ended earlier than expected.");
        const seed = auditableState.auditableChatReference?.auditableChatSeed;

        const commitedKeyArgs: PRFArgs = {
            seed,
            counter
        };
        console.log("commitedKeyArgs: ", commitedKeyArgs);
        const commitedKey = await AuditableChat.prf(commitedKeyArgs);

        const commitedMessageArgs: CommitArgs = {
            commitedKey,
            message: JSON.stringify(messageToProcess)
        };
        console.log("commitedMessageArgs: ", commitedMessageArgs);
        const commitedMessage = await AuditableChat.#commitFunction(commitedMessageArgs);

        return commitedMessage
    }

    static async generateBlock(commitedMessage: string, previousBlockState: BlockState) {
        const { hash, counter } = previousBlockState;
        const updatedCounter = counter + 1;

        const hashArgs: HashArgs = {
            previousHash: hash,
            counter: updatedCounter,
            commitedMessage
        };
        console.log("hashArgs: ", hashArgs);
        const newHash = await AuditableChat.#hashFunction(hashArgs);

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

