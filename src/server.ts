
// src/server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import dotenv from 'dotenv';
import type { UserSession } from './lib/types';
// Import necessary actions if server needs to call them directly (usually not needed for just broadcasting)
// For example, if you needed to validate a token or fetch user details on connection:
// import { getUserDetailsAction } from './app/actions';

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
  console.log("Socket.IO Server: > HTTP server created.");

  console.log("Socket.IO Server: Attempting to initialize Socket.IO server...");
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io/', // Ensure this path is consistent with the client
    cors: {
      origin: "*", // For development, allow all. For production, restrict this.
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'] // Default transports
  });
  console.log("Socket.IO Server: > Socket.IO server initialized successfully on path: /socket.io/");

  io.on('connection', (socket: Socket) => {
    console.log(`Socket.IO Server: > New client connected, ID: ${socket.id}`);

    socket.on('joinRoom', (conversationId: string) => {
      if (conversationId) {
        socket.join(conversationId);
        console.log(`Socket.IO Server: > Client ${socket.id} joined room ${conversationId}`);
      } else {
        console.warn(`Socket.IO Server: > Client ${socket.id} tried to join a room with an undefined/null conversationId.`);
      }
    });

    socket.on('leaveRoom', (conversationId: string) => {
      if (conversationId) {
        socket.leave(conversationId);
        console.log(`Socket.IO Server: > Client ${socket.id} left room ${conversationId}`);
      }
    });

    socket.on('sendMessage', ({ message, conversationId }) => {
      if (conversationId && message) {
        // Broadcast to all other clients in the room
        socket.to(conversationId).emit('newMessage', message);
        console.log(`Socket.IO Server: > Message sent in room ${conversationId} by ${socket.id}: ${message?.content?.substring(0, 30)}...`);
      }
    });
    
    socket.on('typing', ({ conversationId, userName }) => {
      if (conversationId) {
        socket.to(conversationId).emit('userTyping', { userId: socket.id, userName, conversationId });
      }
    });

    socket.on('stopTyping', ({ conversationId }) => { // userId is implicit from socket.id on server
      if (conversationId) {
        socket.to(conversationId).emit('userStopTyping', { userId: socket.id, conversationId });
      }
    });
    
    socket.on('pinMessageRequested', async ({ conversationId, messageId, staffSessionJsonString }) => {
      // Placeholder for action call - ensure your actions are callable from here if needed
      // Or, this logic could be handled entirely client-side if preferred for pin/unpin
      // For server-authoritative pinning, you'd call an action here.
      // For this example, we assume the action is called client-side and server just broadcasts update.
      // If pinMessageToConversation and unpinMessageFromConversation were here:
      // try {
      //   const staffSession: UserSession = JSON.parse(staffSessionJsonString);
      //   const updatedConversation = await pinMessageToConversation(conversationId, messageId, staffSession);
      //   if (updatedConversation) {
      //     io.to(conversationId).emit('pinnedMessagesUpdated', { 
      //       conversationId, 
      //       pinnedMessageIds: updatedConversation.pinnedMessageIds || [] 
      //     });
      //   }
      // } catch (error) { /* handle error */ }
      console.log(`Socket.IO Server: Pin request for message ${messageId} in room ${conversationId} (server-side action placeholder)`);
       // This event should ideally be emitted AFTER the DB update is confirmed
      // For now, if actions.ts emits it, this server-side part might not be strictly needed for broadcasting 'pinnedMessagesUpdated'
      // But if actions.ts *doesn't* emit, then the server *must* after calling the action.
    });

    socket.on('unpinMessageRequested', async ({ conversationId, messageId, staffSessionJsonString }) => {
      console.log(`Socket.IO Server: Unpin request for message ${messageId} in room ${conversationId} (server-side action placeholder)`);
      // Similar to pinMessageRequested, action call would be here for server-authoritative.
    });
    
    socket.on('editMessage', ({ message, conversationId }) => {
      if (conversationId && message) {
        socket.to(conversationId).emit('messageEdited', { message });
        console.log(`Socket.IO Server: > Message ${message.id} edit broadcast in room ${conversationId}`);
      }
    });

    socket.on('deleteMessage', ({ messageId, conversationId }) => {
      if (conversationId && messageId) {
        socket.to(conversationId).emit('messageDeleted', { messageId });
        console.log(`Socket.IO Server: > Message ${messageId} deletion broadcast in room ${conversationId}`);
      }
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`Socket.IO Server: > Client ${socket.id} disconnected. Reason: ${reason}`);
    });

    socket.on('error', (err: Error) => {
      console.error(`Socket.IO Server: > Socket error for ${socket.id}:`, err);
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
