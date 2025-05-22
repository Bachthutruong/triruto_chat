
// src/server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import dotenv from 'dotenv';
import { pinMessageToConversation, unpinMessageFromConversation } from './app/actions'; // Assuming UserSession might be needed
import type { UserSession } from './lib/types'; // Import UserSession

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '9002', 10);

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

  console.log("Socket.IO Server: Attempting to initialize Socket.IO server...");
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
    console.log('Socket.IO Server: > New client connected, ID:', socket.id);

    socket.on('joinRoom', (conversationId: string) => {
      socket.join(conversationId);
      console.log(`Socket.IO Server: > Client ${socket.id} joined room ${conversationId}`);
    });

    socket.on('leaveRoom', (conversationId: string) => {
      socket.leave(conversationId);
      console.log(`Socket.IO Server: > Client ${socket.id} left room ${conversationId}`);
    });

    socket.on('sendMessage', ({ message, conversationId }) => {
      socket.to(conversationId).emit('newMessage', message);
      console.log(`Socket.IO Server: > Message sent in room ${conversationId} by ${socket.id}:`, message.content?.substring(0, 50) + "...");
    });
    
    socket.on('typing', ({ conversationId, userName }) => {
      socket.to(conversationId).emit('userTyping', { userId: socket.id, userName, conversationId });
    });

    socket.on('stopTyping', ({ conversationId, userId }) => { // userId here is of the client who stopped typing
      socket.to(conversationId).emit('userStopTyping', { userId, conversationId });
    });
    
    socket.on('pinMessageRequested', async ({ conversationId, messageId, staffSessionJsonString }) => {
      try {
        const staffSession: UserSession = JSON.parse(staffSessionJsonString);
        if (!staffSession || (staffSession.role !== 'admin' && staffSession.role !== 'staff')) {
          console.warn(`Socket.IO Server: Unauthorized pin attempt by socket ${socket.id} for message ${messageId}`);
          return; // Or emit an error back to the client
        }
        const updatedConversation = await pinMessageToConversation(conversationId, messageId, staffSession);
        if (updatedConversation) {
          io.to(conversationId).emit('pinnedMessagesUpdated', { 
            conversationId, 
            pinnedMessageIds: updatedConversation.pinnedMessageIds || [] 
          });
          console.log(`Socket.IO Server: > Message ${messageId} pinned in room ${conversationId} by ${staffSession.name}`);
        }
      } catch (error) {
        console.error(`Socket.IO Server: Error pinning message ${messageId} in room ${conversationId}:`, error);
        // Optionally emit an error back to the requesting client
        socket.emit('pinMessageError', { messageId, error: (error as Error).message });
      }
    });

    socket.on('unpinMessageRequested', async ({ conversationId, messageId, staffSessionJsonString }) => {
      try {
        const staffSession: UserSession = JSON.parse(staffSessionJsonString);
         if (!staffSession || (staffSession.role !== 'admin' && staffSession.role !== 'staff')) {
          console.warn(`Socket.IO Server: Unauthorized unpin attempt by socket ${socket.id} for message ${messageId}`);
          return; 
        }
        const updatedConversation = await unpinMessageFromConversation(conversationId, messageId, staffSession);
        if (updatedConversation) {
          io.to(conversationId).emit('pinnedMessagesUpdated', { 
            conversationId, 
            pinnedMessageIds: updatedConversation.pinnedMessageIds || []
          });
          console.log(`Socket.IO Server: > Message ${messageId} unpinned in room ${conversationId} by ${staffSession.name}`);
        }
      } catch (error) {
        console.error(`Socket.IO Server: Error unpinning message ${messageId} in room ${conversationId}:`, error);
        socket.emit('unpinMessageError', { messageId, error: (error as Error).message });
      }
    });
    
    socket.on('deleteMessage', ({ messageId, conversationId }) => { // Assuming client sends this
        socket.to(conversationId).emit('messageDeleted', { messageId });
        console.log(`Socket.IO Server: > Message ${messageId} deletion broadcast in room ${conversationId}`);
    });

    socket.on('editMessage', ({ message, conversationId }) => { // Assuming client sends updated message
        socket.to(conversationId).emit('messageEdited', { message });
        console.log(`Socket.IO Server: > Message ${message.id} edit broadcast in room ${conversationId}`);
    });


    socket.on('disconnect', (reason) => {
      console.log(`Socket.IO Server: > Client ${socket.id} disconnected. Reason: ${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`Socket.IO Server: > Error for socket ${socket.id}:`, err);
    });
  });

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
    console.error("Socket.IO Server: Error during Next.js app preparation:", err);
    process.exit(1);
});
