// Function to check if the user is logged in
function isLoggedIn() {
    return document.getElementById('side') !== null;
}

// Function to attach event listeners to conversation elements
function attachConversationListeners() {
    const conversationElements = document.querySelectorAll('.x1y332i5.x1n2onr6.x6ikm8r.x10wlt62 > *');
    conversationElements.forEach((element) => {
        element.addEventListener('click', () => {
            // Extract conversation details (e.g., contact name)
            const contactName = element.querySelector('div.x1iyjqo2.x6ikm8r.x10wlt62.x1n2onr6.xlyipyv.xuxw1ft.x1rg5ohu._ao3e')?.getAttribute('title');
            if (contactName) {
                // Send the conversation details to the background script
                chrome.runtime.sendMessage({ type: 'conversation_clicked', contactName });
            }
        });
    });
}

// Main logic
if (isLoggedIn()) {
    console.log('User is logged in.');
    attachConversationListeners();
} else {
    console.log('User is not logged in.');
    // Optionally, you can set up a MutationObserver to detect when the user logs in
    const observer = new MutationObserver((mutations) => {
        if (isLoggedIn()) {
            console.log('User has logged in.');
            attachConversationListeners();
            observer.disconnect(); // Stop observing once the user is logged in
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
