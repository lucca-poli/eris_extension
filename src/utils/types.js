/**
 * @typedef {Object} IActionOptions
 * @property {string} init_auditable_button_clicked - Event name for the "Init Auditable Button Clicked" action.
 * @property {string} debug - Event name for the "debugging" action.
 */

/**
 * @typedef {Object} IAgentOptions
 * @property {string} injected - Endpoint reveivers "injected".
 * @property {string} content - Endpoint reveivers "content".
 * @property {string} background - Endpoint reveivers "background.
 */

/**
 * @typedef {Object} InternalMessage
 * @property {string | Object} [payload] - Any kind of data it carries
 * @property {IActionOptions} action - Which action triggered the message
 * @property {IAgentOptions} from - Sender
 * @property {IAgentOptions} to - Receiver
*/

/** @type {IActionOptions} */
export const actionOptions = {
    init_auditable_button_clicked: "init-auditable-button-clicked",
    debug: "debug"
};

/** @type {IAgentOptions} */
export const agentOptions = {
    injected: "injected",
    content: "content",
    background: "background"
};
