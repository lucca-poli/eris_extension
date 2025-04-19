import { ActionOptions, AgentOptions, AuditableChatOptions, chatMessage, InternalMessage, InternalMessageMetadata } from "./utils/types"
import { InternalMessager, WindowMessager, ChromeMessager } from "./utils/InternalMessager";

const FrontWindowMessager = new WindowMessager(AgentOptions.CONTENT, AgentOptions.INJECTED);
const FrontChromeMessager = new ChromeMessager(AgentOptions.CONTENT, AgentOptions.BACKGROUND);
const FrontMessager = new InternalMessager([FrontWindowMessager]);

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
            ?.firstElementChild?.firstElementChild?.querySelector("span")?.firstElementChild?.firstElementChild;
        attachmentsDiv?.appendChild(auditableButton);

        return auditableButton;
    }

    // Só posso chamar essa função se tiver certeza que já estou num chat auditável
    private async updateButtonState(): Promise<void> {
        if (this.currentChatId === null) return;
        const { content: lastMessage, author: lastMessageAuthorId } = await this.getLastChatMessage(this.currentChatId);
        const isAuditable = this.auditableChats.has(this.currentChatId as string);
        const lastMessageIsRequest = lastMessage === AuditableChatOptions.REQUEST;
        const lastMessageAuthorIsMe = lastMessageAuthorId !== this.currentChatId;
        //console.log("isAuditable: ", isAuditable)
        //console.log("lastMessage: ", lastMessage)
        //console.log("lastMessageIsRequest: ", lastMessageIsRequest)
        //console.log("lastMessageAuthorIsMe: ", lastMessageAuthorIsMe)

        //@ts-ignore
        this.currentChatButton?.innerHTML = '';
        //console.log(this.auditableChats)

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

    //private processIncomingChatMessage(): void {
    //    const newMessage: InternalMessageMetadata = {
    //        from: AgentOptions.INJECTED,
    //        to: AgentOptions.CONTENT,
    //        action: ActionOptions.RECEIVED_NEW_MESSAGE,
    //    }
    //    FrontMessager.listenMessage(newMessage, (incomingMessage: chatMessage) => {
    //        console.log("new message arrived: ", incomingMessage);
    //    })
    //
    //    // se o chat for auditavel, mando pra background, se não, mando atualizar o state do chat com base na mensagem
    //}

    private searchCurrentChat(): Promise<string | undefined> {
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
        return new Promise((resolve) => {
            const resolveId = (chatId: string | undefined) => resolve(chatId);
            FrontMessager.listenMessage(requireCurrentChatResponse, resolveId);
        })
    }

    private getLastChatMessage(chatId: string): Promise<chatMessage> {
        const requireLastMessage: InternalMessage = {
            from: AgentOptions.CONTENT,
            to: AgentOptions.INJECTED,
            action: ActionOptions.GET_LAST_CHAT_MESSAGE,
            payload: chatId
        };
        FrontMessager.sendMessage(requireLastMessage);

        const requireLastMessageResponse: InternalMessageMetadata = {
            from: AgentOptions.INJECTED,
            to: AgentOptions.CONTENT,
            action: ActionOptions.GET_LAST_CHAT_MESSAGE,
        };
        return new Promise((resolve) => {
            FrontMessager.listenMessage(requireLastMessageResponse, (lastMessage: chatMessage) => {
                if (lastMessage.content === undefined || lastMessage.author === undefined) {
                    throw new Error(`Couldn't read last message in chat: ${this.currentChatId}`)
                };
                resolve(lastMessage);
            });
        });
    }

    private setupMessageInterception(): void {
        console.log("trying to attach remove text listeners")
        const chatId = this.currentChatId;
        if (chatId === null) {
            console.log("chatId is null");
            return;
        };

        function getInputWrapper(): Element | null {
            const matches = document.querySelectorAll('p.selectable-text.copyable-text');
            console.log("got input wrapper: ", matches[matches.length - 1])
            return matches[matches.length - 1];
        }
        // Function to get current input text
        function getInputText(): string | null {
            // Find the input wrapper
            const inputWrapper = getInputWrapper()
            if (!inputWrapper) return null;

            // Find span with text inside the wrapper
            const textSpan: HTMLElement | null = inputWrapper?.children[0] as HTMLElement;

            // If we found the span, return its content, otherwise the input is empty
            return textSpan ? textSpan.textContent?.trim() || '' : '';
        }

        // Function to clear the input box
        function clearInputBox(): void {
            const requestCleanInputBox: InternalMessage = {
                from: AgentOptions.CONTENT,
                to: AgentOptions.INJECTED,
                action: ActionOptions.CLEAN_INPUT_TEXT_BOX,
                payload: chatId
            };
            FrontMessager.sendMessage(requestCleanInputBox);
        }

        // Function to handle message sending
        function handleSendAttempt(): void {
            const inputText: string | null = getInputText();

            // Only process if there's text in the input
            if (inputText && inputText.length > 0) {
                // Process the input text (replace this with your actual processing)
                processInput(inputText);

                // Clear the input box after processing
                clearInputBox();
            }
        }

        // Dummy process function (replace with your actual implementation)
        function processInput(text: string): void {
            console.log('Processing input text:', text);
            // Your actual processing logic would go here
        }

        // Watch for send button clicks
        const sendButton: Element | null = document.querySelector('button[data-tab="11"]');
        const buttonListener = (ev: MouseEvent) => {
            // Look for the send button
            ev.preventDefault();
            ev.stopPropagation();
            //ev.stopPropagation();
            if (sendButton) {
                handleSendAttempt();
            }
        }
        document.removeEventListener("click", buttonListener)
        document.addEventListener('click', buttonListener);

        // Watch for Enter key presses (without Shift)
        const enterListener = (event: KeyboardEvent) => {
            console.log("which key was pressed: ", event.key);
            if (event.key === 'Enter' && !event.shiftKey) {
                // Check if we're currently focused on the input field
                // Prevent the default Enter behavior
                event.preventDefault();
                handleSendAttempt();
            }
        };
        document.removeEventListener("keydown", enterListener)
        document.addEventListener('keydown', enterListener);
    }

    private updateChatState() {
        setInterval(async () => {
            const contactId = await this.searchCurrentChat();
            const isSingleContact = !!contactId;
            const isNewChat = contactId !== this.currentChatId;
            if (isNewChat) {
                if (isSingleContact) {
                    this.currentChatId = contactId;
                    this.currentChatButton = this.attachInitAuditableChatButton();
                    this.setupMessageInterception()
                } else {
                    this.currentChatId = null;
                    this.currentChatButton = null;
                }
            };

            if (this.currentChatId === null) return;
            const lastChatMessage = await this.getLastChatMessage(this.currentChatId)

            this.updateButtonState();

            const isAuditable = this.auditableChats.has(this.currentChatId as string);
            if (!isAuditable) return;

            const sendMessageBackground: InternalMessage = {
                from: AgentOptions.CONTENT,
                to: AgentOptions.BACKGROUND,
                action: ActionOptions.SEND_MESSAGE_TO_BACKGROUND,
                payload: lastChatMessage
            }
            FrontChromeMessager.sendMessage(sendMessageBackground, (response: string) => {
                console.log("content of the message: ", response)
            })
            //3. Else if it is instanciate pass to background to process (just console by now)
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
