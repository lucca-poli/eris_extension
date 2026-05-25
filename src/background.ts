import { TabManager, setupTabsListeners } from "./back_utils/tab_manager";
import { setupChromeListeners } from "./back_utils/chrome_messages";
import { generateKeys } from "./back_utils/auditable_chat";
import { logger } from "./core_utils/logger";

logger.init().then(() => {
    logger.info("Logger initialized in service worker.");
});

const tabManager = new TabManager();
setupTabsListeners(tabManager);
setupChromeListeners(tabManager);

// Generate keys
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        logger.info("Generating user's keys.");
        const keys = await generateKeys();

        await chrome.storage.local.set({ ["PRIVATE_KEY"]: keys.privateKey, ["PUBLIC_KEY"]: keys.publicKey });
    }
});

