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
window.init_collection = function(quantity) {
    'use strict';

    console.log('Collection initialized!');

    sendMessages(quantity);

    /** @type {WPP} **/
    const WhatsappLayer = window.WPP;

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

//     console.log('[Monitor] Starting WebSocket monitor...');
//
//     // Hook send on prototype
//     const originalSend = WebSocket.prototype.send;
//     WebSocket.prototype.send = function(data) {
//         const size = data?.byteLength || data?.size || data?.length || 0;
//         console.log('[SENT]', size, 'bytes at', Date.now());
//         return originalSend.apply(this, arguments);
//     };
//
//     // Hook addEventListener on prototype
//     const originalAddEventListener = EventTarget.prototype.addEventListener;
//     EventTarget.prototype.addEventListener = function(type, handler, ...args) {
//         if (this instanceof WebSocket && type === 'message') {
//             const wrappedHandler = function(event) {
//                 const size = event.data?.byteLength || event.data?.size || event.data?.length || 0;
//                 console.log('[RECEIVED via addEventListener]', size, 'bytes at', Date.now());
//                 return handler.apply(this, arguments);
//             };
//             return originalAddEventListener.call(this, type, wrappedHandler, ...args);
//         }
//         return originalAddEventListener.apply(this, arguments);
//     };
//
//     // Hook onmessage property descriptor
//     const originalDescriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
//
//     Object.defineProperty(WebSocket.prototype, 'onmessage', {
//         set: function(handler) {
//             console.log('[Monitor] onmessage setter called');
//
//             if (!handler) {
//                 return originalDescriptor.set.call(this, handler);
//             }
//
//             const wrappedHandler = function(event) {
//                 const size = event.data?.byteLength || event.data?.size || event.data?.length || 0;
//                 console.log('[RECEIVED via onmessage]', size, 'bytes at', Date.now());
//                 console.log("is ready: ", window.WPP.isFullReady);
//                 return handler.apply(this, arguments);
//             };
//
//             return originalDescriptor.set.call(this, wrappedHandler);
//         },
//         get: function() {
//             return originalDescriptor.get.call(this);
//         }
//     });
//
//     console.log('[Monitor] All hooks installed');
