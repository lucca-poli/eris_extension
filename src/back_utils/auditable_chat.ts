import { AuditableChatStateMachine } from "../utils/auditable_chat_state_machine";
import { getChatMessages } from "../utils/chrome_lib";
import { AuditableBlock, AuditableChatOptions, AuditableMessageContent, CommitArgs, HashArgs, PRFArgs, RandomSeedSalt } from "../utils/types";

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

    static async #generateAuditableSeed(chatId: string): Promise<string> {
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


    static async generateInitBlock(chatId: string): Promise<AuditableBlock> {
        const initCounter = 0;
        const seed = await AuditableChat.#generateAuditableSeed(chatId);
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

    static async #getPreviousMessage(tabId: number, chatId: string) {
        const lastMessage = (await getChatMessages(tabId, chatId, { count: 1 }))[0];
        if (!lastMessage) throw new Error("No message available");
        return lastMessage;
    }

    static async generateNewBlock(tabId: number, chatId: string, messageToProcess: AuditableMessageContent) {
        const lastMessage = await AuditableChat.#getPreviousMessage(tabId, chatId);
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

