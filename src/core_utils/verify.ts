import { AuditableChatMetadata, AuditableMessageContent, AuditableMetadata, MetadataOptions, PreviousBlockVerificationData, WhatsappMessage } from "../utils/types";
import { AuditableChatStateMachine } from "../utils/auditable_chat_state_machine";
import { convertTextKey, generateBlock, generateCommitedMessage, generateSignature, getPrivateKey, getPublicKey, verifySignature } from "../back_utils/auditable_chat";

export async function verificationRoutine(chatId: string, whatsappMessage: WhatsappMessage, startingMessage: boolean, previousAuditableBlock?: PreviousBlockVerificationData) {
    const metadataIsAuditable = whatsappMessage.metadata?.kind === MetadataOptions.AUDITABLE;
    if (!metadataIsAuditable) throw new Error("Incoming auditable message has no block.");
    const auditableMetadata = whatsappMessage.metadata as AuditableMetadata;
    const auditableBlock = (whatsappMessage.metadata as AuditableMetadata).block;

    // Acquiring previous message data
    const auditableState = (
        await AuditableChatStateMachine.getAuditableChat(chatId)
    )?.internalAuditableChatVariables;
    if (!auditableState) throw new Error("Auditable chat has no state.");
    const counterpartPublicKey = auditableState.counterpartPublicKey;
    if (!counterpartPublicKey) throw new Error("Chat counterpart public key not to be found.");
    const counterpartPublicKeyReadable = await convertTextKey(counterpartPublicKey);
    const ownPublicKey = await getPublicKey();
    if (!ownPublicKey) throw new Error("Chat own public key not to be found.");
    let { previousHash, counter } = auditableState;
    if (previousAuditableBlock) {
        previousHash = previousAuditableBlock.hash;
        counter = previousAuditableBlock.controlCounter;
    }
    console.log("Verifying message: ", whatsappMessage);
    console.log("previousHash used in verification: ", previousHash);
    console.log("counter used in verification: ", counter);

    // Verifying signature
    console.log("Checking signature in message.");
    const authorIsSelf = whatsappMessage.author !== whatsappMessage.chatId;
    const publicKey = authorIsSelf ? ownPublicKey : counterpartPublicKeyReadable;
    const signResult = await verifySignature(publicKey, auditableMetadata.signature, auditableBlock);
    if (!signResult) {
        if (authorIsSelf) {
            const privateKey = await getPrivateKey();
            if (!privateKey) throw new Error("could in");
            const signature = await generateSignature(privateKey, auditableBlock);
            console.error("Message from author: ", authorIsSelf, '\n',
                "public key is: ", await crypto.subtle.exportKey('jwk', publicKey), '\n',
                "message:", whatsappMessage, '\n',
                "signature should be: ", signature
            );
        } else {
            console.error("Message from author: ", authorIsSelf, '\n',
                "public key is: ", await crypto.subtle.exportKey('jwk', publicKey), '\n',
                "message:", whatsappMessage
            );
        }
        throw new Error("False signature!");
    }

    // Verifying counter - Todos os erros a seguir deveriam encerrar a conversa auditavel
    if (auditableBlock.counter < counter) {
        console.error("Previous hash: ", previousHash);
        console.error("Previous counter: ", counter);
        console.error("Current message: ", whatsappMessage);
        console.error("Invalid message counter, ending current auditable chat!");
        throw new Error("Invalid message counter, ending current auditable chat!");
    }
    if (auditableBlock.counter > counter) {
        console.error("Previous hash: ", previousHash);
        console.error("Previous counter: ", counter);
        console.error("Current message: ", whatsappMessage);
        console.error("Incoming message out of order.");
        throw new Error("Incoming message out of order.");
    }

    // Verifying hashes
    const generatedBlock = await generateBlock(auditableBlock.commitedMessage, {
        counter: auditableBlock.counter,
        hash: auditableBlock.previousHash
    });
    // console.log("generated block from incoming message: ", generatedBlock);
    if (generatedBlock.hash !== auditableBlock.hash) throw new Error("Hash created from block items is diferent from incoming hash.");
    if (auditableBlock.previousHash !== previousHash) throw new Error("Previous hash from incoming message and internal state differs.");

    // Verifying commitedMessage
    const chatInitTimestamp = auditableMetadata.initialTimestamp;
    const messageToProcess: AuditableMessageContent | AuditableChatMetadata = startingMessage ?
        {
            timestamp: chatInitTimestamp as string
        } :
        {
            message: whatsappMessage.content as string,
            author: whatsappMessage.author
        };
    if (startingMessage && !(messageToProcess as AuditableChatMetadata).timestamp) throw new Error("No initial timestamp found.");
    const commitedMessage = await generateCommitedMessage(chatId, messageToProcess, auditableBlock.counter);
    if (commitedMessage !== auditableBlock.commitedMessage) throw new Error("Commited message created from block items is diferent from incoming commited message.")
}
