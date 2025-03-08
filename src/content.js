// Communicate with MAIN world script
window.addEventListener('message', (event) => {
    if (event.data.type === 'WA_JS_READY') {
        console.log('WA-JS is ready!');
    }
});

// Function to attach event listeners to conversation elements
function attachConversationListeners() {
    const conversationElements = document.querySelectorAll('.x11n2onr6.x6ikm8r.x10wlt62 > *');
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

function waitLogging() {
    console.log('User is not logged in.');
    console.log(WPP.conn.isAuthenticated())
    const observer = new MutationObserver(() => {
        if (window.WPP.conn.isAuthenticated()) {
            console.log('User has logged in.');
            attachConversationListeners();
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

//waitLogging();

