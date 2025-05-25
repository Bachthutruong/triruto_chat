// src/models/Message.model.ts
import mongoose, { Schema } from 'mongoose';
const MessageSchema = new Schema({
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    content: { type: String, required: true },
    type: {
        type: String,
        enum: ['text', 'image', 'file', 'system'],
        default: 'text'
    },
    sender: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false },
    userId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    staffId: { type: Schema.Types.ObjectId, ref: 'User' },
    editedAt: { type: Date },
    editedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
// Create indexes for better query performance
MessageSchema.index({ conversationId: 1, timestamp: 1 }); // Updated index
// Fix for mongoose models initialization
let MessageModel;
try {
    // Try to get existing model
    MessageModel = mongoose.model('Message');
}
catch (_a) {
    // If model doesn't exist, create it
    MessageModel = mongoose.model('Message', MessageSchema);
}
export default MessageModel;
