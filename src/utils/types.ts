export enum ActionOptions {
    INIT_AUDITABLE_BUTTON_CLICKED = "INIT_AUDITABLE_BUTTON_CLICKED",
    GET_LAST_CHAT_MESSAGE = "GET_LAST_CHAT_MESSAGE",
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
    END = "Auditable conversation ended. Logs available in popup."
};

export type InternalMessage = {
    payload?: string | Object,
    action: ActionOptions,
    from: AgentOptions,
    to: AgentOptions
};

export interface MessagerService {
    sendMessage(internalMessage: InternalMessage): void,
    listenMessage(filter: InternalMessage, callback: Function): void
}
