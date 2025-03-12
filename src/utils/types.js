/**
 * @typedef {Object} ICommunicationActions
 * @property {string} init_auditable_button_clicked - Event name for the "Init Auditable Button Clicked" action.
 */

/**
 * @typedef {Object} IReveivers
 * @property {string} background - Endpoint reveivers "background".
 */

/** @type {ICommunicationActions} */
export const communicationActions = {
    init_auditable_button_clicked: "init-auditable-button-clicked"
}

/** @type {IReveivers} */
export const receivers = {
    background: "background"
}
