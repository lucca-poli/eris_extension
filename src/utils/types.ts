export enum ActionOptions {
    PROPAGATE_NEW_CHAT = "PROPAGATE_NEW_CHAT",
    PROPAGATE_NEW_MESSAGE = "PROPAGATE_NEW_MESSAGE",
    GET_MESSAGES = "GET_MESSAGES",
    GET_COMMITED_KEYS = "GET_COMMITED_KEYS",
    SET_INPUT_BOX = "SET_INPUT_BOX",
    SEND_TEXT_MESSAGE = "SEND_TEXT_MESSAGE",
    SEND_FILE_MESSAGE = "SEND_FILE_MESSAGE",
    PROCESS_AUDITABLE_MESSAGE = "PROCESS_AUDITABLE_MESSAGE",
    DEBUG = "DEBUG"
};

export enum AuditableChatOptions {
    REQUEST = "Requesting auditable conversation.",
    ACCEPT = "Auditable conversation accepted.",
    DENY = "Auditable conversation denied.",
    END = "Auditable conversation ended. Logs available in popup."
};

export enum AuditableChatStates {
    REQUEST_SENT = "REQUEST_SENT",
    REQUEST_RECEIVED = "REQUEST_RECEIVED",
    ONGOING = "ONGOING",
    IDLE = "IDLE"
};

export type InternalMessage = {
    action: ActionOptions,
    payload?: any
}

export type ChatState = {
    currentState: AuditableChatStates,
    auditableChatReference?: AuditableChatReference
}

export type AuditableChatReference = {
    currentAuditableChatInitId: string,
    auditableMessagesCounter: number,
    initialBlock: AuditableBlock
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

export type ProcessAuditableMessage = {
    incomingMessage: AuditableMessage,
    toCalculateHash: boolean
}

export type AuditableMessage = {
    chatId: string,
    messageId?: string,
    content?: string,
    author: string,
    hash?: AuditableBlock,
    timestamp?: number,
}

export type AuditableMessageContent = {
    content: string;
    author: string;
}

export type AuditableBlock = {
    hash: string,
    previousHash: string,
    counter: number,
    commitedMessage: string
}

export type PRFArgs = {
    seed: string;
    counter: number;
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
