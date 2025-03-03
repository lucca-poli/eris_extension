/**
 * WA-JS Type Definitions (JSDoc)
 * @typedef {Object} WPP
 * @property {Object} webpack - WA-JS initialization utilities
 * @property {function(function): void} webpack.onReady - Callback when WA-JS is ready
 * @property {Object} chat - Messaging APIs
 * @property {function(string, string): Promise<void>} chat.sendTextMessage
 */

// Communicate with MAIN world script
//window.postMessage({ type: 'WA_JS_READY_CHECK' }, '*');
//
//window.addEventListener('message', async (event) => {
//    if (event.data.type === 'WA_JS_READY') {
//        // Use WA-JS APIs
//        /** @type {WPP} */
//        const WPP = window.WPP;
//        //WPP.chat.sendTextMessage('1234567890@c.us', 'Hello from extension!');
//
//        try {
//            const chats = await WPP.chat.list({ count: 20 });
//            console.log(chats);
//        } catch (error) {
//            console.error('Error fetching chats:', error);
//        }
//    }
//});

//window.addEventListener('message', (event) => {
//  if (event.data.type === 'WA_JS_READY') {
//    // Use WA-JS APIs
//    /** @type {WPP} */
//    const WPP = window.WPP;
//    WPP.chat.sendTextMessage('1234567890@c.us', 'Hello from extension!');
//  }
//});

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

