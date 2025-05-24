// src/models/Conversation.model.ts
import mongoose, { Schema, models } from 'mongoose';
const ParticipantSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['customer', 'staff', 'admin'], required: true },
    name: { type: String },
    phoneNumber: { type: String },
}, { _id: false });
const ConversationSchema = new Schema({
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // Optional: if a specific staff is primary
    title: { type: String },
    participants: [ParticipantSchema],
    messageIds: [{ type: Schema.Types.ObjectId, ref: 'Message', default: [] }],
    pinnedMessageIds: [{ type: Schema.Types.ObjectId, ref: 'Message', default: [] }],
    isPinned: { type: Boolean, default: false },
    lastMessageTimestamp: { type: Date, default: Date.now, index: true },
    lastMessagePreview: { type: String, maxlength: 100 },
}, { timestamps: true });
const ConversationModel = models.Conversation || mongoose.model('Conversation', ConversationSchema);
export default ConversationModel;
