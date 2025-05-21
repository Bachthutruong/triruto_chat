
// src/models/QuickReply.model.ts
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { QuickReplyType } from '@/lib/types';

export interface IQuickReply extends Document, Omit<QuickReplyType, 'id'> {
  // id is managed by MongoDB as _id
}

const QuickReplySchema: Schema<IQuickReply> = new Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true, trim: true },
}, { timestamps: true });

const QuickReplyModel = models.QuickReply as Model<IQuickReply> || mongoose.model<IQuickReply>('QuickReply', QuickReplySchema);

export default QuickReplyModel;
