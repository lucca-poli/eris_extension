chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'conversation_clicked') {
        const { contactName } = message;
        console.log(`User clicked on conversation with: ${contactName}`);
        // You can perform additional actions here, such as storing the data or sending it to an external API
    }
});
