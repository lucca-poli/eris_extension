import { actionOptions, agentOptions } from "./utils/types.js"
import { FrontMessager } from "./utils/InternalMessager.js";

/** @type {import('./utils/types.js').InternalMessage} */
const filter = {
    from: agentOptions.injected,
    to: agentOptions.content,
    action: actionOptions.debug
};
FrontMessager.listenMessage(filter, (payload) => {
    console.log("baatata");
    console.log(payload);
});

class DomProcessor {
    constructor() {
        /**
         * @type {string | null}
         * @private
         */
        this.currentConversation = null;

        this.updateSelectedConversation();
    }

    /** @private */
    updateSelectedConversation() {
        setInterval(() => {
            const conversationPanel = document.getElementById("main");
            if (conversationPanel !== null) {
                const namePlaceholder = conversationPanel.querySelector("header")
                    ?.children[1]?.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild;
                /** @type {string | undefined} */
                const contactNameRaw = (namePlaceholder?.firstElementChild?.alt !== undefined) ?
                    namePlaceholder?.innerText + namePlaceholder?.firstElementChild?.alt :
                    namePlaceholder?.innerText;
                const contactName = contactNameRaw?.trim();

                const isSingleContact = !!contactName; // "" or undefined => boolean
                const isNewConversation = contactName !== this.currentConversation;
                if (isNewConversation) {
                    if (isSingleContact) {
                        this.currentConversation = contactName;
                        this.attachInitAuditableConversationButton();
                    } else {
                        this.currentConversation = null;
                    }
                }
            };
        }, 1000);
    }

    /**
     * @private 
     * @param {string} contactName 
     */
    attachInitAuditableConversationButton() {
        const attachmentsDiv = document.getElementById("main").querySelector("footer")
            ?.firstElementChild?.firstElementChild?.querySelector("span")?.firstElementChild?.firstElementChild;

        const auditableButton = document.createElement("div");
        auditableButton.className = "auditable-wpp-conversations-button";
        auditableButton.style.width = "46px";
        auditableButton.style.height = "52px";
        auditableButton.style.display = "flex";
        auditableButton.style.alignItems = "center";
        auditableButton.style.justifyContent = "center";
        auditableButton.style.cursor = "pointer";
        auditableButton.style.transition = "opacity 0.2s ease-in-out";
        auditableButton.innerText = "🔲"; // Replace with your own icon

        /** @type {import("./utils/types.js").InternalMessage} message */
        const message = {
            action: actionOptions.init_auditable_button_clicked,
            from: agentOptions.content,
            to: agentOptions.injected
        };
        auditableButton.addEventListener("click", () => {
            console.log("Sending message from content");
            FrontMessager.sendMessage(message);
        });
        // O botão tem que:
        // solicitar conversa auditavel se uma conversa não for auditavel
        // encerrar conversa auditável se a conversa for auditável

        attachmentsDiv?.appendChild(auditableButton);
    }
}

const domProcessorRepository = new DomProcessor();

