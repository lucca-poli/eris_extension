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

/** @type {WPP} **/
const WhatsappLayer = window.WPP;

WhatsappLayer.on("chat.msg_ack_change", (obj) => console.log("Receiving changes: ", obj));
WhatsappLayer.on("chat.new_message", (obj) => console.log("New message: ", obj));

WhatsappLayer.on("chat.msg_ack_change", (obj) => {
    console.log("Message update.");
    console.log("Message id: ", obj.ids.map((id) => id.id));
    console.log("Ack of the change: ", obj.ack);
    console.log("Time of the change: ", new Date().toISOString());
});
WhatsappLayer.on("chat.new_message", (obj) => {
    console.log("Message received.");
    console.log("Message id: ", obj.id.id);
    console.log("Ack of the message: ", obj.ack);
    console.log("Time of the message: ", new Date().toISOString());
});

// (function() {
//     'use strict';
//
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
// })();
