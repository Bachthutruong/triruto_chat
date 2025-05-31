// src/server.ts
import { config } from 'dotenv';
import { resolve } from 'path';
import { processReminders } from './lib/cron/processReminders.js';
import { processEndOfDaySessionUsage, sendExpiryReminders } from './services/sessionUsageService.js';
import mongoose from 'mongoose';

// Load environment variables from all possible .env files
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

// Log environment status
console.log('Environment variables loaded. MONGODB_URI is', process.env.MONGODB_URI ? 'set' : 'not set');

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { pinMessageToConversation, unpinMessageFromConversation } from './app/actions.js';
import type { UserSession } from './lib/types';

console.log("Socket.IO Server: dotenv configured.");

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '9002', 10);

// MongoDB connection options
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || '', mongooseOptions)
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

console.log(`Socket.IO Server: Starting in ${dev ? 'development' : 'production'} mode on ${hostname}:${port}.`);

console.log("Socket.IO Server: Initializing Next.js app...");
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log("Socket.IO Server: Attempting to prepare Next.js app...");
app.prepare().then(() => {
  console.log("Socket.IO Server: > Next.js app prepared successfully.");

  // Run reminder processing job every minute
  setInterval(async () => {
    try {
      // Check MongoDB connection before processing
      if (mongoose.connection.readyState !== 1) {
        console.log('MongoDB not connected, skipping reminder processing');
        return;
      }
      await processReminders();
    } catch (error) {
      console.error('Error in reminder processing:', error);
    }
  }, 60000);

  // Run end-of-day session usage processing every hour
  setInterval(async () => {
    try {
      if (mongoose.connection.readyState !== 1) {
        console.log('MongoDB not connected, skipping session usage processing');
        return;
      }

      const now = new Date();
      // Chỉ chạy vào cuối ngày (23:00-23:59)
      if (now.getHours() === 23) {
        await processEndOfDaySessionUsage();
      }
    } catch (error) {
      console.error('Error in session usage processing:', error);
    }
  }, 3600000); // Chạy mỗi giờ

  // Run expiry reminders twice a day (9 AM and 6 PM)
  setInterval(async () => {
    try {
      if (mongoose.connection.readyState !== 1) {
        console.log('MongoDB not connected, skipping expiry reminders');
        return;
      }

      const now = new Date();
      // Chạy vào 9h sáng và 6h chiều
      if (now.getHours() === 9 || now.getHours() === 18) {
        await sendExpiryReminders();
      }
    } catch (error) {
      console.error('Error in expiry reminders:', error);
    }
  }, 3600000); // Chạy mỗi giờ

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
      origin: "*", // Allow all origins for development
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'] // Prioritize WebSocket
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
        // Broadcast to other clients in the room
        socket.to(conversationId).emit('newMessage', message);
        console.log(`Socket.IO Server: > Message from ${socket.id} in room '${conversationId}' broadcasted: ${message?.content?.substring(0, 30)}...`);
      } else {
        console.warn(`Socket.IO Server: > Received sendMessage event with missing message or conversationId from ${socket.id}`);
      }
    });

    socket.on('typing', ({ conversationId, userName, userId }) => {
      if (conversationId) {
        socket.to(conversationId).emit('userTyping', { userId, userName, conversationId });
      }
    });

    socket.on('stopTyping', ({ conversationId, userId }) => {
      if (conversationId) {
        socket.to(conversationId).emit('userStopTyping', { userId, conversationId });
      }
    });

    socket.on('pinMessageRequested', async ({ conversationId, messageId, userSessionJsonString }) => {
      console.log(`Socket.IO Server: Received pinMessageRequested for convId: ${conversationId}, msgId: ${messageId}`);
      try {
        const userSession: UserSession = JSON.parse(userSessionJsonString);
        const updatedConversation = await pinMessageToConversation(conversationId, messageId, userSession);
        if (updatedConversation) {
          io.to(conversationId).emit('pinnedMessagesUpdated', {
            conversationId,
            pinnedMessageIds: updatedConversation.pinnedMessageIds || []
          });
          console.log(`Socket.IO Server: Emitted pinnedMessagesUpdated for convId: ${conversationId} with IDs:`, updatedConversation.pinnedMessageIds);
        }
      } catch (error: any) {
        console.error(`Socket.IO Server: Error processing pinMessageRequested for convId ${conversationId}:`, error.message);
        socket.emit('pinActionError', { messageId, error: error.message || 'Failed to pin message' });
      }
    });

    socket.on('unpinMessageRequested', async ({ conversationId, messageId, userSessionJsonString }) => {
      console.log(`Socket.IO Server: Received unpinMessageRequested for convId: ${conversationId}, msgId: ${messageId}`);
      try {
        const userSession: UserSession = JSON.parse(userSessionJsonString);
        const updatedConversation = await unpinMessageFromConversation(conversationId, messageId, userSession);
        if (updatedConversation) {
          io.to(conversationId).emit('pinnedMessagesUpdated', {
            conversationId,
            pinnedMessageIds: updatedConversation.pinnedMessageIds || []
          });
          console.log(`Socket.IO Server: Emitted pinnedMessagesUpdated for convId: ${conversationId} after unpin`);
        }
      } catch (error: any) {
        console.error(`Socket.IO Server: Error processing unpinMessageRequested for convId ${conversationId}:`, error.message);
        socket.emit('unpinActionError', { messageId, error: error.message || 'Failed to unpin message' });
      }
    });

    socket.on('editMessage', ({ message, conversationId }) => {
      if (conversationId && message) {
        socket.to(conversationId).emit('messageEdited', { message, conversationId });
        console.log(`Socket.IO Server: > Message ${message.id} edit broadcast in room '${conversationId}'`);
      }
    });

    socket.on('deleteMessage', ({ messageId, conversationId }) => {
      if (conversationId && messageId) {
        socket.to(conversationId).emit('messageDeleted', { messageId, conversationId });
        console.log(`Socket.IO Server: > Message ${messageId} deletion broadcast in room '${conversationId}'`);
      }
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`Socket.IO Server: > Client ${socket.id} disconnected. Reason: ${reason}. Total clients: ${io.engine.clientsCount}`);
    });

    socket.on('error', (err: Error) => {
      console.error(`Socket.IO Server: > Socket error for ${socket.id}:`, err);
    });

  });

  io.engine.on("connection_error", (err) => {
    console.error("Socket.IO Server: Engine connection error. Code:", err.code, "Message:", err.message, "Context:", err.context);
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