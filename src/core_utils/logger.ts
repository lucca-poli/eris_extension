import { ActionOptions, InternalMessage, LogEntry, LogLevel, LogWeight } from "../utils/types";

class PersistentLogger {
    private db: IDBDatabase | null = null;
    private readonly maxLogs = 3000;
    private readonly threshold: LogWeight;

    constructor() {
        // process.env.LOG_LEVEL is injected by Webpack DefinePlugin
        const envLevel = (process.env.LOG_LEVEL as LogLevel) || 'INFO';
        this.threshold = LogWeight[envLevel];
    }

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("ExtensionLogs", 1);

            request.onupgradeneeded = (e: any) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("logs")) {
                    db.createObjectStore("logs", { keyPath: "id" });
                }
            };

            request.onsuccess = (e: any) => {
                this.db = e.target.result;
                resolve();
            };

            request.onerror = () => reject("Failed to connect to IndexedDB");
        });
    }

    private async prune(): Promise<void> {
        if (!this.db) return;
        const tx = this.db.transaction("logs", "readwrite");
        const store = tx.objectStore("logs");

        const countRequest = store.count();
        countRequest.onsuccess = () => {
            if (countRequest.result > this.maxLogs) {
                // Open cursor to find the oldest item (FIFO)
                store.openCursor().onsuccess = (e: any) => {
                    const cursor = e.target.result;
                    if (cursor) store.delete(cursor.primaryKey);
                };
            }
        };
    }

    private write(level: LogLevel, content: string | Object) {
        if (LogWeight[level] < this.threshold) return;

        const entry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            level,
            content: typeof content === 'object' ? JSON.stringify(content) : content
        };

        // Standard Console Output (for DevTools)
        const color = { DEBUG: '#7f8c8d', INFO: '#2ecc71', WARN: '#f1c40f', ERROR: '#e74c3c' }[level];
        console.log(`%c[${entry.timestamp}] [${level}]`, `color: ${color}; font-weight: bold;`, content);

        // Check environment to only store in the background
        const isContentScript =
            typeof window !== "undefined" &&
            typeof document !== "undefined" &&
            !!document.documentElement;

        const isServiceWorker =
            typeof self !== "undefined" &&
            // @ts-ignore
            typeof self.registration !== "undefined";

        if (isContentScript && !this.db) {
            chrome.runtime.sendMessage({
                action: ActionOptions.PROPAGATE_LOGS,
                payload: entry
            } as InternalMessage).catch(() => { });
        } else if (isServiceWorker && this.db) {
            this.saveToDB(entry);
        } else {
            throw new Error("Or DB is not made or there's no content script nor service worker.");
        }
    }

    debug(msg: string | Object) { this.write('DEBUG', msg); }
    info(msg: string | Object) { this.write('INFO', msg); }
    warn(msg: string | Object) { this.write('WARN', msg); }
    error(msg: string | Object) { this.write('ERROR', msg); }

    saveToDB(entry: LogEntry) {
        const tx = this.db!.transaction("logs", "readwrite");
        tx.objectStore("logs").add(entry);
        this.prune();
    }

    async exportLogs(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['logs'], 'readonly');
            const objectStore = transaction.objectStore('logs');
            const request = objectStore.getAll();

            request.onsuccess = () => {
                const logs: LogEntry[] = request.result;

                if (logs.length === 0) {
                    console.warn('No logs to export');
                    resolve();
                    return;
                }

                // Sort logs by timestamp
                logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                // Create CSV content
                const headers = ['id', 'timestamp', 'level', 'content'];
                const csvRows = [headers.join(',')];

                for (const log of logs) {
                    const row = [
                        log.id,
                        log.timestamp,
                        log.level,
                        `"${String(log.content).replace(/"/g, '""')}"` // Escape quotes in content
                    ];
                    csvRows.push(row.join(','));
                }

                const csvContent = csvRows.join('\n');

                // Create data URL and download
                const filename = `logs_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
                const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);

                // Use chrome.downloads API if available (background script/service worker)
                if (typeof chrome !== 'undefined' && chrome.downloads) {
                    chrome.downloads.download({
                        url: dataUrl,
                        filename: filename,
                        saveAs: true
                    });
                } else {
                    // Fallback for content scripts or web pages
                    const link = document.createElement('a');
                    link.setAttribute('href', dataUrl);
                    link.setAttribute('download', filename);
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }

                console.info(`Exported ${logs.length} logs to ${filename}`);
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to retrieve logs from database'));
            };
        });
    }
}

export const logger = new PersistentLogger();
