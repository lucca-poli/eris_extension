import { z } from "zod/v4"

export enum ActionOptions {
    PROPAGATE_NEW_CHAT = "PROPAGATE_NEW_CHAT",
    PROPAGATE_NEW_MESSAGE = "PROPAGATE_NEW_MESSAGE",
    GENERATE_AND_SEND_BLOCK = "GENERATE_AND_SEND_BLOCK",
    GET_MESSAGES = "GET_MESSAGES",
    GET_COMMITED_KEYS = "GET_COMMITED_KEYS",
    SET_INPUT_BOX = "SET_INPUT_BOX",
    SEND_TEXT_MESSAGE = "SEND_TEXT_MESSAGE",
    SEND_FILE_MESSAGE = "SEND_FILE_MESSAGE",
    PROCESS_AUDITABLE_MESSAGE = "PROCESS_AUDITABLE_MESSAGE",
    DEBUG = "DEBUG"
};

export enum AuditableControlMessage {
    REQUEST = "[Control Message]\nRequesting secure conversation.",
    CANCEL = "[Control Message]\nCancelling request of secure conversation.",
    ACCEPT = "[Control Message]\nSecure conversation accepted.",
    DENY = "[Control Message]\nSecure conversation denied.",
    END = "[Control Message]\nSecure conversation ended. Logs available below.",
    ABORT = "[Control Message]\nError in secure conversation, ending chat. Logs available below.",
    ACK = "[Control Message]\nConfirmation ACK sent."
};

export enum AuditableChatStates {
    REQUEST_SENT = "REQUEST_SENT",
    REQUEST_RECEIVED = "REQUEST_RECEIVED",
    ONGOING = "ONGOING",
    WAITING_ACK = "WAITING_ACK",
    IDLE = "IDLE"
};

export type InternalMessage = {
    action: ActionOptions,
    payload?: any
}

export type ChatState = {
    currentState: AuditableChatStates,
    internalAuditableChatVariables?: InternalAuditableChatVariables
}

export type InternalAuditableChatVariables = {
    auditableChatSeed: string;
    counter: number;
    previousHash: string;
}

export type SendFileMessage = {
    chatId: string;
    fileContent: string;
    fileName: string;
}

export type GetMessagesOptions = {
    count?: number;
    direction?: "after" | "before";
    id?: string;
}

export type GetMessages = {
    chatId: string,
    options: GetMessagesOptions
}

export type AuditableMessage = {
    chatId: string;
    messageId?: string;
    content?: string;
    author: string;
    metadata?: AuditableMessageMetadata;
    timestamp?: number;
}

export type AuditableMessageContent = {
    content: string;
    author: string;
}

export type GenerateAuditableMessage = {
    auditableMessage: AuditableMessage;
    startingMessage: boolean;
}

export type AuditableChatMetadata = {
    timestamp: string;
}

export type AuditableBlock = {
    hash: string,
    previousHash: string,
    counter: number,
    commitedMessage: string
}

export type AuditableMessageMetadata = {
    block: AuditableBlock;
    seed?: string;
}

export const AuditableBlockSchema = z.object({
    hash: z.string(),
    previousHash: z.string(),
    counter: z.number(),
    commitedMessage: z.string()
});

export const AuditableMessageMetadataSchema = z.object({
    block: AuditableBlockSchema,
    seed: z.string().optional()
});

export type AckMetadata = {
    blockHash: string;
    counter: number;
    sender: string;
    receiver: string;
    content: AuditableControlMessage;
}

export const AuditableChatOptionsSchema = z.enum(AuditableControlMessage);

export const AckMetadataSchema = z.object({
    blockHash: z.string(),
    counter: z.number(),
    sender: z.string(),
    receiver: z.string(),
    content: AuditableChatOptionsSchema
});

export type BlockState = {
    hash: string;
    counter: number;
}

export type PRFArgs = {
    seed: string;
    counter: number;
}

export type RandomSeedSalt = {
    chatId: string,
    userId: string,
    currentTime: number
}

export type GetCommitedKeys = {
    seed: string;
    counters: number[];
}

export type CommitArgs = {
    commitedKey: string;
    message: string;
}

export type HashArgs = {
    previousHash: string;
    counter: number;
    commitedMessage: string;
}
