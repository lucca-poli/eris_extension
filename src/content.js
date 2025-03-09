window.addEventListener('message', (event) => {
    //console.log("got a event:", event);
    if (event.data.type === 'WPP_FULLY_READY') {
        console.log('WA-JS is ready!');
        clearInterval(event.data.intervalId);
        console.log(document.body);
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

function updateSelectedConversation() {
    const interval = setInterval(() => {
        const conversationPanel = document.getElementById("main");
        if (conversationPanel !== null) {
            const namePlaceholder = document.getElementById("main").querySelector("header")?.children[1]?.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild;
            /** @type {string | undefined} */
            const contactNameRaw = (namePlaceholder?.firstElementChild?.alt !== undefined) ?
                namePlaceholder?.innerText + namePlaceholder?.firstElementChild?.alt :
                namePlaceholder?.innerText;
            const contactName = contactNameRaw?.trim();
            const isSingleContact = !(contactName === "" || contactName === undefined);
        };
    }, 1000);
}

updateSelectedConversation();
