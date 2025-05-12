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
  content: { type: String, required: true },
}, { timestamps: true }); // createdAt and updatedAt managed by Mongoose

const NoteModel = models.Note as Model<INote> || mongoose.model<INote>('Note', NoteSchema);

export default NoteModel;