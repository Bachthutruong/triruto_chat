"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Message.model.ts
var mongoose_1 = require("mongoose");
var MessageSchema = new mongoose_1.Schema({
    conversationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    content: { type: String, required: true },
    type: {
        type: String,
        enum: ['text', 'image', 'file', 'system'],
        default: 'text'
    },
    sender: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer' },
    staffId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    editedAt: { type: Date },
    editedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
// Create indexes for better query performance
MessageSchema.index({ conversationId: 1, timestamp: 1 }); // Updated index
// Fix for mongoose models initialization
var MessageModel;
try {
    // Try to get existing model
    MessageModel = mongoose_1.default.model('Message');
}
catch (_a) {
    // If model doesn't exist, create it
    MessageModel = mongoose_1.default.model('Message', MessageSchema);
}
exports.default = MessageModel;
