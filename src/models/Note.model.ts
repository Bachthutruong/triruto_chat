
// src/models/Note.model.ts
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { Note } from '@/lib/types';

export interface INote extends Document, Omit<Note, 'id' | 'staffName'> {
  // id is managed by MongoDB as _id
  // staffName will be populated
}

const NoteSchema: Schema<INote> = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // User who created/last edited
  content: { type: String, trim: true }, // Made content optional at schema level
  imageDataUri: { type: String },
  imageFileName: { type: String },
}, { timestamps: true }); // createdAt and updatedAt managed by Mongoose

// Custom validator to ensure either content or imageDataUri exists
NoteSchema.pre<INote>('validate', function (next) {
  if (!this.content?.trim() && !this.imageDataUri) {
    next(new Error('Ghi chú phải có nội dung văn bản hoặc hình ảnh.'));
  } else {
    next();
  }
});

const NoteModel = models.Note as Model<INote> || mongoose.model<INote>('Note', NoteSchema);

export default NoteModel;
