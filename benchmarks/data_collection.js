import WPP from "@wppconnect/wa-js";

// ==UserScript==
// @name         WhatsApp Web - EriChain data collector
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Measure data from WhatsappWeb messages regarding time and memory use
// @match        https://web.whatsapp.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

/**
     * @typedef {Object} MessageMetadata
     * @property {string} id - Id of the message
     * @property {string} [content] - Text content of the message
     * @property {number} [ack0] - Time in which the message was sent in Unix Timestamp for status 0
     * @property {number} [ack1] - Time in which the message was sent in Unix Timestamp for status 1
     * @property {number} [ack2] - Time in which the message was sent in Unix Timestamp for status 2
     * @property {number} [ack3] - Time in which the message was sent in Unix Timestamp for status 3
     * @property {number} [memory] - Memory in bytes read from Whatsapp Web WebSocket
*/

/**
     * @typedef {Object} SocketData
     * @property {number} time - Time when the data was sampled
     * @property {number} memory - Memory in bytes read from Whatsapp Web WebSocket
*/

/**
 * @param {Element} chatBox 
 * @param {string} message 
**/
function sendWhatsappMessage(chatBox, message) {
    chatBox.focus();
    chatBox.textContent = message;

    // Dispatch input event so the app knows content changed
    chatBox.dispatchEvent(new InputEvent('input', { bubbles: true }));

    // Dispatch Enter keydown
    chatBox.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
    }));

    // Also dispatch keyup for completeness
    chatBox.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
    }));
}

function generateRandomMessage() {
    // Generate random length between 1 and 100
    const length = Math.floor(Math.random() * 100) + 1;

    // Alphanumeric characters and space
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
    const charsWithoutSpace = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    if (length === 1) {
        // Single character cannot be a space
        return charsWithoutSpace[Math.floor(Math.random() * charsWithoutSpace.length)];
    }

    let message = '';

    // First character (cannot be space)
    message += charsWithoutSpace[Math.floor(Math.random() * charsWithoutSpace.length)];

    // Middle characters (can be anything)
    for (let i = 1; i < length - 1; i++) {
        message += chars[Math.floor(Math.random() * chars.length)];
    }

    // Last character (cannot be space)
    message += charsWithoutSpace[Math.floor(Math.random() * charsWithoutSpace.length)];

    return message;
}

/** @param {number} quantity  **/
function sendMessages(quantity) {
    const TIME_BETWEEN_MESSAGES_MILISECONDS = 5000;

    const textBox = window.document.querySelectorAll(".selectable-text.copyable-text.x15bjb6t.x1n2onr6")[1];
    if (textBox) console.log("Chat box found.");

    for (let i = 0; i < quantity; i++) {
        setTimeout(() => {
            // Sending message
            const message = generateRandomMessage();
            sendWhatsappMessage(textBox, message);
        }, i * TIME_BETWEEN_MESSAGES_MILISECONDS);
    }

    console.log("Done sending messages.");
}

/** @param {number} quantity  **/
window.init_collection = async function(quantity) {
    'use strict';

    /** @type {IDBDatabase} **/
    let db;
    /** @type {boolean[]} **/
    let dbReadyReference = [false];

    // Initialize IndexedDB
    const dbRequest = indexedDB.open('WhatsAppDataCollector', 1);

    dbRequest.onerror = function(e) {
        console.error('[DB] Error opening database:', e);
    };

    dbRequest.onupgradeneeded = function() {
        db = dbRequest.result;
        const store = db.createObjectStore('messages', { keyPath: 'id' });
        console.log('[DB] Database created/upgraded');
    };

    dbRequest.onsuccess = function() {
        db = dbRequest.result;
        dbReadyReference[0] = true;
        console.log('[DB] Database ready');
        console.log("Trying to inject dummy data 1");
    };
    await waitForDB(dbReadyReference);

    console.log("Setting up listeners.");
    // Primeiro ouvir os sockets e armazenar 2 arrays de objetos que contem o tempo e a memoria
    /** @type {SocketData[]} **/
    const receivedSocketData = [];
    /** @type {SocketData[]} **/
    const sentSocketData = [];
    console.log('[Monitor] Starting WebSocket monitor...');

    // Hook send on prototype
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(socketData) {
        const size = socketData?.byteLength || socketData?.size || socketData?.length || 0;
        /** @type SocketData **/
        const newSocketData = {
            memory: size,
            time: Date.now()
        }
        sentSocketData.push(newSocketData);
        console.log('[SENT]: ', sentSocketData);
        return originalSend.apply(this, arguments);
    };

    // Hook addEventListener on prototype
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, handler, ...args) {
        if (this instanceof WebSocket && type === 'message') {
            const wrappedHandler = function(event) {
                const size = event.data?.byteLength || event.data?.size || event.data?.length || 0;
                /** @type SocketData **/
                const newSocketData = {
                    memory: size,
                    time: Date.now()
                }
                receivedSocketData.push(newSocketData);
                console.log('[RECEIVED1]: ', receivedSocketData);
                return handler.apply(this, arguments);
            };
            return originalAddEventListener.call(this, type, wrappedHandler, ...args);
        }
        return originalAddEventListener.apply(this, arguments);
    };

    // Hook onmessage property descriptor
    const originalDescriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');

    Object.defineProperty(WebSocket.prototype, 'onmessage', {
        set: function(handler) {
            console.log('[Monitor] onmessage setter called');

            if (!handler) {
                return originalDescriptor.set.call(this, handler);
            }

            const wrappedHandler = function(event) {
                const size = event.data?.byteLength || event.data?.size || event.data?.length || 0;
                /** @type SocketData **/
                const newSocketData = {
                    memory: size,
                    time: Date.now()
                }
                receivedSocketData.push(newSocketData);
                console.log('[RECEIVED2]: ', receivedSocketData);
                return handler.apply(this, arguments);
            };

            return originalDescriptor.set.call(this, wrappedHandler);
        },
        get: function() {
            return originalDescriptor.get.call(this);
        }
    });

    console.log('[Monitor] All hooks installed');

    console.log('Collection initialized!');

    sendMessages(quantity);

    /** @type {WPP} **/
    const WhatsappLayer = window.WPP;

    /** @type {MessageMetadata} **/
    const dummyData = {
        id: "djwaoidjow",
        content: "oi galera!!"
    };
    console.log("Trying to inject dummy data 2");
    create(db, dummyData).catch((e) => console.log("Error: ", e));

    await exportToCSV(db);
};

/**
    * Wait for database to be ready
    * @param {boolean[]} dbReadyReference
    * @returns {Promise<void>}
*/
function waitForDB(dbReadyReference) {
    return new Promise((resolve, reject) => {
        if (dbReadyReference[0]) {
            resolve();
            return;
        }

        const checkInterval = setInterval(() => {
            if (dbReadyReference[0]) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error('Database initialization timeout'));
        }, 5000);
    });
}

/**
    * Reads a message entry from the database
    * @param {IDBDatabase} db 
    * @param {string} id - The id of the message to read
    * @returns {Promise<MessageMetadata|null>} The message metadata or null if not found
*/
function read(db, id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not ready'));
            return;
        }
        if (!id) {
            reject(new Error('Message id is required'));
            return;
        }

        const transaction = db.transaction(['messages'], 'readonly');
        const store = transaction.objectStore('messages');
        const request = store.get(id);

        request.onsuccess = function() {
            resolve(request.result || null);
        };

        request.onerror = function(e) {
            reject(e);
        };
    });
}

/**
    * Creates a new message entry in the database
    * @param {IDBDatabase} db 
    * @param {MessageMetadata} data - The message metadata to store
    * @returns {Promise<string>} The id of the created message
*/
function create(db, data) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not ready'));
            return;
        }
        if (!data.id) {
            reject(new Error('Message id is required'));
            return;
        }

        const transaction = db.transaction(['messages'], 'readwrite');
        const store = transaction.objectStore('messages');
        const request = store.add(data);

        request.onsuccess = function() {
            resolve(data.id);
        };

        request.onerror = function(e) {
            reject(e);
        };
    });
}

/**
    * Updates an existing message entry in the database (merges with existing data)
    * @param {IDBDatabase} db 
    * @param {MessageMetadata} data - The message metadata to update (must include id)
    * @returns {Promise<string>} The id of the updated message
*/
function update(db, data) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not ready'));
            return;
        }
        if (!data.id) {
            reject(new Error('Message id is required'));
            return;
        }

        const transaction = db.transaction(['messages'], 'readwrite');
        const store = transaction.objectStore('messages');

        // First get existing data
        const getRequest = store.get(data.id);

        getRequest.onsuccess = function() {
            const existing = getRequest.result;
            if (!existing) {
                reject(new Error(`Message with id ${data.id} not found`));
                return;
            }

            // Merge new data with existing
            const updated = { ...existing, ...data };
            const putRequest = store.put(updated);

            putRequest.onsuccess = function() {
                resolve(data.id);
            };

            putRequest.onerror = function(e) {
                reject(e);
            };
        };

        getRequest.onerror = function(e) {
            reject(e);
        };
    });
}

/**
    * Deletes a message entry from the database
    * @param {IDBDatabase} db 
    * @param {string} id - The id of the message to delete
    * @returns {Promise<void>}
*/
function deleteMessage(db, id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not ready'));
            return;
        }
        if (!id) {
            reject(new Error('Message id is required'));
            return;
        }

        const transaction = db.transaction(['messages'], 'readwrite');
        const store = transaction.objectStore('messages');
        const request = store.delete(id);

        request.onsuccess = function() {
            resolve();
        };

        request.onerror = function(e) {
            reject(e);
        };
    });
}

/**
    * Exports all messages to CSV
    * @param {IDBDatabase} db
    * @returns {Promise<void>}
*/
function exportToCSV(db) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not ready'));
            return;
        }

        const transaction = db.transaction(['messages'], 'readonly');
        const store = transaction.objectStore('messages');
        const request = store.getAll();

        request.onsuccess = function() {
            const data = request.result;

            if (data.length === 0) {
                console.log('[DB] No data to export');
                resolve();
                return;
            }

            // Define column order
            const headers = ['id', 'content', 'ack0', 'ack1', 'ack2', 'ack3', 'memory'];

            // Build CSV
            const csvRows = [];
            csvRows.push(headers.join(','));

            data.forEach(row => {
                const values = headers.map(header => {
                    const value = row[header];
                    if (value === null || value === undefined) return '';
                    const str = String(value);
                    // Escape commas and quotes
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                });
                csvRows.push(values.join(','));
            });

            // Download
            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `whatsapp-data-${Date.now()}.csv`;
            link.click();
            URL.revokeObjectURL(url);

            console.log(`[DB] Exported ${data.length} rows to CSV`);
            resolve();
        };

        request.onerror = function(e) {
            console.error('[DB] Error exporting data:', e);
            reject(e);
        };
    });
};

// WhatsappLayer.on("chat.msg_ack_change", (obj) => console.log("Receiving changes: ", obj));
// WhatsappLayer.on("chat.new_message", (obj) => console.log("New message: ", obj));
//
// WhatsappLayer.on("chat.msg_ack_change", (obj) => {
//     console.log("Message update.");
//     console.log("Message id: ", obj.ids.map((id) => id.id));
//     console.log("Ack of the change: ", obj.ack);
//     console.log("Time of the change: ", new Date().toISOString());
// });
// WhatsappLayer.on("chat.new_message", (obj) => {
//     console.log("Message received.");
//     console.log("Message id: ", obj.id.id);
//     console.log("Ack of the message: ", obj.ack);
//     console.log("Time of the message: ", new Date().toISOString());
// });
