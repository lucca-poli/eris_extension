import { ActionOptions, AuditableChatOptions, AuditableMessage, ChatMessage, InternalMessage, SendMessage } from "./utils/types"

class DomProcessor {
    private currentChatId: string | null;
    private currentChatButton: HTMLDivElement | null;
    private auditableChats: Set<string>;
    constructor() {
        this.currentChatId = null;
        this.currentChatButton = null;
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
            ?.firstElementChild?.firstElementChild?.querySelector("span")?.firstElementChild?.lastElementChild?.firstElementChild;
        attachmentsDiv?.insertBefore(auditableButton, attachmentsDiv.childNodes[1]);

        return auditableButton;
    }

    // Só posso chamar essa função se tiver certeza que já estou num chat auditável
    private async updateButtonState(): Promise<void> {
        if (this.currentChatId === null) return;
        const { content: lastMessage, author: lastMessageAuthorId } = await this.getLastChatMessage(this.currentChatId);
        const isAuditable = this.auditableChats.has(this.currentChatId as string);
        const lastMessageIsRequest = lastMessage === AuditableChatOptions.REQUEST;
        const lastMessageAuthorIsMe = lastMessageAuthorId !== this.currentChatId;

        //@ts-ignore
        this.currentChatButton?.innerHTML = '';

        if (isAuditable) {
            if (lastMessage === AuditableChatOptions.END) {
                this.auditableChats.delete(this.currentChatId as string);
                return;
            }

            const endAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            // @ts-ignore
            endAuditableButton.innerText = "🔲";

            endAuditableButton.addEventListener("click", () => {
                chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        message: AuditableChatOptions.END,
                        chatId: this.currentChatId
                    } as SendMessage
                } as InternalMessage)
                this.auditableChats.delete(this.currentChatId as string);
            });

            this.currentChatButton?.appendChild(endAuditableButton);
        }

        if (!isAuditable && !lastMessageIsRequest) {
            const requireAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            // @ts-ignore
            requireAuditableButton.innerText = "🔲";

            requireAuditableButton.addEventListener("click", () => {
                chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        message: AuditableChatOptions.REQUEST,
                        chatId: this.currentChatId
                    } as SendMessage
                } as InternalMessage);
            });

            this.currentChatButton?.appendChild(requireAuditableButton);
        }

        if (!isAuditable && lastMessageIsRequest && !lastMessageAuthorIsMe) {

            const acceptAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            acceptAuditableButton.innerText = "✅";

            const denyAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            denyAuditableButton.innerText = "❌";

            acceptAuditableButton.addEventListener("click", () => {
                chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        chatId: this.currentChatId,
                        message: AuditableChatOptions.ACCEPT
                    } as SendMessage
                } as InternalMessage);
                this.auditableChats.add(this.currentChatId as string);
                this.setupChatbox();
            });

            denyAuditableButton.addEventListener("click", () => {
                chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        chatId: this.currentChatId,
                        message: AuditableChatOptions.DENY
                    } as SendMessage
                } as InternalMessage);
            });

            this.currentChatButton?.appendChild(denyAuditableButton);
            this.currentChatButton?.appendChild(acceptAuditableButton);
        }
    }

    private searchCurrentChat(): Promise<string | undefined> {
        return new Promise((resolve) => {
            const resolveId = (chatId: string | undefined) => resolve(chatId);
            chrome.runtime.sendMessage({
                action: ActionOptions.GET_CURRENT_CHAT
            } as InternalMessage, resolveId);
        })
    }

    private getLastChatMessage(chatId: string): Promise<ChatMessage> {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: ActionOptions.GET_LAST_CHAT_MESSAGE,
                payload: chatId
            } as InternalMessage, (lastMessage: ChatMessage) => {
                resolve(lastMessage);
            })
        });
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
            console.log("current text: ", auditableChatbox.textContent);
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

    private setupChatbox() {
        const originalChatbox = document.querySelectorAll('p.selectable-text.copyable-text')[1]?.parentElement?.parentElement;
        const holderText = originalChatbox?.firstElementChild?.ariaLabel as string;
        const originalText = originalChatbox?.firstElementChild?.firstElementChild?.querySelector('span')?.innerHTML;

        // Clearing whatsapp inputbox
        chrome.runtime.sendMessage({
            action: ActionOptions.SET_INPUT_BOX,
            payload: ''
        } as InternalMessage);

        const customInput = this.createCustomInputbox(holderText, originalText, this.currentChatId as string);

        originalChatbox?.replaceWith(customInput);
    }

    private updateChatState() {
        setInterval(async () => {
            const contactId = await this.searchCurrentChat();
            const isSingleContact = !!contactId;
            const isNewChat = contactId !== this.currentChatId;
            const isAuditable = this.auditableChats.has(contactId as string);
            if (isNewChat) {
                if (isSingleContact) {
                    this.currentChatId = contactId;
                    this.currentChatButton = this.attachInitAuditableChatButton();
                    if (isAuditable) this.setupChatbox();
                } else {
                    this.currentChatId = null;
                    this.currentChatButton = null;
                }
            };

            if (this.currentChatId === null) return;
            //const lastChatMessage = await this.getLastChatMessage(this.currentChatId)

            this.updateButtonState();

            if (!isAuditable) return;

            //chrome.runtime.sendMessage({
            //    action: ActionOptions.PROCESS_AUDITABLE_MESSAGE,
            //    payload: lastChatMessage
            //} as InternalMessage);
        }, 1000);
    }

}

const domProcessorRepository = new DomProcessor();

window.addEventListener("message", (event: MessageEvent) => {
    const internalMessage: InternalMessage = event.data;
    if (internalMessage.action !== ActionOptions.PROCESS_AUDITABLE_MESSAGE) return;

    chrome.runtime.sendMessage(internalMessage);
})
