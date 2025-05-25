// src/models/Conversation.model.ts
import mongoose, { Schema } from 'mongoose';
const ConversationSchema = new Schema({
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    messageIds: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    pinnedMessageIds: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
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
let ConversationModel;
try {
    // Try to get existing model
    ConversationModel = mongoose.model('Conversation');
}
catch (_a) {
    // If model doesn't exist, create it
    ConversationModel = mongoose.model('Conversation', ConversationSchema);
}
export default ConversationModel;
