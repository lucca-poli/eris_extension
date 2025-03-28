import { ActionOptions, AgentOptions } from "./utils/types.js"
import { WindowMessager } from "./utils/InternalMessager.js";

const FrontMessager = new WindowMessager();

class DomProcessor {
    constructor() {
        /**
         * @type {string | null}
         * @private
         */
        this.currentChat = null;

        this.updateChatState();
    }

    /**
     * @private
     * @returns {string | undefined}
    */
    searchCurrentChat() {
        const chatPanel = document.getElementById("main");
        if (chatPanel === null) return;
        const namePlaceholder = chatPanel.querySelector("header")
            ?.children[1]?.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild;
        /** @type {string | undefined} */
        const contactNameRaw = (namePlaceholder?.firstElementChild?.alt !== undefined) ?
            namePlaceholder?.innerText + namePlaceholder?.firstElementChild?.alt :
            namePlaceholder?.innerText;
        return contactNameRaw?.trim();
    }

    /**
     * @private
     * @param {string | undefined} contactName 
     * @returns {void}
    */
    updateCurrentChat(contactName) {
        const isSingleContact = !!contactName; // "" or undefined => boolean
        const isNewChat = contactName !== this.currentChat;
        if (isNewChat) {
            if (isSingleContact) {
                this.currentChat = contactName;
                this.attachInitAuditableChatButton();
            } else {
                this.currentChat = null;
            }
        };
    }

    /** @private */
    updateChatState() {
        setInterval(() => {
            const contactName = this.searchCurrentChat();
            this.updateCurrentChat(contactName);

            // 1. Get last message via wajs api
            /** @type {import("./utils/types.js").InternalMessage} message */
            const message = {
                from: AgentOptions.CONTENT,
                to: AgentOptions.INJECTED,
                action: ActionOptions.GET_LAST_CHAT_MESSAGE,
                payload: "5511972172712@c.us" // teste com o chatId do kouki
            };
            FrontMessager.sendMessage(message);
            // 2. If auditable is not instanciated and a request is observed -> update chat status to auditable in DOM class (by now)
            // 3. Else if it is instanciate pass to background to process (just console by now)
        }, 1000);
    }

    /**
     * @private 
     * @param {string} contactName 
     */
    attachInitAuditableChatButton() {
        const attachmentsDiv = document.getElementById("main").querySelector("footer")
            ?.firstElementChild?.firstElementChild?.querySelector("span")?.firstElementChild?.firstElementChild;

        const auditableButton = document.createElement("div");
        auditableButton.className = "auditable-wpp-Chats-button";
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
            action: ActionOptions.INIT_AUDITABLE_BUTTON_CLICKED,
            from: AgentOptions.CONTENT,
            to: AgentOptions.INJECTED
        };
        auditableButton.addEventListener("click", () => {
            FrontMessager.sendMessage(message);
        });

        /** @type {import('./utils/types.js').InternalMessage} */
        const filter = {
            from: AgentOptions.INJECTED,
            to: AgentOptions.CONTENT,
            action: ActionOptions.INIT_AUDITABLE_BUTTON_CLICKED
        };
        FrontMessager.listenMessage(filter, (payload) => {
            console.log("Current chat id: ", payload)
        });


        attachmentsDiv?.appendChild(auditableButton);
    }
}

const domProcessorRepository = new DomProcessor();

