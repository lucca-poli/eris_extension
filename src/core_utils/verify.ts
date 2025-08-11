import { AuditableChatMetadata, AuditableMessageContent, AuditableMetadata, MetadataOptions, PreviousBlockVerificationData, WhatsappMessage } from "../utils/types";
import { AuditableChatStateMachine } from "../utils/auditable_chat_state_machine";
import { generateBlock, generateCommitedMessage } from "../back_utils/auditable_chat";

export async function verificationRoutine(chatId: string, whatsappMessage: WhatsappMessage, startingMessage: boolean, previousAuditableBlock?: PreviousBlockVerificationData) {
    const metadataIsAuditable = whatsappMessage.metadata?.kind === MetadataOptions.AUDITABLE;
    if (!metadataIsAuditable) throw new Error("Incoming auditable message has no block.");
    const auditableBlock = (whatsappMessage.metadata as AuditableMetadata)?.block;

    // Acquiring previous message data
    const auditableState = (
        await AuditableChatStateMachine.getAuditableChat(chatId)
    )?.internalAuditableChatVariables;
    if (!auditableState) throw new Error("Auditable chat has no state.");
    let { previousHash, counter } = auditableState;
    if (previousAuditableBlock) {
        previousHash = previousAuditableBlock.hash;
        counter = previousAuditableBlock.controlCounter;
    }
    console.log("Verifying message: ", whatsappMessage);
    console.log("previousHash used in verification: ", previousHash);
    console.log("counter used in verification: ", counter);

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
    const messageToProcess: AuditableMessageContent | AuditableChatMetadata = startingMessage ?
        {
            timestamp: new Date().toISOString().split('T')[0]
        } :
        {
            content: whatsappMessage.content as string,
            author: whatsappMessage.author
        };
    const commitedMessage = await generateCommitedMessage(chatId, messageToProcess, auditableBlock.counter);
    if (commitedMessage !== auditableBlock.commitedMessage) throw new Error("Commited message created from block items is diferent from incoming commited message.")
}
