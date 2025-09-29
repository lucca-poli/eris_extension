import { AuditableChatStateMachine } from "../utils/auditable_chat_state_machine";
import {
    AgreeToDisagreeBlock,
    AgreeToDisagreeHashArgs,
    AssymetricKeys,
    AuditableBlock,
    AuditableChatMetadata,
    AuditableMessageContent,
    BlockState,
    CommitArgs,
    HashArgs,
    PreviousData,
    PRFArgs,
    RandomSeedSalt
} from "../utils/types";

export async function generateKeys(): Promise<AssymetricKeys> {
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
    /* extractable= */ true,
        ['sign', 'verify']
    );

    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    const userKeys = {
        publicKey: publicJwk,
        privateKey: privateJwk
    }

    return userKeys
}

export async function getPublicKey(): Promise<CryptoKey | undefined> {
    const publicJwk = (await chrome.storage.local.get(['PUBLIC_KEY']))['PUBLIC_KEY'];
    if (!publicJwk) return undefined;

    const publicKey = await crypto.subtle.importKey(
        'jwk', publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
    );

    return publicKey;
}

export async function getPrivateKey(): Promise<CryptoKey | undefined> {
    const { privateJwk } = (await chrome.storage.local.get(['PRIVATE_KEY']))['PRIVATE_KEY'];
    if (!privateJwk) return undefined;

    const privateKey = await crypto.subtle.importKey(
        'jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
    );

    return privateKey;
}

export async function assembleAgreeToDisagreeBlock(previousData: PreviousData, counter: number): Promise<AgreeToDisagreeBlock> {
    const sortedEntries = Array.from(previousData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const sortedObject = Object.fromEntries(sortedEntries);

    const hashArgs: AgreeToDisagreeHashArgs = {
        previousData: sortedObject,
        counter,
    };
    console.log("hashArgs: ", hashArgs);
    const newHash = await hashFunction(hashArgs);

    return {
        hash: newHash,
        previousData: sortedObject,
        counter,
    } as AgreeToDisagreeBlock;
}

export const STORAGE_KEY = 'chats';

export async function generateAuditableSeed(chatId: string): Promise<string> {
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

export async function generateCommitedMessage(chatId: string, messageToProcess: AuditableMessageContent | AuditableChatMetadata, counter: number) {
    const auditableState = await AuditableChatStateMachine.getAuditableChat(chatId);
    if (!auditableState?.internalAuditableChatVariables) throw new Error("Internal state for this chat ended earlier than expected.");
    const seed = auditableState.internalAuditableChatVariables?.auditableChatSeed;

    const commitedKeyArgs: PRFArgs = {
        seed,
        counter
    };
    console.log("commitedKeyArgs: ", commitedKeyArgs);
    const commitedKey = await prf(commitedKeyArgs);

    const commitedMessageArgs: CommitArgs = {
        commitedKey,
        message: JSON.stringify(messageToProcess)
    };
    console.log("commitedMessageArgs: ", commitedMessageArgs);
    const commitedMessage = await commitFunction(commitedMessageArgs);

    return commitedMessage
}

export async function generateBlock(commitedMessage: string, previousBlockState: BlockState) {
    const { hash, counter } = previousBlockState;

    const hashArgs: HashArgs = {
        previousHash: hash,
        counter,
        commitedMessage
    };
    const newHash = await hashFunction(hashArgs);

    return {
        hash: newHash,
        previousHash: hash,
        counter,
        commitedMessage
    } as AuditableBlock;
}

export async function commitFunction(args: CommitArgs) {
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

export async function hashFunction(args: HashArgs | AgreeToDisagreeHashArgs) {
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

export async function prf(args: PRFArgs): Promise<string> {
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

