
// src/models/Conversation.model.ts
import mongoose, { Schema, Document, models, Model, Types } from 'mongoose';
import type { Conversation, UserRole } from '@/lib/types';

interface IParticipant extends Document {
    userId: Types.ObjectId;
    role: UserRole;
    name?: string;
    phoneNumber?: string;
}

const ParticipantSchema: Schema<IParticipant> = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['customer', 'staff', 'admin'], required: true },
    name: { type: String },
    phoneNumber: { type: String },
}, { _id: false });


export interface IConversation extends Document, Omit<Conversation, 'id' | 'participants' | 'messageIds' | 'pinnedMessageIds'> {
  customerId: Types.ObjectId;
  staffId?: Types.ObjectId;
  participants: Types.DocumentArray<IParticipant>;
  messageIds: Types.ObjectId[];
  pinnedMessageIds: Types.ObjectId[]; // Changed to be required and default to empty array
}

const ConversationSchema: Schema<IConversation> = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  staffId: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // Optional: if a specific staff is primary
  title: { type: String },
  participants: [ParticipantSchema], 
  messageIds: [{ type: Schema.Types.ObjectId, ref: 'Message', default: [] }],
  pinnedMessageIds: [{ type: Schema.Types.ObjectId, ref: 'Message', default: [] }], // Default to empty array
  isPinned: { type: Boolean, default: false }, 
  lastMessageTimestamp: { type: Date, default: Date.now, index: true },
  lastMessagePreview: { type: String, maxlength: 100 },
}, { timestamps: true });

const ConversationModel = models.Conversation as Model<IConversation> || mongoose.model<IConversation>('Conversation', ConversationSchema);

export default ConversationModel;
