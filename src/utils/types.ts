export enum ActionOptions {
    SEND_MESSAGE_TO_BACKGROUND = "SEND_MESSAGE_TO_BACKGROUND",
    RECEIVED_NEW_MESSAGE = "RECEIVED_NEW_MESSAGE",
    PREPROCESS_AUDITABLE_MESSAGE = "PREPROCESS_AUDITABLE_MESSAGE",
    CLEAN_INPUT_TEXT_BOX = "CLEAN_INPUT_TEXT_BOX",
    GET_LAST_CHAT_MESSAGE = "GET_LAST_CHAT_MESSAGE",
    GET_CURRENT_CHAT = "GET_CURRENT_CHAT",
    SEND_TEXT_MESSAGE = "SEND_TEXT_MESSAGE",
    REPASS_INTERNAL_MESSAGE = "REPASS_INTERNAL_MESSAGE",
    PROCESS_AUDITABLE_MESSAGE = "PROCESS_AUDITABLE_MESSAGE",
    DEBUG = "DEBUG"
};

export enum AgentOptions {
    INJECTED = "INJECTED",
    CONTENT = "CONTENT",
    BACKGROUND = "BACKGROUND"
};

export enum AuditableChatOptions {
    REQUEST = "Requesting auditable conversation.",
    ACCEPT = "Auditable conversation accepted.",
    DENY = "Auditable conversation denied.",
    END = "Auditable conversation ended. Logs available in popup."
};

export type InternalMessageMetadata = {
    action: ActionOptions,
    from: AgentOptions,
    to: AgentOptions
};

export type InternalMessage = {
    payload?: any,
} & InternalMessageMetadata;

export type InternalMessageV2 = {
    action: ActionOptions,
    payload: any
}

export type SendMessage = {
    chatId: string,
    message: string
}

export interface MessagerService {
    sendMessage(internalMessage: InternalMessage): void,
    listenMessage(filter: InternalMessage, callback: Function): void,
    getRoute(): RouteEndpoints
};

export type RouteEndpoints = {
    owner: AgentOptions,
    counterpart: AgentOptions
};

export type chatMessage = {
    content: string,
    author: string
};

