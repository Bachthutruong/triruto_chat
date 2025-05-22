
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

// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log("Attempting to prepare Next.js app...");
app.prepare().then(() => {
  console.log("> Next.js app prepared successfully.");
  const httpServer = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  console.log("Attempting to initialize Socket.IO server...");
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io/', // Explicit path
    cors: {
      origin: "*", // Allow all origins for development
      methods: ["GET", "POST"]
    }
  });
  console.log("> Socket.IO server initialized successfully on path: /socket.io/");

  io.on('connection', (socket: Socket) => {
    console.log('> Socket.IO: New client connected, ID:', socket.id);

    socket.on('joinRoom', (conversationId: string) => {
      socket.join(conversationId);
      console.log(`> Socket.IO: Client ${socket.id} joined room ${conversationId}`);
    });

    socket.on('leaveRoom', (conversationId: string) => {
      socket.leave(conversationId);
      console.log(`> Socket.IO: Client ${socket.id} left room ${conversationId}`);
    });

    socket.on('sendMessage', ({ message, conversationId }) => {
      // Broadcast to all clients in the room except the sender
      socket.to(conversationId).emit('newMessage', message);
      console.log(`> Socket.IO: Message sent in room ${conversationId} by ${socket.id}`);
    });
    
    socket.on('typing', ({ conversationId, userName }) => {
      socket.to(conversationId).emit('userTyping', { userId: socket.id, userName, conversationId });
    });

    socket.on('stopTyping', ({ conversationId }) => {
      socket.to(conversationId).emit('userStopTyping', { userId: socket.id, conversationId });
    });

    socket.on('disconnect', (reason) => {
      console.log(`> Socket.IO: Client ${socket.id} disconnected. Reason: ${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`> Socket.IO: Error for socket ${socket.id}:`, err);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error('> HTTP Server Error:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO listening on port ${port}`);
    });
}).catch(err => {
    console.error("Error during Next.js app preparation:", err);
    process.exit(1);
});

