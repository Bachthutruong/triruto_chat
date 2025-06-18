"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Conversation.model.ts
var mongoose_1 = require("mongoose");
var ConversationSchema = new mongoose_1.Schema({
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true },
    messageIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Message' }],
    pinnedMessageIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Message' }],
    lastMessageTimestamp: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: '' },
    status: {
        type: String,
        enum: ['active', 'archived'],
        default: 'active'
    }
}, { timestamps: true });
// Create indexes for better query performance
ConversationSchema.index({ customerId: 1 });
ConversationSchema.index({ lastMessageTimestamp: -1 });
ConversationSchema.index({ status: 1 });
// Fix for mongoose models initialization
var ConversationModel;
try {
    // Try to get existing model
    ConversationModel = mongoose_1.default.model('Conversation');
}
catch (_a) {
    // If model doesn't exist, create it
    ConversationModel = mongoose_1.default.model('Conversation', ConversationSchema);
}
exports.default = ConversationModel;
