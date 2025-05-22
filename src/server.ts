
// src/server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import dotenv from 'dotenv';
import { pinMessageToConversation, unpinMessageFromConversation } from './app/actions'; 
import type { UserSession } from './lib/types';

dotenv.config();
console.log("Socket.IO Server: dotenv configured.");

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '9002', 10);

console.log(`Socket.IO Server: Starting in ${dev ? 'development' : 'production'} mode on ${hostname}:${port}.`);

console.log("Socket.IO Server: Initializing Next.js app...");
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log("Socket.IO Server: Attempting to prepare Next.js app...");
app.prepare().then(() => {
  console.log("Socket.IO Server: > Next.js app prepared successfully.");

  const httpServer = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Socket.IO Server: Error handling HTTP request:', err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });
  console.log("Socket.IO Server: > HTTP server created.");

  console.log("Socket.IO Server: Attempting to initialize Socket.IO server with explicit path '/socket.io/'...");
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io/', 
    cors: {
      origin: "*", 
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });
  console.log("Socket.IO Server: > Socket.IO server initialized successfully on path: /socket.io/");

  io.on('connection', (socket: Socket) => {
    console.log(`Socket.IO Server: > Client connected: ${socket.id}. Total clients: ${io.engine.clientsCount}`);

    socket.on('joinRoom', (conversationId: string) => {
      if (conversationId) {
        socket.join(conversationId);
        console.log(`Socket.IO Server: > Client ${socket.id} joined room '${conversationId}'`);
      } else {
        console.warn(`Socket.IO Server: > Client ${socket.id} tried to join a room with an undefined/null conversationId.`);
      }
    });

    socket.on('leaveRoom', (conversationId: string) => {
      if (conversationId) {
        socket.leave(conversationId);
        console.log(`Socket.IO Server: > Client ${socket.id} left room '${conversationId}'`);
      }
    });

    socket.on('sendMessage', ({ message, conversationId }) => {
      if (conversationId && message) {
        socket.to(conversationId).emit('newMessage', message); 
        console.log(`Socket.IO Server: > Message from ${socket.id} in room '${conversationId}' broadcasted: ${message?.content?.substring(0, 30)}...`);
      }
    });
    
    socket.on('typing', ({ conversationId, userName }) => {
      if (conversationId) {
        socket.to(conversationId).emit('userTyping', { userId: socket.id, userName, conversationId });
      }
    });

    socket.on('stopTyping', ({ conversationId, userId }) => { // Added userId to be more specific
      if (conversationId) {
        socket.to(conversationId).emit('userStopTyping', { userId: socket.id, conversationId });
      }
    });
    
    socket.on('pinMessageRequested', async ({ conversationId, messageId, staffSessionJsonString }) => {
      console.log(`Socket.IO Server: Received pinMessageRequested for convId: ${conversationId}, msgId: ${messageId}`);
      try {
        const staffSession: UserSession = JSON.parse(staffSessionJsonString);
        if (!staffSession || (staffSession.role !== 'admin' && staffSession.role !== 'staff')) {
            console.warn(`Socket.IO Server: Unauthorized pin request from ${socket.id}`);
            socket.emit('pinActionError', { messageId, error: 'Unauthorized' });
            return;
        }
        const updatedConversation = await pinMessageToConversation(conversationId, messageId, staffSession);
        if (updatedConversation) {
          io.to(conversationId).emit('pinnedMessagesUpdated', { 
            conversationId, 
            pinnedMessageIds: updatedConversation.pinnedMessageIds || [] 
          });
          console.log(`Socket.IO Server: Emitted pinnedMessagesUpdated for convId: ${conversationId}`);
        } else {
          console.warn(`Socket.IO Server: pinMessageToConversation returned null or undefined for convId: ${conversationId}`);
        }
      } catch (error: any) {
        console.error(`Socket.IO Server: Error processing pinMessageRequested for convId ${conversationId}:`, error.message, error.stack);
        socket.emit('pinActionError', { messageId, error: error.message || 'Failed to pin message' });
      }
    });

    socket.on('unpinMessageRequested', async ({ conversationId, messageId, staffSessionJsonString }) => {
      console.log(`Socket.IO Server: Received unpinMessageRequested for convId: ${conversationId}, msgId: ${messageId}`);
      try {
        const staffSession: UserSession = JSON.parse(staffSessionJsonString);
         if (!staffSession || (staffSession.role !== 'admin' && staffSession.role !== 'staff')) {
            console.warn(`Socket.IO Server: Unauthorized unpin request from ${socket.id}`);
            socket.emit('unpinActionError', { messageId, error: 'Unauthorized' });
            return;
        }
        const updatedConversation = await unpinMessageFromConversation(conversationId, messageId, staffSession);
        if (updatedConversation) {
          io.to(conversationId).emit('pinnedMessagesUpdated', { 
            conversationId, 
            pinnedMessageIds: updatedConversation.pinnedMessageIds || [] 
          });
           console.log(`Socket.IO Server: Emitted pinnedMessagesUpdated for convId: ${conversationId} after unpin`);
        } else {
          console.warn(`Socket.IO Server: unpinMessageFromConversation returned null or undefined for convId: ${conversationId}`);
        }
      } catch (error: any) {
        console.error(`Socket.IO Server: Error processing unpinMessageRequested for convId ${conversationId}:`, error.message, error.stack);
        socket.emit('unpinActionError', { messageId, error: error.message || 'Failed to unpin message' });
      }
    });
    
    socket.on('editMessage', ({ message, conversationId }) => {
      if (conversationId && message) {
        socket.to(conversationId).emit('messageEdited', { message });
        console.log(`Socket.IO Server: > Message ${message.id} edit broadcast in room '${conversationId}'`);
      }
    });

    socket.on('deleteMessage', ({ messageId, conversationId }) => {
      if (conversationId && messageId) {
        socket.to(conversationId).emit('messageDeleted', { messageId });
        console.log(`Socket.IO Server: > Message ${messageId} deletion broadcast in room '${conversationId}'`);
      }
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`Socket.IO Server: > Client ${socket.id} disconnected. Reason: ${reason}. Total clients: ${io.engine.clientsCount}`);
    });

    socket.on('error', (err: Error) => {
      console.error(`Socket.IO Server: > Socket error for ${socket.id}:`, err);
    });

    // This event is for the server-side socket itself, less common to hit.
    io.engine.on("connection_error", (err) => {
      console.error("Socket.IO Server: Engine connection error:", err.code, err.message, err.context);
    });
  });

  console.log(`Socket.IO Server: Attempting to start HTTP server on http://${hostname}:${port}...`);
  httpServer
    .once('error', (err) => {
      console.error('Socket.IO Server: > HTTP Server Error:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`Socket.IO Server: > HTTP Server ready on http://${hostname}:${port}`);
      console.log(`Socket.IO Server: > Socket.IO listening on port ${port} at path /socket.io/`);
    });
}).catch(err => {
    console.error("Socket.IO Server: CRITICAL Error during Next.js app preparation:", err);
    process.exit(1);
});
