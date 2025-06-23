"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSocketInstance = setSocketInstance;
exports.getSocketInstance = getSocketInstance;
exports.emitNewCustomerNotification = emitNewCustomerNotification;
exports.emitNewMessageNotification = emitNewMessageNotification;
exports.emitChatReplyNotification = emitChatReplyNotification;
let ioInstance = null;
function setSocketInstance(io) {
    ioInstance = io;
}
function getSocketInstance() {
    return ioInstance;
}
function emitNewCustomerNotification(data) {
    console.log(`[Socket Emitter] Emitting newCustomerNotification:`, data);
    if (ioInstance) {
        ioInstance.emit('newCustomerNotification', data);
        console.log(`[Socket Emitter] New customer notification emitted successfully`);
    }
    else {
        console.error(`[Socket Emitter] No socket instance available for newCustomerNotification`);
    }
}
function emitNewMessageNotification(data) {
    console.log(`[Socket Emitter] Emitting newMessageNotification:`, data);
    if (ioInstance && data.sender === 'user') {
        ioInstance.emit('newMessageNotification', data);
        console.log(`[Socket Emitter] New message notification emitted successfully`);
    }
    else {
        console.log(`[Socket Emitter] Skipping newMessageNotification:`, { hasInstance: !!ioInstance, sender: data.sender });
    }
}
function emitChatReplyNotification(data) {
    console.log(`[Socket Emitter] Emitting chatReplyNotification:`, data);
    if (ioInstance && (data.sender === 'staff' || data.sender === 'system')) {
        ioInstance.emit('chatReplyNotification', data);
        console.log(`[Socket Emitter] Chat reply notification emitted successfully`);
    }
    else {
        console.log(`[Socket Emitter] Skipping chatReplyNotification:`, { hasInstance: !!ioInstance, sender: data.sender });
    }
}
