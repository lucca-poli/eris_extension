export enum ActionOptions {
    GET_LAST_CHAT_MESSAGE = "GET_LAST_CHAT_MESSAGE",
    GET_CURRENT_CHAT = "GET_CURRENT_CHAT",
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

export type InternalMessage = {
    action: ActionOptions,
    payload?: any
}

export type SendMessage = {
    chatId: string,
    message: string
}

export type ChatMessage = {
    content: string,
    author: string
};

