// src/models/Conversation.model.ts
import mongoose, { Schema, Document, Model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IConversation extends Document {
  customerId: Types.ObjectId;
  messageIds: Types.ObjectId[];
  pinnedMessageIds: Types.ObjectId[];
  lastMessageTimestamp: Date;
  lastMessagePreview: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
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
  },
  { timestamps: true }
);

// Create indexes for better query performance
ConversationSchema.index({ customerId: 1 });
ConversationSchema.index({ lastMessageTimestamp: -1 });
ConversationSchema.index({ status: 1 });

// Fix for mongoose models initialization
let ConversationModel: mongoose.Model<IConversation>;

try {
  // Try to get existing model
  ConversationModel = mongoose.model<IConversation>('Conversation');
} catch {
  // If model doesn't exist, create it
  ConversationModel = mongoose.model<IConversation>('Conversation', ConversationSchema);
}

export default ConversationModel;
