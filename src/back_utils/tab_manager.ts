import { AuditableChatStateMachine } from "../utils/auditable_chat_state_machine";

// Tab manager - Manages current whatsapp web session
export class TabManager {
    private currentTab?: chrome.tabs.Tab;
    constructor() {
        this.getLatestWhatsappTab();
    }

    private async getLatestWhatsappTab() {
        const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
            chrome.tabs.query({}, resolve);
        });
        const whatsappTabs = tabs.filter(tab =>
            tab.url?.includes("https://web.whatsapp.com/") && !!tab.lastAccessed
        ).sort(
            (a, b) => (b.lastAccessed! - a.lastAccessed!)
        );

        if (whatsappTabs) this.currentTab = whatsappTabs[0];
    }

    updateTab(newTab?: chrome.tabs.Tab) {
        this.currentTab = newTab;
    }

    getWhatsappTab() {
        if (!this.currentTab) throw new Error("No Whatsapp Web tab available");
        return this.currentTab
    }
}

export function setupTabsListeners(tabManager: TabManager) {
    chrome.tabs.onUpdated.addListener(async (_tabId, _changeInfo, tab) => {
        if (!tab.url?.includes("https://web.whatsapp.com/")) return;
        await AuditableChatStateMachine.removeIdleChats();
        tabManager.updateTab(tab);
    });

    chrome.tabs.onRemoved.addListener(async (tabId) => {
        if (tabManager.getWhatsappTab().id === tabId) {
            await AuditableChatStateMachine.removeIdleChats();
            tabManager.updateTab();
            // Remover a conversa do storage se o estado for idle
        }
    });

    chrome.commands.onCommand.addListener((shortcut) => {
        if (shortcut === "reload") {
            console.log("Reloaded extension!");
            chrome.runtime.reload();
        }
    })
}
