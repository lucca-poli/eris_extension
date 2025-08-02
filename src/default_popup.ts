import { ChatState } from "./utils/types";
import { AuditableChatStateMachine } from "./utils/auditable_chat_state_machine";

const root = document.getElementById('root');
if (!root) throw new Error("Couldn't find popup root element.");

(async function() {
    await loadPopupContent(root);
})();

async function loadPopupContent(root: HTMLElement) {
    // Clear existing content
    root.innerHTML = '';

    // Get fresh data
    const chats = await AuditableChatStateMachine.getAll();

    // Create and append chat states display
    const chatsDiv = createChatStatesDisplay(chats);
    root.appendChild(chatsDiv);

    // Create delete button
    const deleteAllButton = document.createElement("button");
    deleteAllButton.textContent = "Delete current chats";
    deleteAllButton.style.marginTop = "10px";
    deleteAllButton.style.padding = "5px 10px";

    // Set up the delete handler properly
    deleteAllButton.onclick = async () => {
        await AuditableChatStateMachine.removeAllChats();

        // Option 1: Reload popup content without closing/reopening
        await loadPopupContent(root);

        // Option 2: Close and reopen popup (only works in background script)
        // window.close();
        // setTimeout(() => chrome.action.openPopup(), 100);
    };

    root.appendChild(deleteAllButton);
}

function createChatStatesDisplay(chats: Record<string, ChatState>): HTMLElement {
    const stateDiv = document.createElement("div");

    // Handle empty state
    if (Object.keys(chats).length === 0) {
        const emptyState = document.createElement("p");
        emptyState.textContent = "No chats available";
        stateDiv.appendChild(emptyState);
        return stateDiv;
    }

    for (const chatId in chats) {
        const { currentState } = chats[chatId];
        const state = document.createElement("div");
        state.style.display = "flex";
        state.style.flexDirection = "row";
        state.style.marginBottom = "5px";

        const chatIdDiv = document.createElement("div");
        chatIdDiv.style.backgroundColor = "gray";
        chatIdDiv.style.padding = "3px 6px";
        chatIdDiv.style.color = "white";
        chatIdDiv.style.marginRight = "5px";
        chatIdDiv.textContent = chatId;

        const currentStateDiv = document.createElement("div");
        currentStateDiv.style.backgroundColor = "lightgray";
        currentStateDiv.style.padding = "3px 6px";
        currentStateDiv.textContent = currentState;


        state.appendChild(chatIdDiv);
        state.appendChild(currentStateDiv);
        stateDiv.appendChild(state);
    }

    return stateDiv;
}
