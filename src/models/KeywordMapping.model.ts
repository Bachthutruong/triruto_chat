// src/models/KeywordMapping.model.ts
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { KeywordMapping } from '@/lib/types';

export interface IKeywordMapping extends Document, Omit<KeywordMapping, 'id'> {
  // id is managed by MongoDB as _id
}

const KeywordMappingSchema: Schema<IKeywordMapping> = new Schema({
  keywords: { type: [String], required: true, index: true },
  response: { type: String, required: true },
}, { timestamps: true });

const KeywordMappingModel = models.KeywordMapping as Model<IKeywordMapping> || mongoose.model<IKeywordMapping>('KeywordMapping', KeywordMappingSchema);

export default KeywordMappingModel;