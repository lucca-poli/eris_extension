export enum ActionOptions {
    PROPAGATE_NEW_CHAT = "PROPAGATE_NEW_CHAT",
    GET_LAST_CHAT_MESSAGE = "GET_LAST_CHAT_MESSAGE",
    SET_INPUT_BOX = "SET_INPUT_BOX",
    SEND_TEXT_MESSAGE = "SEND_TEXT_MESSAGE",
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
    REQUEST_SENT,
    REQUEST_RECEIVED,
    ONGOING,
    IDLE
};

export type InternalMessage = {
    action: ActionOptions,
    payload?: any
}

export type SendMessage = {
    chatId: string,
    message: string,
    hash?: string,
}

export type ChatMessage = {
    content: string,
    author: string
};

export type ChatMessageV2 = {
    content: string,
    authorIsMe: boolean,
    hash?: string,
}


export type AuditableMessage = {
    chatId: string,
    content?: string,
    authorIsMe: boolean,
    hash?: string,
}

