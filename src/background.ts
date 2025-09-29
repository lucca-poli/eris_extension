import { TabManager, setupTabsListeners } from "./back_utils/tab_manager";
import { setupChromeListeners } from "./back_utils/chrome_messages";
import { generateKeys } from "./back_utils/auditable_chat";

console.log("background loaded");

const tabManager = new TabManager();
setupTabsListeners(tabManager);
setupChromeListeners(tabManager);

// Generate keys
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        console.log("Generating user's keys.");
        const keys = await generateKeys();

        await chrome.storage.local.set({ ["PRIVATE_KEY"]: keys.privateKey, ["PUBLIC_KEY"]: keys.publicKey });
    }
});

// chrome.storage.onChanged.addListener((changes, areaName) => {
//     console.group(`%c🔄 Chrome Storage Change in ${areaName}`, 'color: #2196F3; font-weight: bold;');
//
//     for (const [key, change] of Object.entries(changes)) {
//         console.log(`Key: ${key}`);
//         console.log('Old Value:', change.oldValue);
//         console.log('New Value:', change.newValue);
//         console.log('---');
//     }
//
//     console.log('Area:', areaName); // 'local', 'sync', 'managed', or 'session'
//     console.log('Timestamp:', new Date().toISOString());
//     console.groupEnd();
// });
