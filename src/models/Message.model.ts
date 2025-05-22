
// src/models/Message.model.ts
import type { Message } from '@/lib/types';
import mongoose, { Schema, Document, models, Model } from 'mongoose';

// Remove isPinned from IMessage, as it's managed by Conversation.pinnedMessageIds
export interface IMessage extends Document, Omit<Message, 'id' > {
  customerId?: Schema.Types.ObjectId; 
  userId?: Schema.Types.ObjectId; 
  updatedAt?: Date; 
}

const MessageSchema: Schema<IMessage> = new Schema({
  sender: { type: String, enum: ['user', 'ai', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  name: { type: String }, 
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  // isPinned: { type: Boolean, default: false }, // Removed
}, { timestamps: true }); 

MessageSchema.index({ customerId: 1, timestamp: 1 });

const MessageModel = models.Message as Model<IMessage> || mongoose.model<IMessage>('Message', MessageSchema);

export default MessageModel;
