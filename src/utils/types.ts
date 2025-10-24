export enum ActionOptions {
    PROPAGATE_NEW_CHAT = "PROPAGATE_NEW_CHAT",
    PROPAGATE_NEW_MESSAGE = "PROPAGATE_NEW_MESSAGE",
    GENERATE_AND_SEND_BLOCK = "GENERATE_AND_SEND_BLOCK",
    GET_MESSAGES = "GET_MESSAGES",
    DELETE_MESSAGES = "DELETE_MESSAGES",
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
    ACK = "[Control Message]\nConfirmation ACK sent.",
    AGREE_TO_DISAGREE_ATTEMPT = "[Control Message]\nAttempting to resolve collision.",
    AGREE_TO_DISAGREE_RESOLVE = "[Control Message]\nCollision resolved."
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

export type MessagesToDelete = {
    messages: string[];
    chatId: string;
}

export type AssymetricKeys = {
    publicKey: JsonWebKey;
    privateKey: JsonWebKey;
}

export type ChatState = {
    currentState: AuditableChatStates,
    internalAuditableChatVariables?: InternalAuditableChatVariables
}

export type InternalAuditableChatVariables = {
    auditableChatSeed: string;
    counterpartPublicKey?: JsonWebKey;
    counter: number;
    previousHash: string;
    agreeToDisagreeAtempt?: AgreeToDisagreeMetadata;
    selfSignature?: Signature;
    counterpartSignature?: Signature;
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

export type WhatsappMessage = {
    chatId: string;
    messageId?: string;
    content?: string;
    author: string;
    metadata?: AuditableMetadata | AckMetadata | AgreeToDisagreeMetadata;
    timestamp?: number;
}

interface BaseMetadata {
    kind: MetadataOptions
}

export enum MetadataOptions {
    AUDITABLE = "AUDITABLE",
    AGREE_TO_DISAGREE = "AGREE_TO_DISAGREE",
    ACK = "ACK"
}

export type AuditableMessageContent = {
    message: string;
    author: string;
}

export type GenerateWhatsappMessage = {
    whatsappMessage: WhatsappMessage;
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

export type PreviousBlockVerificationData = {
    hash: string,
    controlCounter: number, // Block counter plus 1. As would be the internal counter in a normal chat.
}

export type AgreeToDisagreeBlock = {
    hash: string,
    previousData: Object,
    counter: number,
}

export interface AuditableMetadata extends BaseMetadata {
    kind: MetadataOptions.AUDITABLE;
    block: AuditableBlock;
    signature: string;
    counterpartPublicKey?: JsonWebKey;
    seed?: string;
    initialTimestamp?: string;
}

export type PrivateLog = {
    commitedKey: string;
    counter: number;
    content: AuditableMessageContent | AuditableChatMetadata;
}

export type PreviousData = Map<string, PreviousBlockVerificationData>;

export interface AgreeToDisagreeMetadata extends BaseMetadata {
    kind: MetadataOptions.AGREE_TO_DISAGREE;
    block: AgreeToDisagreeBlock;
    disagreeRoot: WhatsappMessage;
    signature: string;
}

export interface AckMetadata extends BaseMetadata {
    kind: MetadataOptions.ACK;
    block: AuditableBlock | AgreeToDisagreeBlock;
    signature: string;
    counterpartPublicKey?: JsonWebKey;
}

export type Signature = {
    signature: string;
    blockHash: string;
    counter: number;
}

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

export type AgreeToDisagreeHashArgs = {
    previousData: Object;
    counter: number;
}
