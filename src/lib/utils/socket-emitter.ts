import type { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setSocketInstance(io: SocketIOServer) {
  ioInstance = io;
}

export function getSocketInstance(): SocketIOServer | null {
  return ioInstance;
}

export function emitNewCustomerNotification(data: {
  customerId: string;
  customerName?: string;
  customerPhone: string;
}) {
  console.log(`[Socket Emitter] Emitting newCustomerNotification:`, data);
  if (ioInstance) {
    ioInstance.emit('newCustomerNotification', data);
    console.log(`[Socket Emitter] New customer notification emitted successfully`);
  } else {
    console.error(`[Socket Emitter] No socket instance available for newCustomerNotification`);
  }
}

export function emitNewMessageNotification(data: {
  customerId: string;
  customerName?: string;
  messageContent: string;
  conversationId: string;
  sender: string;
}) {
  console.log(`[Socket Emitter] Emitting newMessageNotification:`, data);
  if (ioInstance && data.sender === 'user') {
    ioInstance.emit('newMessageNotification', data);
    console.log(`[Socket Emitter] New message notification emitted successfully`);
  } else {
    console.log(`[Socket Emitter] Skipping newMessageNotification:`, { hasInstance: !!ioInstance, sender: data.sender });
  }
}

export function emitChatReplyNotification(data: {
  customerId: string;
  customerName?: string;
  replyContent: string;
  conversationId: string;
  staffName?: string;
  sender: string;
}) {
  console.log(`[Socket Emitter] Emitting chatReplyNotification:`, data);
  if (ioInstance && (data.sender === 'staff' || data.sender === 'system')) {
    ioInstance.emit('chatReplyNotification', data);
    console.log(`[Socket Emitter] Chat reply notification emitted successfully`);
  } else {
    console.log(`[Socket Emitter] Skipping chatReplyNotification:`, { hasInstance: !!ioInstance, sender: data.sender });
  }
} 