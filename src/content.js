window.addEventListener('message', (event) => {
    //console.log("got a event:", event);
    if (event.data.type === 'WPP_FULLY_READY') {
        console.log('WA-JS is ready!');
        clearInterval(event.data.intervalId);
        console.log(document.body);
    }
});

class DomProcessor {
    constructor() {
        /** @type {string | null}
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

    /** @private */
    attachInitAuditableConversationButton() {
        const attachmentsDiv = document.getElementById("main").querySelector("footer")
            ?.firstElementChild?.firstElementChild?.querySelector("span")?.firstElementChild?.firstElementChild;
        console.log(attachmentsDiv);

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

        auditableButton.addEventListener("click", () => console.log("Hello!"));

        attachmentsDiv?.appendChild(auditableButton);
    }
}

const domProcessorRepository = new DomProcessor();
