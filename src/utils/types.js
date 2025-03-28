/**
 * @typedef {Object} IActionOptions
 * @property {string} INIT_AUDITABLE_BUTTON_CLICKED - Event name for the "Init Auditable Button Clicked" action.
 * @property {string} GET_LAST_CHAT_MESSAGE - Event name for the "Get last chat message" action.
 * @property {string} DEBUG - Event name for the "debugging" action.
 */

/**
 * @typedef {Object} IAgentOptions
 * @property {string} INJECTED - Endpoint reveivers "injected".
 * @property {string} CONTENT - Endpoint reveivers "content".
 * @property {string} BACKGROUND - Endpoint reveivers "background.
 */

/**
 * @typedef {Object} InternalMessage
 * @property {string | Object} [payload] - Any kind of data it carries
 * @property {IActionOptions} action - Which action triggered the message
 * @property {IAgentOptions} from - Sender
 * @property {IAgentOptions} to - Receiver
*/

/**
 * @typedef {Object} IAuditableChatOptions
 * @property {string} REQUEST - Action "request".
 * @property {string} ACCEPT - Action "accept".
 * @property {string} END - Action "end.
*/

/** @type {IActionOptions} */
export const ActionOptions = {
    INIT_AUDITABLE_BUTTON_CLICKED: "INIT_AUDITABLE_BUTTON_CLICKED",
    GET_LAST_CHAT_MESSAGE: "GET_LAST_CHAT_MESSAGE",
    DEBUG: "DEBUG"
};

/** @type {IAgentOptions} */
export const AgentOptions = {
    INJECTED: "INJECTED",
    CONTENT: "CONTENT",
    BACKGROUND: "BACKGROUND"
};

/** @type {IAuditableChatOptions} */
export const AuditableChatOptions = {
    REQUEST: "Requesting auditable conversation.",
    ACCEPT: "Auditable conversation accepted.",
    END: "Auditable conversation ended. Logs available in popup."
}
