// src/models/KeywordMapping.model.ts
import mongoose, { Schema, models } from 'mongoose';
const KeywordMappingSchema = new Schema({
    keywords: { type: [String], required: true, index: true },
    response: { type: String, required: true },
}, { timestamps: true });
const KeywordMappingModel = models.KeywordMapping || mongoose.model('KeywordMapping', KeywordMappingSchema);
export default KeywordMappingModel;
