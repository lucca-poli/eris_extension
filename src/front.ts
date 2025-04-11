import { ActionOptions, AgentOptions, AuditableChatOptions, InternalMessage, InternalMessageMetadata } from "./utils/types"
import { InternalMessager, WindowMessager } from "./utils/InternalMessager";

type chatMessage = {
    content: string,
    author: string
};

const FrontWindowMessager = new WindowMessager(AgentOptions.CONTENT, AgentOptions.INJECTED);
const FrontMessager = new InternalMessager([FrontWindowMessager]);

class DomProcessor {
    private currentChatId: string | null;
    private currentChatButton: HTMLDivElement | null;
    private auditableChats: Set<string>;
    private lastChatMessage: chatMessage | null;
    constructor() {
        this.currentChatId = null;
        this.currentChatButton = null;
        this.lastChatMessage = null;
        this.auditableChats = new Set([]);

        this.updateChatState();
    }

    private createBaseButton(type: string, width: number): HTMLElement {
        const baseButton = document.createElement(type);
        baseButton.style.width = `${width}px`;
        baseButton.style.height = "52px";
        baseButton.style.display = "flex";
        baseButton.style.alignItems = "center";
        baseButton.style.justifyContent = "center";
        baseButton.style.cursor = "pointer";
        baseButton.style.transition = "opacity 0.2s ease-in-out";

        return baseButton;
    }

    private attachInitAuditableChatButton(): HTMLDivElement {
        const auditableButton = this.createBaseButton("div", 100) as HTMLDivElement;
        auditableButton.id = "auditable-wpp-chat-button-host";

        // @ts-ignore: Object is possibly 'null'
        const attachmentsDiv = document.getElementById("main").querySelector("footer")
            ?.firstElementChild?.firstElementChild?.querySelector("span")?.firstElementChild?.firstElementChild;
        attachmentsDiv?.appendChild(auditableButton);

        return auditableButton;
    }

    // Só posso chamar essa função se tiver certeza que já estou num chat auditável
    private updateButtonState(): void {
        const [lastMessage, lastMessageAuthorId] = [this.lastChatMessage?.content as string, this.lastChatMessage?.author as string];
        const isAuditable = this.auditableChats.has(this.currentChatId as string);
        const lastMessageIsRequest = lastMessage === AuditableChatOptions.REQUEST;
        const lastMessageAuthorIsMe = lastMessageAuthorId !== this.currentChatId;
        console.log("isAuditable: ", isAuditable)
        console.log("lastMessage: ", lastMessage)
        console.log("lastMessageIsRequest: ", lastMessageIsRequest)
        console.log("lastMessageAuthorIsMe: ", lastMessageAuthorIsMe)

        //@ts-ignore
        this.currentChatButton?.innerHTML = '';
        console.log(this.auditableChats)

        if (isAuditable) {
            if (lastMessage === AuditableChatOptions.END) {
                this.auditableChats.delete(this.currentChatId as string);
                return;
            }

            const endAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            // @ts-ignore
            endAuditableButton.innerText = "🔲";

            const sendEndMessage: InternalMessage = {
                from: AgentOptions.CONTENT,
                to: AgentOptions.INJECTED,
                action: ActionOptions.REQUEST_END_AUDITABLE_BUTTON_CLICKED,
                payload: this.currentChatId
            };
            endAuditableButton.addEventListener("click", () => {
                FrontMessager.sendMessage(sendEndMessage);
                this.auditableChats.delete(this.currentChatId as string);
            });

            this.currentChatButton?.appendChild(endAuditableButton);
        }

        if (!isAuditable && !lastMessageIsRequest) {
            const requireAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            // @ts-ignore
            requireAuditableButton.innerText = "🔲";

            const sendRequestMessage: InternalMessage = {
                from: AgentOptions.CONTENT,
                to: AgentOptions.INJECTED,
                action: ActionOptions.REQUEST_AUDITABLE_BUTTON_CLICKED,
                payload: this.currentChatId
            };
            requireAuditableButton.addEventListener("click", () => {
                FrontMessager.sendMessage(sendRequestMessage);
            });

            this.currentChatButton?.appendChild(requireAuditableButton);
        }

        if (!isAuditable && lastMessageIsRequest && !lastMessageAuthorIsMe) {

            const acceptAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            acceptAuditableButton.innerText = "✅";

            const denyAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            denyAuditableButton.innerText = "❌";

            const sendAcceptMessage: InternalMessage = {
                from: AgentOptions.CONTENT,
                to: AgentOptions.INJECTED,
                action: ActionOptions.REQUEST_ACCEPT_AUDITABLE_BUTTON_CLICKED,
                payload: this.currentChatId
            };
            acceptAuditableButton.addEventListener("click", () => {
                FrontMessager.sendMessage(sendAcceptMessage);
                this.auditableChats.add(this.currentChatId as string);
            });

            const sendDenyMessage: InternalMessage = {
                from: AgentOptions.CONTENT,
                to: AgentOptions.INJECTED,
                action: ActionOptions.REQUEST_DENY_AUDITABLE_BUTTON_CLICKED,
                payload: this.currentChatId
            };
            denyAuditableButton.addEventListener("click", () => {
                FrontMessager.sendMessage(sendDenyMessage);
            });

            this.currentChatButton?.appendChild(denyAuditableButton);
            this.currentChatButton?.appendChild(acceptAuditableButton);
        }
    }

    private updateChatState() {
        setInterval(async () => {
            const requireCurrentChat: InternalMessage = {
                from: AgentOptions.CONTENT,
                to: AgentOptions.INJECTED,
                action: ActionOptions.GET_CURRENT_CHAT,
            }
            FrontMessager.sendMessage(requireCurrentChat);

            const requireCurrentChatResponse: InternalMessageMetadata = {
                from: AgentOptions.INJECTED,
                to: AgentOptions.CONTENT,
                action: ActionOptions.GET_CURRENT_CHAT,
            }

            FrontMessager.listenMessage(requireCurrentChatResponse, (payload: string | undefined) => {
                const contactId = payload;
                const isSingleContact = !!contactId;
                const isNewChat = contactId !== this.currentChatId;
                if (isNewChat) {
                    if (isSingleContact) {
                        this.currentChatId = contactId;
                        this.currentChatButton = this.attachInitAuditableChatButton();
                    } else {
                        this.currentChatId = null;
                        this.currentChatButton = null;
                        this.lastChatMessage = null;
                    }
                };
            });

            if (this.currentChatId === null) return;

            const requireLastMessage: InternalMessage = {
                from: AgentOptions.CONTENT,
                to: AgentOptions.INJECTED,
                action: ActionOptions.GET_LAST_CHAT_MESSAGE,
                payload: this.currentChatId
            };
            FrontMessager.sendMessage(requireLastMessage);

            const requireLastMessageResponse: InternalMessageMetadata = {
                from: AgentOptions.INJECTED,
                to: AgentOptions.CONTENT,
                action: ActionOptions.GET_LAST_CHAT_MESSAGE,
            };
            FrontMessager.listenMessage(requireLastMessageResponse, (payload: (string | undefined)[]) => {
                const [lastMessage, lastMessageAuthorId] = payload;
                if (lastMessage === undefined || lastMessageAuthorId === undefined) {
                    throw new Error(`Couldn't read last message in chat: ${this.currentChatId}`)
                };

                this.lastChatMessage = {
                    content: lastMessage,
                    author: lastMessageAuthorId
                }
            });

            this.updateButtonState();
            // 3. Else if it is instanciate pass to background to process (just console by now)
        }, 1000);
    }

}

const domProcessorRepository = new DomProcessor();

const windowMessageRepeaterFilter: InternalMessageMetadata = {
    from: AgentOptions.INJECTED,
    to: AgentOptions.CONTENT,
    action: ActionOptions.REPASS_INTERNAL_MESSAGE
};
FrontMessager.listenMessage(windowMessageRepeaterFilter, (payload: InternalMessage) => {
    FrontMessager.sendMessage(payload);
})
