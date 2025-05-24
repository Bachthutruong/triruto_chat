// src/models/QuickReply.model.ts
import mongoose, { Schema, models } from 'mongoose';
const QuickReplySchema = new Schema({
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
}, { timestamps: true });
const QuickReplyModel = models.QuickReply || mongoose.model('QuickReply', QuickReplySchema);
export default QuickReplyModel;
