import "@wppconnect/wa-js"

//WhatsappLayer.on('chat.new_message', async (chatMessage) => {
//    const arrivedMessage: chatMessage = {
//        content: chatMessage.body as string,
//        author: chatMessage.from?._serialized as string,
//    }
//    const response: InternalMessage = {
//        from: AgentOptions.INJECTED,
//        to: AgentOptions.CONTENT,
//        action: ActionOptions.RECEIVED_NEW_MESSAGE,
//        payload: arrivedMessage
//    }
//    InjectedMessager.sendMessage(response);
//});
