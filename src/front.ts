import { finishingAuditableChatRoutine } from "./utils/finishing_routine";
import { AuditableChatStateMachine } from "./utils/auditable_chat_state_machine";
import { ActionOptions, AuditableControlMessage, AuditableChatStates, WhatsappMessage, GenerateWhatsappMessage, InternalMessage, MetadataOptions, AuditableMetadata } from "./utils/types";
import { displayRequestWindow } from "./utils/request_popup";

class DomProcessor {
    private currentChatButton: HTMLDivElement | null;
    private static AUDITABLE_SUBTITLE = ' - Secure Chat Active';
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

    private updateButtonState(currentState: AuditableChatStates, chatId: string): void {
        //@ts-ignore
        this.currentChatButton?.innerHTML = '';

        if (currentState === AuditableChatStates.ONGOING) {
            const endAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            // @ts-ignore
            endAuditableButton.innerText = "🔲";

            endAuditableButton.addEventListener("click", async () => {
                const auditableState = await AuditableChatStateMachine.getAuditableChat(chatId);
                if (!auditableState) throw new Error("There should be a conversation created.");
                if (!auditableState.internalAuditableChatVariables) throw new Error("There should be a auditable chat reference.");
                console.log("auditableState before finishing: ", auditableState);

                const returnedMessageId: string = await chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        content: AuditableControlMessage.END,
                        chatId,
                        author: await AuditableChatStateMachine.getUserId()
                    } as WhatsappMessage
                } as InternalMessage);

                await finishingAuditableChatRoutine(
                    chatId,
                    auditableState.internalAuditableChatVariables?.auditableChatSeed,
                    returnedMessageId,
                    auditableState.internalAuditableChatVariables.counter * 2
                );
            });

            this.currentChatButton?.appendChild(endAuditableButton);
        }

        if (currentState === AuditableChatStates.IDLE) {
            const requireAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            // @ts-ignore
            requireAuditableButton.innerText = "🔲";

            requireAuditableButton.addEventListener("click", async () => {
                await displayRequestWindow(chatId);
            });

            this.currentChatButton?.appendChild(requireAuditableButton);
        }

        if (currentState === AuditableChatStates.REQUEST_SENT) {
            const requireAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            // @ts-ignore
            requireAuditableButton.innerText = "❌";

            requireAuditableButton.addEventListener("click", async () => {
                chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        content: AuditableControlMessage.CANCEL,
                        chatId,
                        author: await AuditableChatStateMachine.getUserId()
                    } as WhatsappMessage
                } as InternalMessage);
            });

            this.currentChatButton?.appendChild(requireAuditableButton);
        }

        if (currentState === AuditableChatStates.REQUEST_RECEIVED) {

            const acceptAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            acceptAuditableButton.innerText = "✅";

            const denyAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            denyAuditableButton.innerText = "❌";

            acceptAuditableButton.addEventListener("click", async () => {
                this.setupChatbox(chatId);

                chrome.runtime.sendMessage({
                    action: ActionOptions.GENERATE_AND_SEND_BLOCK,
                    payload: {
                        whatsappMessage: {
                            chatId,
                            content: AuditableControlMessage.ACCEPT,
                            author: await AuditableChatStateMachine.getUserId(),
                        },
                        startingMessage: true,
                    } as GenerateWhatsappMessage,
                } as InternalMessage);
            });

            denyAuditableButton.addEventListener("click", async () => {
                chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        chatId,
                        content: AuditableControlMessage.DENY,
                        author: await AuditableChatStateMachine.getUserId()
                    } as WhatsappMessage
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

        customInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Backspace' && auditableChatbox?.textContent?.length === 0) e.preventDefault();

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (auditableChatbox?.textContent?.length === 0) return; // do nothing on messages with no text

                chrome.runtime.sendMessage({
                    action: ActionOptions.GENERATE_AND_SEND_BLOCK,
                    payload: {
                        whatsappMessage: {
                            content: auditableChatbox.textContent,
                            chatId,
                            author: await AuditableChatStateMachine.getUserId()
                        },
                        startingMessage: false,
                    } as GenerateWhatsappMessage,
                } as InternalMessage);

                // @ts-ignore
                auditableChatbox?.textContent = '';
                this.setupChatbox(chatId);
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

    private setupAuditableSubtitle() {
        const originalChatBox = document.querySelectorAll("div.x78zum5.x1q0g3np.x1iyjqo2.x6ikm8r.x10wlt62.x1jchvi3.xdod15v.x1wm35g.x1yc453h.xlyipyv.xuxw1ft.xh8yej3.x1s688f")[0]?.firstElementChild?.firstElementChild?.firstElementChild;
        if (typeof (originalChatBox?.innerHTML) !== "string") throw new Error("Chat title not found.");
        const newChatTitle = originalChatBox.innerHTML + DomProcessor.AUDITABLE_SUBTITLE;
        originalChatBox.innerHTML = newChatTitle;
    }

    updateChatState(currentState: AuditableChatStates, chatId: string) {
        this.updateButtonState(currentState, chatId);
        if (currentState === AuditableChatStates.ONGOING || currentState === AuditableChatStates.WAITING_ACK) {
            this.setupChatbox(chatId);
            this.setupAuditableSubtitle();
        }
    }
}

let currentAuditableChatId: string | null = null;
const domProcessorRepository = new DomProcessor();

window.addEventListener("message", async (event: MessageEvent) => {
    const internalMessage: InternalMessage = event.data;
    if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_MESSAGE) return;

    const whatsappMessage = internalMessage.payload as WhatsappMessage;
    const metadataIsAuditable = whatsappMessage.metadata?.kind === MetadataOptions.AUDITABLE;
    const { chatId } = whatsappMessage;
    const oldState = await AuditableChatStateMachine.getAuditableChat(chatId);
    console.log("oldState is: ", oldState);

    // Manage AuditableChats state
    const seed = metadataIsAuditable ?
        (whatsappMessage.metadata as AuditableMetadata).seed || oldState?.internalAuditableChatVariables?.auditableChatSeed :
        oldState?.internalAuditableChatVariables?.auditableChatSeed;
    const newState = await AuditableChatStateMachine.updateState(chatId, whatsappMessage, {
        seed,
        messageId: whatsappMessage.messageId
    });
    console.log("newState is: ", newState);
    if (newState) currentAuditableChatId = chatId;
    console.log("newState really is: ", await AuditableChatStateMachine.getAuditableChat(chatId));

    // Update DOM
    if (currentAuditableChatId && currentAuditableChatId === chatId) {
        const currentAuditableChat = await AuditableChatStateMachine.getAuditableChat(currentAuditableChatId);
        if (!currentAuditableChat) throw new Error("Auditable Chat still not registered.");
        domProcessorRepository.updateChatState(currentAuditableChat?.currentState, currentAuditableChatId);
    }

    // Se a mensagem for de um chat auditavel eu mando pro back processar
    if (!metadataIsAuditable) return;

    const oldStateIsRequest = (oldState?.currentState === AuditableChatStates.REQUEST_SENT) || (oldState?.currentState === AuditableChatStates.REQUEST_RECEIVED);
    const newStateIsAuditable = newState?.currentState === AuditableChatStates.ONGOING;
    chrome.runtime.sendMessage({
        action: ActionOptions.PROPAGATE_NEW_MESSAGE,
        payload: {
            whatsappMessage,
            startingMessage: (oldStateIsRequest && newStateIsAuditable) ? true : false
        } as GenerateWhatsappMessage,
    } as InternalMessage);
});

window.addEventListener("message", async (event: MessageEvent) => {
    const internalMessage: InternalMessage = event.data;
    if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_CHAT) return;

    const chatId: string = internalMessage.payload;
    if (currentAuditableChatId && (await AuditableChatStateMachine.getAuditableChat(currentAuditableChatId))?.currentState === AuditableChatStates.IDLE) {
        await AuditableChatStateMachine.removeAuditableChat(currentAuditableChatId);
    }

    const auditableState = await AuditableChatStateMachine.getAuditableChat(chatId);
    const currentState = auditableState?.currentState || AuditableChatStates.IDLE;
    AuditableChatStateMachine.setAuditableChat(chatId, {
        currentState,
        internalAuditableChatVariables: auditableState?.internalAuditableChatVariables
    });
    currentAuditableChatId = chatId;

    domProcessorRepository.attachInitAuditableChatButton();
    domProcessorRepository.updateChatState(currentState, currentAuditableChatId);

    chrome.runtime.sendMessage(internalMessage);
});

