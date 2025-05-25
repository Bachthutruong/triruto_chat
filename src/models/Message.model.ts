// src/models/Message.model.ts
import mongoose, { Schema, Document, Model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  sender: string;
  timestamp: Date;
  isRead: boolean;
  userId?: Types.ObjectId;
  staffId?: Types.ObjectId;
  editedAt?: Date;
  editedBy?: Types.ObjectId;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
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
  },
  { timestamps: true }
);

// Create indexes for better query performance
MessageSchema.index({ conversationId: 1, timestamp: 1 }); // Updated index

// Fix for mongoose models initialization
let MessageModel: mongoose.Model<IMessage>;

try {
  // Try to get existing model
  MessageModel = mongoose.model<IMessage>('Message');
} catch {
  // If model doesn't exist, create it
  MessageModel = mongoose.model<IMessage>('Message', MessageSchema);
}

export default MessageModel;
