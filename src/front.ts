import { ActionOptions, AgentOptions, InternalMessage } from "./utils/types"
import { WindowMessager } from "./utils/InternalMessager";

const FrontMessager = new WindowMessager();

class DomProcessor {
    private currentChat: string | null;
    constructor() {
        this.currentChat = null;

        this.updateChatState();
    }

    private searchCurrentChat(): string | undefined {
        const chatPanel = document.getElementById("main");
        if (chatPanel === null) return;
        const namePlaceholder = chatPanel.querySelector("header")
            ?.children[1]?.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild;
        // @ts-ignore: Property 'alt' does not exist on type 'Element'
        const contactNameRaw: string | undefined = (namePlaceholder?.firstElementChild.alt !== undefined) ?
            // @ts-ignore: Property 'alt' does not exist on type 'Element'
            namePlaceholder?.innerText + namePlaceholder?.firstElementChild?.alt :
            // @ts-ignore: Property 'innerText' does not exist on type 'Element'
            namePlaceholder?.innerText;
        return contactNameRaw?.trim();
    }

    private updateCurrentChat(contactName: string | undefined): void {
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

    private updateChatState() {
        setInterval(() => {
            const contactName = this.searchCurrentChat();
            this.updateCurrentChat(contactName);

            // 1. Get last message via wajs api
            //const message: InternalMessage = {
            //    from: AgentOptions.CONTENT,
            //    to: AgentOptions.INJECTED,
            //    action: ActionOptions.GET_LAST_CHAT_MESSAGE,
            //    payload: "5511972172712@c.us" // teste com o chatId do kouki
            //};
            //FrontMessager.sendMessage(message);
            // 2. If auditable is not instanciated and a request is observed -> update chat status to auditable in DOM class (by now)
            // 3. Else if it is instanciate pass to background to process (just console by now)
        }, 1000);
    }

    private attachInitAuditableChatButton(): void {
        // @ts-ignore: Object is possibly 'null'
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

        const message: InternalMessage = {
            action: ActionOptions.INIT_AUDITABLE_BUTTON_CLICKED,
            from: AgentOptions.CONTENT,
            to: AgentOptions.INJECTED
        };
        auditableButton.addEventListener("click", () => {
            FrontMessager.sendMessage(message);
        });

        const filter: InternalMessage = {
            from: AgentOptions.INJECTED,
            to: AgentOptions.CONTENT,
            action: ActionOptions.INIT_AUDITABLE_BUTTON_CLICKED
        };
        FrontMessager.listenMessage(filter, (payload: Object) => {
            console.log("Current chat id: ", payload)
        });


        attachmentsDiv?.appendChild(auditableButton);
    }
}

const domProcessorRepository = new DomProcessor();

