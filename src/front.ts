import { AuditableChatStateMachine } from "./utils/auditable_chat_state_machine";
import { AckMetadata, AckMetadataSchema, ActionOptions, AuditableBlock, AuditableChatOptions, AuditableChatStates, AuditableMessage, GenerateAuditableMessage, GetCommitedKeys, GetMessages, InternalMessage, SendFileMessage } from "./utils/types"

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

    private updateButtonState(currentState: AuditableChatStates, chatId: string): void {
        //@ts-ignore
        this.currentChatButton?.innerHTML = '';

        if (currentState === AuditableChatStates.ONGOING) {
            const endAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            // @ts-ignore
            endAuditableButton.innerText = "🔲";

            endAuditableButton.addEventListener("click", async () => {
                const auditableState = await AuditableChatStateMachine.getAuditable(chatId);
                if (!auditableState) throw new Error("There should be a conversation created.");
                if (!auditableState.auditableChatReference) throw new Error("There should be a auditable chat reference.");
                console.log("auditableState before finishing: ", auditableState);

                const returnedMessageId: string = await chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        content: AuditableChatOptions.END,
                        chatId,
                        author: await AuditableChatStateMachine.getUserId()
                    } as AuditableMessage
                } as InternalMessage);

                const getMessages: GetMessages = {
                    chatId,
                    options: {
                        // Add one to include initial block
                        count: auditableState.auditableChatReference.counter,
                        direction: "before",
                        id: returnedMessageId
                    }
                }
                const auditableMessages: AuditableMessage[] = await chrome.runtime.sendMessage({
                    action: ActionOptions.GET_MESSAGES,
                    payload: getMessages
                } as InternalMessage);
                console.log("Auditable Messages: ", auditableMessages);

                const publicLogs = auditableMessages.map((message) => message.metadata?.block as AuditableBlock);
                const publicJson = JSON.stringify(publicLogs);

                console.log("Public Logs: ", publicLogs);
                const seed = auditableState.auditableChatReference?.auditableChatSeed;
                const counters = publicLogs.map((hashblock) => hashblock.counter);
                console.log("counters: ", counters);
                const commitedKeys: string[] = await chrome.runtime.sendMessage({
                    action: ActionOptions.GET_COMMITED_KEYS,
                    payload: { counters, seed } as GetCommitedKeys
                } as InternalMessage);
                console.log("commited keys: ", commitedKeys)

                const privateLogs = auditableMessages.map((message, index) => {
                    const commitedKey = commitedKeys[index]
                    if (!commitedKey) {
                        console.error(message);
                        throw new Error("No counter for HashBlock.");
                    }
                    return {
                        content: message.content as string,
                        author: message.author,
                        commitedKey,
                        counter: counters[index]
                    };
                });
                const privateJson = JSON.stringify({
                    initialCommitedKey: commitedKeys[0],
                    logMessages: privateLogs.slice(1)
                });

                const dateToday = new Date().toISOString().split('T')[0];

                await chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_FILE_MESSAGE,
                    payload: {
                        chatId,
                        fileContent: privateJson,
                        fileName: `private_logs_${dateToday}.json`
                    } as SendFileMessage
                } as InternalMessage);

                await chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_FILE_MESSAGE,
                    payload: {
                        chatId,
                        fileContent: publicJson,
                        fileName: `public_logs_${dateToday}.json`
                    } as SendFileMessage
                } as InternalMessage);
            });

            this.currentChatButton?.appendChild(endAuditableButton);
        }

        if (currentState === AuditableChatStates.IDLE) {
            const requireAuditableButton = this.createBaseButton("button", 46) as HTMLButtonElement;
            // @ts-ignore
            requireAuditableButton.innerText = "🔲";

            requireAuditableButton.addEventListener("click", async () => {
                chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        content: AuditableChatOptions.REQUEST,
                        chatId,
                        author: await AuditableChatStateMachine.getUserId()
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

            acceptAuditableButton.addEventListener("click", async () => {
                this.setupChatbox(chatId);

                chrome.runtime.sendMessage({
                    action: ActionOptions.GENERATE_AND_SEND_BLOCK,
                    payload: {
                        auditableMessage: {
                            chatId,
                            content: AuditableChatOptions.ACCEPT,
                            author: await AuditableChatStateMachine.getUserId(),
                        },
                        startingMessage: true,
                    } as GenerateAuditableMessage,
                } as InternalMessage);
            });

            denyAuditableButton.addEventListener("click", async () => {
                chrome.runtime.sendMessage({
                    action: ActionOptions.SEND_TEXT_MESSAGE,
                    payload: {
                        chatId,
                        content: AuditableChatOptions.DENY,
                        author: await AuditableChatStateMachine.getUserId()
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

        customInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Backspace' && auditableChatbox?.textContent?.length === 0) e.preventDefault();

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (auditableChatbox?.textContent?.length === 0) return; // do nothing on messages with no text

                chrome.runtime.sendMessage({
                    action: ActionOptions.GENERATE_AND_SEND_BLOCK,
                    payload: {
                        auditableMessage: {
                            content: auditableChatbox.textContent,
                            chatId,
                            author: await AuditableChatStateMachine.getUserId()
                        },
                        startingMessage: false,
                    } as GenerateAuditableMessage,
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

    updateChatState(currentState: AuditableChatStates, chatId: string) {
        this.updateButtonState(currentState, chatId);
        if (currentState === AuditableChatStates.ONGOING) this.setupChatbox(chatId);
    }
}

let currentAuditableChatId: string | null = null;
const domProcessorRepository = new DomProcessor();

window.addEventListener("message", async (event: MessageEvent) => {
    const internalMessage: InternalMessage = event.data;
    if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_MESSAGE) return;

    const incomingChatMessage = internalMessage.payload as AuditableMessage | AckMetadata;
    const ackMetada = AckMetadataSchema.safeParse(incomingChatMessage);
    if (ackMetada.success) {
        // Manage AuditableChats state
        const newState = await AuditableChatStateMachine.updateState(ackMetada.data.receiver, ackMetada.data);
        if (newState) currentAuditableChatId = ackMetada.data.receiver;

        // Update DOM
        if (currentAuditableChatId && currentAuditableChatId === ackMetada.data.receiver) {
            const currentAuditableChat = await AuditableChatStateMachine.getAuditable(currentAuditableChatId);
            if (!currentAuditableChat) throw new Error("Auditable Chat still not registered.");
            domProcessorRepository.updateChatState(currentAuditableChat?.currentState, currentAuditableChatId);
        }
    } else {
        const auditableMessage = incomingChatMessage as AuditableMessage;
        const { chatId } = auditableMessage;
        const oldState = await AuditableChatStateMachine.getAuditable(chatId);
        console.log("oldState is: ", oldState);

        // Manage AuditableChats state
        const newState = await AuditableChatStateMachine.updateState(chatId, auditableMessage, auditableMessage.metadata?.seed);
        console.log("newState is: ", newState);
        if (newState) currentAuditableChatId = chatId;

        // Update DOM
        if (currentAuditableChatId && currentAuditableChatId === chatId) {
            const currentAuditableChat = await AuditableChatStateMachine.getAuditable(currentAuditableChatId);
            if (!currentAuditableChat) throw new Error("Auditable Chat still not registered.");
            domProcessorRepository.updateChatState(currentAuditableChat?.currentState, currentAuditableChatId);
        }

        // Se a mensagem for de um chat auditavel eu mando pro back processar
        if (!auditableMessage.metadata) return;

        const oldStateIsRequest = (oldState?.currentState === AuditableChatStates.REQUEST_SENT) || (oldState?.currentState === AuditableChatStates.REQUEST_RECEIVED);
        console.log("oldStateIsRequest is: ", oldStateIsRequest);
        const newStateIsAuditable = newState?.currentState === AuditableChatStates.ONGOING;
        console.log("newStateIsAuditable is: ", newStateIsAuditable);
        chrome.runtime.sendMessage({
            action: ActionOptions.PROPAGATE_NEW_MESSAGE,
            payload: {
                auditableMessage: incomingChatMessage,
                startingMessage: (oldStateIsRequest && newStateIsAuditable) ? true : false
            } as GenerateAuditableMessage,
        } as InternalMessage);
    }
});

window.addEventListener("message", async (event: MessageEvent) => {
    const internalMessage: InternalMessage = event.data;
    if (internalMessage.action !== ActionOptions.PROPAGATE_NEW_CHAT) return;

    const chatId: string = internalMessage.payload;
    if (currentAuditableChatId && (await AuditableChatStateMachine.getAuditable(currentAuditableChatId))?.currentState === AuditableChatStates.IDLE) {
        await AuditableChatStateMachine.removeAuditable(currentAuditableChatId);
    }

    const auditableState = await AuditableChatStateMachine.getAuditable(chatId);
    const currentState = auditableState?.currentState || AuditableChatStates.IDLE;
    AuditableChatStateMachine.setAuditable(chatId, {
        currentState
    });
    currentAuditableChatId = chatId;

    domProcessorRepository.attachInitAuditableChatButton();
    domProcessorRepository.updateChatState(currentState, currentAuditableChatId);

    chrome.runtime.sendMessage(internalMessage);
});

