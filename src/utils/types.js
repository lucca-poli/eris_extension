/**
 * @typedef {Object} IActionOptions
 * @property {string} init_auditable_button_clicked - Event name for the "Init Auditable Button Clicked" action.
 */

/**
 * @typedef {Object} IReceiverOptions
 * @property {string} background - Endpoint reveivers "background".
 */

/** @type {IActionOptions} */
export const actionOptions = {
    init_auditable_button_clicked: "init-auditable-button-clicked"
}

/** @type {IReceiverOptions} */
export const receiverOptions = {
    background: "background"
}
