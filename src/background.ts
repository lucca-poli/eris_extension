import { ChromeMessager } from "./utils/InternalMessager";
import { ActionOptions, AgentOptions, InternalMessageMetadata } from "./utils/types";

const BackChromeMessager = new ChromeMessager(AgentOptions.CONTENT, AgentOptions.BACKGROUND);

console.log("background loaded");
const lastMessageBackground: InternalMessageMetadata = {
    from: AgentOptions.CONTENT,
    to: AgentOptions.BACKGROUND,
    action: ActionOptions.SEND_MESSAGE_TO_BACKGROUND,
}
BackChromeMessager.listenMessage(lastMessageBackground, (payload: any) => {
    console.log("payload arrived: ", payload)
})
