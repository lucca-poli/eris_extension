import { AuditableChatStateMachine } from "./auditable_chat_state_machine";
import { ActionOptions, AuditableControlMessage, WhatsappMessage, InternalMessage } from "./types";

export async function displayRequestWindow(chatId: string) {
    const floatWindow = document.createElement('div');
    floatWindow.id = "secure-chat-extension-request-modal";

    // Style the overlay (background that covers entire screen)
    floatWindow.style.position = "fixed";
    floatWindow.style.width = "100%";
    floatWindow.style.height = "100%";
    floatWindow.style.background = "rgba(29, 31, 31, 0.8)"; // #1D1F1F with transparency
    floatWindow.style.zIndex = "2147483647"; // Maximum z-index
    floatWindow.style.display = "flex";
    floatWindow.style.justifyContent = "center";
    floatWindow.style.alignItems = "center"; // Changed from alignContent to alignItems

    // Create the modal content container
    const modalContent = document.createElement('div');
    modalContent.style.background = "#242626"; // Dark gray background
    modalContent.style.borderRadius = "12px";
    modalContent.style.padding = "32px";
    modalContent.style.maxWidth = "400px";
    modalContent.style.width = "90%";
    modalContent.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.4)";
    modalContent.style.textAlign = "center";
    modalContent.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    // Create title element
    const title = document.createElement('h3');
    title.id = "secure-chat-extension-request-modal-title";
    title.textContent = "Do you want to start a secure chat?";
    title.style.color = "#FFFFFF"; // White text
    title.style.fontSize = "20px";
    title.style.fontWeight = "600";
    title.style.margin = "0 0 16px 0";
    title.style.lineHeight = "1.3";

    // Create description element
    const description = document.createElement('div');
    description.id = "secure-chat-extension-request-modal-description";
    description.textContent = "You and your contact can export messages to be used as evidence.\nNobody will be able to manipulate the conversation (e.g. delete or edit).";
    description.style.color = "#D9FDD3"; // Light green text
    description.style.fontSize = "14px";
    description.style.lineHeight = "1.5";
    description.style.margin = "0 0 24px 0";
    description.style.whiteSpace = "pre-line"; // Preserve line breaks from \n

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.gap = "12px";
    buttonsContainer.style.justifyContent = "center";

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.id = "secure-chat-extension-request-modal-close-button";
    closeButton.textContent = "Close";
    closeButton.style.background = "#103529"; // Dark green
    closeButton.style.color = "#D9FDD3"; // Light green text
    closeButton.style.border = "1px solid #21C063"; // Green border
    closeButton.style.borderRadius = "8px";
    closeButton.style.padding = "10px 20px";
    closeButton.style.fontSize = "14px";
    closeButton.style.fontWeight = "500";
    closeButton.style.cursor = "pointer";
    closeButton.style.transition = "all 0.2s ease";
    closeButton.style.minWidth = "100px";

    // Add hover effect for close button
    closeButton.addEventListener('mouseenter', () => {
        closeButton.style.background = "#1a4a33";
        closeButton.style.transform = "translateY(-1px)";
    });
    closeButton.addEventListener('mouseleave', () => {
        closeButton.style.background = "#103529";
        closeButton.style.transform = "translateY(0)";
    });

    // Create request button
    const requestButton = document.createElement('button');
    requestButton.id = "secure-chat-extension-request-modal-request-button";
    requestButton.textContent = "Request Secure Chat";
    requestButton.style.background = "#21C063"; // Bright green
    requestButton.style.color = "#103529"; // Dark green text
    requestButton.style.border = "none";
    requestButton.style.borderRadius = "8px";
    requestButton.style.padding = "10px 20px";
    requestButton.style.fontSize = "14px";
    requestButton.style.fontWeight = "600";
    requestButton.style.cursor = "pointer";
    requestButton.style.transition = "all 0.2s ease";
    requestButton.style.minWidth = "140px";

    // Add hover effect for request button
    requestButton.addEventListener('mouseenter', () => {
        requestButton.style.background = "#1db559";
        requestButton.style.transform = "translateY(-1px)";
        requestButton.style.boxShadow = "0 4px 12px rgba(33, 192, 99, 0.3)";
    });
    requestButton.addEventListener('mouseleave', () => {
        requestButton.style.background = "#21C063";
        requestButton.style.transform = "translateY(0)";
        requestButton.style.boxShadow = "none";
    });

    // Append buttons to container
    buttonsContainer.appendChild(closeButton);
    buttonsContainer.appendChild(requestButton);

    // Append all elements to modal content
    modalContent.appendChild(title);
    modalContent.appendChild(description);
    modalContent.appendChild(buttonsContainer);

    // Append modal content to overlay
    floatWindow.appendChild(modalContent);

    // Add click outside to close functionality
    floatWindow.addEventListener('click', (event) => {
        if (event.target === floatWindow) {
            // Clicked on overlay background, close modal
            floatWindow.remove();
        }
    });

    // Add event listeners for buttons
    closeButton.addEventListener('click', () => {
        floatWindow.remove();
    });

    requestButton.addEventListener('click', async () => {
        chrome.runtime.sendMessage({
            action: ActionOptions.SEND_TEXT_MESSAGE,
            payload: {
                content: AuditableControlMessage.REQUEST,
                chatId,
                author: await AuditableChatStateMachine.getUserId()
            } as WhatsappMessage
        } as InternalMessage);
        console.log('Secure chat requested!');
        floatWindow.remove();
    });

    document.body.appendChild(floatWindow);
}
