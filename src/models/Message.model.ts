// src/models/Message.model.ts
import type { Message } from '@/lib/types';
import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface IMessage extends Document, Omit<Message, 'id'> {
  customerId?: Schema.Types.ObjectId; // Link to the customer this message belongs to
  userId?: Schema.Types.ObjectId; // Link to the user (customer/staff/admin) who sent/received if applicable
                                  // For staff messages, this will be the staff's ID.
  isPinned?: boolean;
  updatedAt?: Date; // For edited messages
}

const MessageSchema: Schema<IMessage> = new Schema({
  sender: { type: String, enum: ['user', 'ai', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  name: { type: String }, // For 'ai' sender, this can be Staff/Admin name or "AI Assistant"
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true }, 
  isPinned: { type: Boolean, default: false },
}, { timestamps: true }); // createdAt and updatedAt will be automatically managed by Mongoose

MessageSchema.index({ customerId: 1, timestamp: 1 });

const MessageModel = models.Message as Model<IMessage> || mongoose.model<IMessage>('Message', MessageSchema);

export default MessageModel;
