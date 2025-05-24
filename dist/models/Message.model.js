import mongoose, { Schema, models } from 'mongoose';
const MessageSchema = new Schema({
    sender: { type: String, enum: ['user', 'ai', 'system'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    name: { type: String },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
}, { timestamps: true });
MessageSchema.index({ conversationId: 1, timestamp: 1 }); // Updated index
const MessageModel = models.Message || mongoose.model('Message', MessageSchema);
export default MessageModel;
