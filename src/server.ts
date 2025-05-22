
// src/server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config(); // Ensure environment variables are loaded

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
    path: '/socket.io/', // Explicit path, must match client
    cors: {
      origin: "*", // Allow all origins for development
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'] // Explicitly allow both, though websocket is preferred
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
      // Broadcast to all clients in the room except the sender
      socket.to(conversationId).emit('newMessage', message);
      console.log(`Socket.IO Server: > Message sent in room ${conversationId} by ${socket.id}:`, message.content.substring(0, 50) + "...");
    });
    
    socket.on('typing', ({ conversationId, userName }) => {
      socket.to(conversationId).emit('userTyping', { userId: socket.id, userName, conversationId });
      // console.log(`Socket.IO Server: > User ${userName} (${socket.id}) is typing in room ${conversationId}`);
    });

    socket.on('stopTyping', ({ conversationId }) => {
      socket.to(conversationId).emit('userStopTyping', { userId: socket.id, conversationId });
      // console.log(`Socket.IO Server: > User ${socket.id} stopped typing in room ${conversationId}`);
    });
    
    socket.on('pinMessage', ({ messageId, conversationId, isPinned }) => {
        socket.to(conversationId).emit('messagePinned', { messageId, isPinned });
        console.log(`Socket.IO Server: > Message ${messageId} pinned status ${isPinned} in room ${conversationId}`);
    });

    socket.on('unpinMessage', ({ messageId, conversationId, isPinned }) => {
        socket.to(conversationId).emit('messageUnpinned', { messageId, isPinned }); // Or use a generic 'messagePinUpdate'
        console.log(`Socket.IO Server: > Message ${messageId} unpinned status ${isPinned} in room ${conversationId}`);
    });
    
    socket.on('deleteMessage', ({ messageId, conversationId }) => {
        socket.to(conversationId).emit('messageDeleted', { messageId });
        console.log(`Socket.IO Server: > Message ${messageId} deleted in room ${conversationId}`);
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
