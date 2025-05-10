import { ActionOptions, AuditableChatOptions, AuditableChatStates, AuditableMessage, InternalMessage, ChatMessageV2 } from "./utils/types"

const auditableChats: Map<string, AuditableChat> = new Map([]);

class AuditableChat {
    private chatId: string;
    private currentState: AuditableChatStates;

    constructor(chatId: string) {
        this.chatId = chatId;
        this.currentState = AuditableChatStates.IDLE;
    };

    updateState(incomingMessage: ChatMessageV2) {
        switch (this.currentState) {
            case AuditableChatStates.IDLE:
                if (incomingMessage.content === AuditableChatOptions.REQUEST) {
                    if (incomingMessage.authorIsMe) {
                        this.currentState = AuditableChatStates.REQUEST_SENT;
                    } else {
                        this.currentState = AuditableChatStates.REQUEST_RECEIVED;
                    }
                }
                break;
            case AuditableChatStates.REQUEST_SENT:
                if (incomingMessage.content === AuditableChatOptions.ACCEPT) this.currentState = AuditableChatStates.ONGOING
                if (incomingMessage.content === AuditableChatOptions.DENY) this.currentState = AuditableChatStates.IDLE
                break;
            case AuditableChatStates.REQUEST_RECEIVED:
                if (incomingMessage.content === AuditableChatOptions.ACCEPT) this.currentState = AuditableChatStates.ONGOING
                if (incomingMessage.content === AuditableChatOptions.DENY) this.currentState = AuditableChatStates.IDLE
                break;
            case AuditableChatStates.ONGOING:
                if (incomingMessage.content === AuditableChatOptions.END) this.currentState = AuditableChatStates.IDLE
                break;
            default:
                throw new Error(`Unexpected State in conversation: ${this.currentState}`)
        }

        console.log("New state: ", this.currentState)
    }

    getCurrentState() {
        return this.currentState;
    }

    getCurrentChat() {
        return this.chatId;
    }
}

class DomProcessor {
    private currentChatButton: HTMLDivElement | null;
    constructor() {
        this.currentChatButton = null;
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

    attachInitAuditableChatButton() {
        const auditableButton = this.createBaseButton("div", 100) as HTMLDivElement;
        auditableButton.id = "auditable-wpp-chat-button-host";

        // @ts-ignore: Object is possibly 'null'
        const attachmentsDiv = document.getElementById("main").querySelector("footer")
            ?.firstElementChild?.firstElementChild?.querySelector("span")?.firstElementChild?.lastElementChild?.firstElementChild;
        attachmentsDiv?.insertBefore(auditableButton, attachmentsDiv.childNodes[1]);

        this.currentChatButton = auditableButton;
    }

    updateButtonState(currentState: AuditableChatStates, chatId: string): void {
        //@ts-ignore
        this.currentChatButton?.innerHTML = '';

        if (currentState === AuditableChatStates.ONGOING) {
            const endAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            // @ts-ignore
            endAuditableButton.innerText = "🔲";

            endAuditableButton.addEventListener("click", () => {
                chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        content: AuditableChatOptions.END,
                        chatId,
                        authorIsMe: true
                    } as AuditableMessage
                } as InternalMessage)
            });

            this.currentChatButton?.appendChild(endAuditableButton);
        }

        if (currentState === AuditableChatStates.IDLE) {
            const requireAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            // @ts-ignore
            requireAuditableButton.innerText = "🔲";

            requireAuditableButton.addEventListener("click", () => {
                chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        content: AuditableChatOptions.REQUEST,
                        chatId,
                        authorIsMe: true
                    } as AuditableMessage
                } as InternalMessage);
            });

            this.currentChatButton?.appendChild(requireAuditableButton);
        }

        if (currentState === AuditableChatStates.REQUEST_RECEIVED) {

            const acceptAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            acceptAuditableButton.innerText = "✅";

            const denyAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            denyAuditableButton.innerText = "❌";

            acceptAuditableButton.addEventListener("click", () => {
                chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        chatId,
                        content: AuditableChatOptions.ACCEPT,
                        authorIsMe: true
                    } as AuditableMessage
                } as InternalMessage);
                this.setupChatbox(chatId);
            });

            denyAuditableButton.addEventListener("click", () => {
                chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        chatId,
                        content: AuditableChatOptions.DENY,
                        authorIsMe: true
                    } as AuditableMessage
                } as InternalMessage);
            });

            this.currentChatButton?.appendChild(denyAuditableButton);
            this.currentChatButton?.appendChild(acceptAuditableButton);
        }
    }

    private createCustomInputbox(holderText: string, originalText: string | undefined, chatId: string) {
        const parentElement = document.createElement('div');
        parentElement.classList.add("x1n2onr6", "xh8yej3", "xjdcl3y", "lexical-rich-text-input");

        const placeHolderParent = document.createElement('div');
        placeHolderParent.setAttribute("aria-hidden", "true");

        const placeHolder = document.createElement('div');
        placeHolder.classList.add("x10l6tqk", "x13vifvy", "x1ey2m1c", "xhtitgo", "x1grh1yo", "x47corl", "x87ps6o", "xh9ts4v", "x1k6rcq7", "x17qophe", "x6prxxf");
        placeHolder.innerHTML = holderText;

        const customInput = document.createElement('div');
        customInput.classList.add("x1hx0egp", "x6ikm8r", "x1odjw0f", "x1k6rcq7", "x6prxxf");
        customInput.setAttribute("aria-autocomplete", "list");
        customInput.setAttribute("aria-label", holderText);
        customInput.setAttribute("aria-owns", "emoji-suggestion");
        customInput.setAttribute("contenteditable", "true");
        customInput.setAttribute("spellcheck", "true");
        customInput.setAttribute("aria-placeholder", holderText);
        customInput.setAttribute("data-lexical-editor", "true");
        customInput.setAttribute("style", "max-height: 11.76em; min-height: 1.47em; user-select: text; white-space: pre-wrap; word-break: break-word;");

        const auditableChatbox = document.createElement('p');
        auditableChatbox.classList.add("selectable-text", "copyable-text", "x15bjb6t", "x1n2onr6");
        auditableChatbox.setAttribute("style", "text-indent: 0px; margin-top: 0px; margin-bottom: 0px;");

        customInput.appendChild(auditableChatbox);
        placeHolderParent.appendChild(placeHolder);
        parentElement.appendChild(customInput);

        if (originalText) {
            const spanElement = document.createElement('span');
            spanElement.classList.add("selectable-text", "copyable-text", "xkrh14z");
            spanElement.setAttribute("data-lexical-text", "true");
            spanElement.textContent = originalText as string;
            auditableChatbox.innerHTML = '';
            auditableChatbox.appendChild(spanElement);
        } else {
            auditableChatbox.innerHTML = '<br>';
            parentElement.appendChild(placeHolderParent);
        }

        customInput.addEventListener('input', function() {
            if (auditableChatbox.textContent?.trim() === '') {
                auditableChatbox.innerHTML = '<br>';
                if (!parentElement.contains(placeHolderParent)) parentElement.appendChild(placeHolderParent);

            } else if (!auditableChatbox.querySelector('span')) {
                const text = auditableChatbox.textContent;
                const spanElement = document.createElement('span');
                spanElement.classList.add("selectable-text", "copyable-text", "xkrh14z");
                spanElement.setAttribute("data-lexical-text", "true");
                spanElement.textContent = text;

                const selection = window.getSelection();
                const range = selection?.getRangeAt(0);
                const offset = range?.startOffset;

                auditableChatbox.innerHTML = '';
                auditableChatbox.appendChild(spanElement);

                const newRange = document.createRange();
                newRange.setStart(spanElement?.firstChild as ChildNode, offset as number);
                newRange.collapse(true);
                selection?.removeAllRanges();
                selection?.addRange(newRange);

                if (parentElement.contains(placeHolderParent)) parentElement.removeChild(placeHolderParent);
            }
        });

        customInput.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && auditableChatbox?.textContent?.length === 0) e.preventDefault();

            if (e.key === 'Enter' && !e.shiftKey) {
                chrome.runtime.sendMessage({
                    action: ActionOptions.PROCESS_AUDITABLE_MESSAGE,
                    payload: {
                        content: auditableChatbox.textContent,
                        chatId,
                        authorIsMe: true
                    } as AuditableMessage,
                } as InternalMessage);

                auditableChatbox.innerHTML = '<br>';
                if (!parentElement.contains(placeHolderParent)) parentElement.appendChild(placeHolderParent);
            }
        });
        return parentElement;
    }

    private setupChatbox(chatId: string) {
        const originalChatbox = document.querySelectorAll('p.selectable-text.copyable-text')[1]?.parentElement?.parentElement;
        const holderText = originalChatbox?.firstElementChild?.ariaLabel as string;
        const originalText = originalChatbox?.firstElementChild?.firstElementChild?.querySelector('span')?.innerHTML;

        // Clearing whatsapp inputbox
        chrome.runtime.sendMessage({
            action: ActionOptions.SET_INPUT_BOX,
            payload: ''
        } as InternalMessage);

        const customInput = this.createCustomInputbox(holderText, originalText, chatId);

        originalChatbox?.replaceWith(customInput);
    }
}

let currentAuditableChat: AuditableChat | null = null;
const domProcessorRepository = new DomProcessor();

window.addEventListener("message", (event: MessageEvent) => {
    const internalMessage: InternalMessage = event.data;
    if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_MESSAGE) return;

    const incomingChatMessage = internalMessage.payload as AuditableMessage;
    const { chatId, ...chatMessage } = incomingChatMessage;

    const auditableChat = auditableChats.get(chatId);
    if (auditableChat) auditableChat.updateState(chatMessage as ChatMessageV2)

    if (currentAuditableChat && currentAuditableChat.getCurrentChat() === chatId) {
        domProcessorRepository.updateButtonState(currentAuditableChat.getCurrentState(), currentAuditableChat.getCurrentChat());
    }

    chrome.runtime.sendMessage(internalMessage);
});

window.addEventListener("message", (event: MessageEvent) => {
    const internalMessage: InternalMessage = event.data;
    if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_CHAT) return;

    const chat: string = internalMessage.payload;
    if (currentAuditableChat && currentAuditableChat.getCurrentState() === AuditableChatStates.IDLE) auditableChats.delete(currentAuditableChat.getCurrentChat());

    const auditableChat = auditableChats.get(chat)
    if (auditableChat) {
        currentAuditableChat = auditableChat;
    } else {
        const newAuditableChat = new AuditableChat(chat)
        auditableChats.set(chat, newAuditableChat);
        currentAuditableChat = newAuditableChat;
    }

    domProcessorRepository.attachInitAuditableChatButton();
    domProcessorRepository.updateButtonState(currentAuditableChat.getCurrentState(), currentAuditableChat.getCurrentChat());

    console.log("Current auditable after event: ", currentAuditableChat)
    console.log("From auditableChats after event: ", auditableChats)

    //chrome.runtime.sendMessage(internalMessage);
});

