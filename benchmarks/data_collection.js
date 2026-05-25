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
     * @property {string} [content] - Text content of the message
     * @property {string} [id] - Id of the message
     * @property {string} [hash] - Hash of the corresponding block
     * @property {number} [ack0] - Time when the extension start to calculate the metadata (hash and signature) in Unix Timestamp
     * @property {number} [ack1] - Time when message is sent WhatsApp Web app in Unix Timestamp
     * @property {number} [ack2] - Time for message to reach WhatsApp Web app in Unix Timestamp for status 0
     * @property {number} [memory] - Memory in bytes read from Whatsapp Web WebSocket
*/

/**
     * @typedef {Object} SocketData
     * @property {number} time - Time when the data was sampled
     * @property {number} memory - Memory in bytes read from Whatsapp Web WebSocket
*/

const TIME_BETWEEN_MESSAGES_MILISECONDS = 10000;
const TIME_DIFFERENCE_FROM_MEASUREMENT = 2000;
const TEST_MESSAGES = ["gmob", "0Axf", "nT6K", "sCtl", "2It4", "wxmh", "b0rX", "N13X", "oWP8", "s6TD", "w0sZ", "769q", "jX6t", "f6TA", "60eL", "terq", "u9wL", "XMmC", "VdFz", "bRWd", "muX3", "eLDr", "IOkH", "Zo1j", "VrML"];

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
};

/** @type {SocketData[]} **/
const receivedSocketData = [];
/** @type {SocketData[]} **/
const sentSocketData = [];
/** @type {boolean} **/
let collectionRunning = false;
// console.log('[Monitor] Starting WebSocket monitor...');

// Hook send on prototype
const originalSend = WebSocket.prototype.send;
WebSocket.prototype.send = function(socketData) {
    const size = socketData?.byteLength || socketData?.size || socketData?.length || 0;
    /** @type SocketData **/
    const newSocketData = {
        memory: size,
        time: Date.now()
    }
    if (collectionRunning) sentSocketData.push(newSocketData);
    // console.log('[SENT]: ', sentSocketData);
    return originalSend.apply(this, arguments);
};

// Hook onmessage property descriptor
const originalDescriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');

Object.defineProperty(WebSocket.prototype, 'onmessage', {
    set: function(handler) {
        // console.log('[Monitor] onmessage setter called');

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
            if (collectionRunning) receivedSocketData.push(newSocketData);
            // console.log('[RECEIVED in queue]: ', receivedSocketData);
            return handler.apply(this, arguments);
        };

        return originalDescriptor.set.call(this, wrappedHandler);
    },
    get: function() {
        return originalDescriptor.get.call(this);
    }
});

/** @type {WPP} **/
const WhatsappLayer = window.WPP;

WhatsappLayer.on("chat.new_message", async (whatsappMessage) => {
    // console.log("Incoming message: ", whatsappMessage);
    const content = whatsappMessage.body;
    const status = whatsappMessage.ack
    const time = new Date().toISOString();
    const chatId = whatsappMessage.id?.remote?._serialized;
    const author = whatsappMessage.from?._serialized;
    if (content === undefined) {
        console.error("No text content present in message.");
        console.log(whatsappMessage);
    }
    if (status === undefined) {
        console.error("No status present in message.");
        console.log(whatsappMessage);
    }
    if (chatId === undefined) {
        console.error("No chatId present in message.");
        console.log(whatsappMessage);
    }
    if (author === undefined) {
        console.error("No author present in message.");
        console.log(whatsappMessage);
    }

    // const metadataString = whatsappMessage.description;
    // const metadata = JSON.parse(metadataString);
    // const hash = metadata.block.hash;
    // if (!hash) throw new Error("Couldnt find block hash.");

    let whatsappData;
    /** @type {MessageMetadata} **/
    if (status === 0) {
        await new Promise(resolve => setTimeout(resolve, TIME_DIFFERENCE_FROM_MEASUREMENT));
        // console.log('[SENT]: ', sentSocketData);
        const memory = findClosestSocketData(time, sentSocketData, TIME_DIFFERENCE_FROM_MEASUREMENT, "sent");

        whatsappData = {
            id: whatsappMessage.id.id,
            content,
            ack2: time,
            memory,
            // hash
        };
    } else if (status === 1) {
        await new Promise(resolve => setTimeout(resolve, TIME_DIFFERENCE_FROM_MEASUREMENT));
        // console.log('[RECEIVED]: ', receivedSocketData);
        const memory = findClosestSocketData(time, receivedSocketData, TIME_DIFFERENCE_FROM_MEASUREMENT, "received");
        const ackControlMessage = "[Control Message]\nConfirmation ACK sent.";
        if (content !== ackControlMessage) throw new Error("Status should be 1 for received messages.");
        whatsappData = {
            id: whatsappMessage.id.id,
            content,
            ack1: time,
            memory,
            // hash
        };
    } else {
        throw new Error("There should only be 0 or 1 for new messages.");
    }
    upsert(db, whatsappData).catch((e) => console.log("Error in new message creation: ", e));
});
// WhatsappLayer.on("chat.msg_ack_change", (statusChange) => {
//     const status = statusChange.ack
//     const time = Date.now();
//     if (status === undefined) {
//         console.error("No status present in message.");
//         console.log(statusChange);
//     }
//     for (const id of statusChange.ids) {
//         /** @type {MessageMetadata} **/
//         let whatsappData;
//         if (status === 1) {
//             whatsappData = {
//                 id: id.id,
//                 ack1: time
//             };
//         } else if (status === 2) {
//             whatsappData = {
//                 id: id.id,
//                 ack2: time
//             };
//         } else if (status === 3) {
//             whatsappData = {
//                 id: id.id,
//                 ack3: time
//             };
//         } else {
//             throw new Error("There should only be 1, 2 or 3 for updated messages.");
//         }
//         update(db, whatsappData).catch((e) => console.log("Error in new message update: ", e, " status is ", status));
//     }
// });

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

/**
 * @param {string} message 
**/
async function sendMessageToWhatsapp(message) {
    /** @type {WPP} **/
    const WhatsappLayer = window.WPP;

    const chatIdMocked = "5513991174080@c.us";
    const microMetadataMocked = "{\n\".\": \".\"\n}";
    /** @type {MessageMetadata} **/
    let whatsappData;

    const level = "INFO";
    const color = { DEBUG: '#7f8c8d', INFO: '#2ecc71', WARN: '#f1c40f', ERROR: '#e74c3c' }[level];
    const sentTime = new Date().toISOString();
    console.log(`%c[${sentTime}] [${level}]`, `color: ${color}; font-weight: bold;`, "Sending new message:");
    console.log(`%c[${sentTime}] [${level}]`, `color: ${color}; font-weight: bold;`, message);

    const messageReturn = await WhatsappLayer.chat.sendTextMessage(chatIdMocked, message, {
        // @ts-ignore: talvez de merda depois ignorar esse erro
        linkPreview: {
            description: microMetadataMocked,
        }
    });

    // const arrivedTime = new Date().toISOString();
    // console.log(`%c[${arrivedTime}] [${level}]`, `color: ${color}; font-weight: bold;`, message);

    const messageId = messageReturn.id.split('_')[2];

    whatsappData = {
        id: messageId,
        ack1: sentTime
    };

    upsert(db, whatsappData).catch((e) => console.log("Error in new message update: ", e));
}

/**
 * @param {number} length 
**/
function generateRandomMessage(length) {
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
/** @param {number} betweenTime  **/
/** @returns {Promise[]} quantity  **/
function sendMessages(quantity, betweenTime) {
    const textBox = window.document.querySelectorAll("p.copyable-text")[1];
    // if (textBox) console.log("Chat box found.");

    const promises = [];

    for (let i = 0; i < quantity; i++) {
        const promise = new Promise((resolve) => {
            setTimeout(() => {
                // Sending message
                // const length = 4 ** 1;
                // const message = generateRandomMessage(length);
                const message = TEST_MESSAGES[i];

                // sendWhatsappMessage(textBox, message);
                sendMessageToWhatsapp(message);

                resolve();
            }, i * betweenTime);
        });
        promises.push(promise);
    }

    return promises;
}

/**
 * @param {number} time 
 * @param {SocketData[]} SocketDataArray 
 * @param {number} TIME_DIFFERENCE_FROM_MEASUREMENT 
 * @param {"sent" | "received"} direction 
 * @returns {number} Returns the memory and also prunes the array from the beggining to the returned time
**/
function findClosestSocketData(time, SocketDataArray, TIME_DIFFERENCE_FROM_MEASUREMENT, direction) {
    const directionOperator = direction === "sent" ? 1 : -1;
    const memoriesWithinRange = SocketDataArray
        .filter((data) => {
            const difference = (data.time - time) * directionOperator;
            return difference < TIME_DIFFERENCE_FROM_MEASUREMENT && difference > 0;
        })
        .map((data) => data.memory);
    // console.log("Memories collected: ", memoriesWithinRange, " at time ", time);
    const maximalEstimate = Math.max(...memoriesWithinRange);

    // Pruning the array - find index to keep from
    const cutoffTime = time;
    const indexToKeep = SocketDataArray.findIndex((data) => data.time >= cutoffTime);

    // Remove everything before that index
    if (indexToKeep > 0) {
        SocketDataArray.splice(0, indexToKeep);
    } else if (indexToKeep === -1) {
        // If no elements match, clear entire array
        SocketDataArray.splice(0, SocketDataArray.length);
    }

    // console.log("New socket array is: ", SocketDataArray);
    return maximalEstimate;
}

/** @param {number} quantity  **/
window.init_collection = async function(quantity) {
    'use strict';
    collectionRunning = true;

    await waitForDB(dbReadyReference);

    // console.log("Setting up listeners.");
    // Primeiro ouvir os sockets e armazenar 2 arrays de objetos que contem o tempo e a memoria

    // console.log('[Monitor] All hooks installed');

    console.log('Collection initialized!');

    const sentResult = sendMessages(quantity, TIME_BETWEEN_MESSAGES_MILISECONDS);


    // Need to wait all sent messages to arrive
    await Promise.all(sentResult);
    console.log("Promises concluded.");
    // Wait a bit more just to capture the final ack
    await new Promise(resolve => setTimeout(resolve, TIME_BETWEEN_MESSAGES_MILISECONDS * 5));
    console.log("Done sending messages.");
    // Forcefully await 5 more seconds
    await exportToCSV(db);
    await deleteAllMessages(db);
    collectionRunning = false;
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
 * Updates an existing message entry or creates it if it doesn't exist.
 * @param {IDBDatabase} db 
 * @param {MessageMetadata} data - The message metadata (must include id)
 * @returns {Promise<string>} The id of the message
 */
function upsert(db, data) {
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

        // Check if the record already exists
        const getRequest = store.get(data.id);

        getRequest.onsuccess = function() {
            const existing = getRequest.result;

            // If exists, merge; otherwise, use the new data as the base
            const finalData = existing ? { ...existing, ...data } : data;

            // put() handles both insertion and updates
            const putRequest = store.put(finalData);

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
                reject(new Error(`Message with id ${data.id} not found. result is ${existing}`));
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
        if (!id) {
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
 * Deletes all messages from the database
 * @param {IDBDatabase} db 
 * @returns {Promise<void>}
 */
function deleteAllMessages(db) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not ready'));
            return;
        }

        const transaction = db.transaction(['messages'], 'readwrite');
        const store = transaction.objectStore('messages');
        const request = store.clear();

        request.onsuccess = function() {
            console.log('[DB] All messages deleted');
            resolve();
        };

        request.onerror = function(e) {
            console.error('[DB] Error deleting all messages:', e);
            reject(e);
        };
    });
}

/**
    * Exports all messages to CSV
    * @param {IDBDatabase} db
    * @returns {Promise<void>}
*/
async function exportToCSV(db) {
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
            const headers = ['id', 'content', 'hash', 'ack0', 'ack1', 'ack2', 'memory'];

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
            link.download = `whatsapp-data-last-${Date.now()}.csv`;
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
