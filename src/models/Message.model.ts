// src/models/Message.model.ts
import type { Message } from '@/lib/types';
import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface IMessage extends Document, Omit<Message, 'id'> {
  customerId?: Schema.Types.ObjectId; // Link to the customer this message belongs to
  userId?: Schema.Types.ObjectId; // Link to the user (customer/staff/admin) who sent/received if applicable
}

const MessageSchema: Schema<IMessage> = new Schema({
  sender: { type: String, enum: ['user', 'ai', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  name: { type: String },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // Could be the user who sent (if customer) or staff who replied
}, { timestamps: true });

const MessageModel = models.Message as Model<IMessage> || mongoose.model<IMessage>('Message', MessageSchema);

export default MessageModel;
