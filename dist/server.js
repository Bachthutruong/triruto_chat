"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
const dotenv_1 = require("dotenv");
const path_1 = require("path");
const processReminders_js_1 = require("./lib/cron/processReminders.js");
const sessionUsageService_js_1 = require("./services/sessionUsageService.js");
const mongoose_1 = __importDefault(require("mongoose"));
// Load environment variables from all possible .env files
(0, dotenv_1.config)({ path: (0, path_1.resolve)(process.cwd(), '.env.local') });
(0, dotenv_1.config)({ path: (0, path_1.resolve)(process.cwd(), '.env') });
// Log environment status
console.log('Environment variables loaded. MONGODB_URI is', process.env.MONGODB_URI ? 'set' : 'not set');
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const socket_io_1 = require("socket.io");
const actions_js_1 = require("./app/actions.js");
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
mongoose_1.default.connect(process.env.MONGODB_URI || '', mongooseOptions)
    .then(() => {
    console.log('MongoDB connected successfully');
})
    .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});
// Handle MongoDB connection events
mongoose_1.default.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});
mongoose_1.default.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});
mongoose_1.default.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
});
console.log(`Socket.IO Server: Starting in ${dev ? 'development' : 'production'} mode on ${hostname}:${port}.`);
console.log("Socket.IO Server: Initializing Next.js app...");
const app = (0, next_1.default)({ dev, hostname, port });
const handle = app.getRequestHandler();
console.log("Socket.IO Server: Attempting to prepare Next.js app...");
app.prepare().then(() => {
    console.log("Socket.IO Server: > Next.js app prepared successfully.");
    // Run reminder processing job every minute
    setInterval(async () => {
        try {
            // Check MongoDB connection before processing
            if (mongoose_1.default.connection.readyState !== 1) {
                console.log('MongoDB not connected, skipping reminder processing');
                return;
            }
            await (0, processReminders_js_1.processReminders)();
        }
        catch (error) {
            console.error('Error in reminder processing:', error);
        }
    }, 60000);
    // Run end-of-day session usage processing every hour
    setInterval(async () => {
        try {
            if (mongoose_1.default.connection.readyState !== 1) {
                console.log('MongoDB not connected, skipping session usage processing');
                return;
            }
            const now = new Date();
            // Chỉ chạy vào cuối ngày (23:00-23:59)
            if (now.getHours() === 23) {
                await (0, sessionUsageService_js_1.processEndOfDaySessionUsage)();
            }
        }
        catch (error) {
            console.error('Error in session usage processing:', error);
        }
    }, 3600000); // Chạy mỗi giờ
    // Run expiry reminders twice a day (9 AM and 6 PM)
    setInterval(async () => {
        try {
            if (mongoose_1.default.connection.readyState !== 1) {
                console.log('MongoDB not connected, skipping expiry reminders');
                return;
            }
            const now = new Date();
            // Chạy vào 9h sáng và 6h chiều
            if (now.getHours() === 9 || now.getHours() === 18) {
                await (0, sessionUsageService_js_1.sendExpiryReminders)();
            }
        }
        catch (error) {
            console.error('Error in expiry reminders:', error);
        }
    }, 3600000); // Chạy mỗi giờ
    const httpServer = (0, http_1.createServer)((req, res) => {
        try {
            const parsedUrl = (0, url_1.parse)(req.url, true);
            handle(req, res, parsedUrl);
        }
        catch (err) {
            console.error('Socket.IO Server: Error handling HTTP request:', err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });
    console.log("Socket.IO Server: > HTTP server created.");
    console.log("Socket.IO Server: Attempting to initialize Socket.IO server with explicit path '/socket.io/'...");
    const io = new socket_io_1.Server(httpServer, {
        path: '/socket.io/',
        cors: {
            origin: "*", // Allow all origins for development
            methods: ["GET", "POST"],
            credentials: true
        },
        transports: ['websocket', 'polling'] // Prioritize WebSocket
    });
    console.log("Socket.IO Server: > Socket.IO server initialized successfully on path: /socket.io/");
    io.on('connection', (socket) => {
        console.log(`Socket.IO Server: > Client connected: ${socket.id}. Total clients: ${io.engine.clientsCount}`);
        socket.on('joinRoom', (conversationId) => {
            if (conversationId) {
                socket.join(conversationId);
                console.log(`Socket.IO Server: > Client ${socket.id} joined room '${conversationId}'`);
            }
            else {
                console.warn(`Socket.IO Server: > Client ${socket.id} tried to join a room with an undefined/null conversationId.`);
            }
        });
        socket.on('leaveRoom', (conversationId) => {
            if (conversationId) {
                socket.leave(conversationId);
                console.log(`Socket.IO Server: > Client ${socket.id} left room '${conversationId}'`);
            }
        });
        socket.on('sendMessage', ({ message, conversationId }) => {
            var _a;
            if (conversationId && message) {
                // Broadcast to other clients in the room
                socket.to(conversationId).emit('newMessage', message);
                console.log(`Socket.IO Server: > Message from ${socket.id} in room '${conversationId}' broadcasted: ${(_a = message === null || message === void 0 ? void 0 : message.content) === null || _a === void 0 ? void 0 : _a.substring(0, 30)}...`);
            }
            else {
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
                const userSession = JSON.parse(userSessionJsonString);
                const updatedConversation = await (0, actions_js_1.pinMessageToConversation)(conversationId, messageId, userSession);
                if (updatedConversation) {
                    io.to(conversationId).emit('pinnedMessagesUpdated', {
                        conversationId,
                        pinnedMessageIds: updatedConversation.pinnedMessageIds || []
                    });
                    console.log(`Socket.IO Server: Emitted pinnedMessagesUpdated for convId: ${conversationId} with IDs:`, updatedConversation.pinnedMessageIds);
                }
            }
            catch (error) {
                console.error(`Socket.IO Server: Error processing pinMessageRequested for convId ${conversationId}:`, error.message);
                socket.emit('pinActionError', { messageId, error: error.message || 'Failed to pin message' });
            }
        });
        socket.on('unpinMessageRequested', async ({ conversationId, messageId, userSessionJsonString }) => {
            console.log(`Socket.IO Server: Received unpinMessageRequested for convId: ${conversationId}, msgId: ${messageId}`);
            try {
                const userSession = JSON.parse(userSessionJsonString);
                const updatedConversation = await (0, actions_js_1.unpinMessageFromConversation)(conversationId, messageId, userSession);
                if (updatedConversation) {
                    io.to(conversationId).emit('pinnedMessagesUpdated', {
                        conversationId,
                        pinnedMessageIds: updatedConversation.pinnedMessageIds || []
                    });
                    console.log(`Socket.IO Server: Emitted pinnedMessagesUpdated for convId: ${conversationId} after unpin`);
                }
            }
            catch (error) {
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
        socket.on('disconnect', (reason) => {
            console.log(`Socket.IO Server: > Client ${socket.id} disconnected. Reason: ${reason}. Total clients: ${io.engine.clientsCount}`);
        });
        socket.on('error', (err) => {
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
