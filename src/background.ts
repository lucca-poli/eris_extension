import { ActionOptions, InternalMessage, AuditableMessage } from "./utils/types";
import { sendTextMessage, getCurrentTab, getLastChatMessage, setInputbox } from "./utils/chrome_lib"

chrome.commands.onCommand.addListener((shortcut) => {
    if (shortcut === "reload") {
        console.log("Reloaded extension!");
        chrome.runtime.reload();
    }
})

console.log("background loaded");

class AuditableChat {
    lastHash: string;
    private chatId: string;

    constructor(chatId: string) {
        this.lastHash = this.initAuditableChat();
        this.chatId = chatId;
    };

    private initAuditableChat() {
        const initialization_process = "init_";
        return initialization_process;
    };

    calculateHash(messageToProcess: string) {
        const newHash = messageToProcess + "_";
        this.updateHash(newHash);
        return newHash;
    }

    updateHash(incomingHash: string) {
        this.lastHash = incomingHash;
    }
}

const auditableChats: Map<string, AuditableChat> = new Map([]);

chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
    if (internalMessage.action !== ActionOptions.PROCESS_AUDITABLE_MESSAGE) return;

    // Se for uma string é uma mensagem do usuário e devo processar, se não a mensagem vem de fora
    const arrivedMessage = internalMessage.payload as AuditableMessage;

    let auditableChat = auditableChats.get(arrivedMessage.chatId)
    if (!auditableChat) auditableChat = new AuditableChat(arrivedMessage.chatId);

    if (arrivedMessage.authorIsMe) {
        arrivedMessage.hash = auditableChat.calculateHash(arrivedMessage.content as string);

        (async () => {
            const tabId = (await getCurrentTab()).id as number;
            await sendTextMessage(tabId, arrivedMessage);
        })();
    } else {
        auditableChat.updateHash(arrivedMessage.hash as string)
    }
});

chrome.runtime.onMessage.addListener((internalMessage: InternalMessage) => {
    if (internalMessage.action !== ActionOptions.SET_INPUT_BOX) return;

    const message = internalMessage.payload as string;
    (async () => {
        const tabId = (await getCurrentTab()).id as number;
        setInputbox(tabId, message);
    })();
})

chrome.runtime.onMessage.addListener((internalMessage: InternalMessage, _sender, sendResponse) => {
    if (internalMessage.action !== ActionOptions.SEND_TEXT_MESSAGE) return;

    (async () => {
        const tabId = (await getCurrentTab()).id as number;
        const messageReturn = await sendTextMessage(tabId, internalMessage.payload as AuditableMessage);
        console.log("Message return: ", messageReturn)
        // Cannot send complex objects
        sendResponse(messageReturn?.id);
    })();

    return true;
});

chrome.runtime.onMessage.addListener((internalMessage: InternalMessage, _sender, sendResponse) => {
    if (internalMessage.action !== ActionOptions.GET_LAST_CHAT_MESSAGE) return;

    (async () => {
        const tabId = (await getCurrentTab()).id as number;
        const chatId = internalMessage.payload as string;
        const lastChatMessage = await getLastChatMessage(tabId, chatId);
        // Cannot send complex objects
        sendResponse(lastChatMessage)
    })();

    return true;
});
