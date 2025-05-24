// src/models/TrainingData.model.ts
import mongoose, { Schema, models } from 'mongoose';
const TrainingDataSchema = new Schema({
    userInput: { type: String, required: true },
    idealResponse: { type: String },
    label: { type: String, required: true, index: true },
    status: { type: String, enum: ['pending_review', 'approved', 'rejected'], default: 'pending_review', required: true },
}, { timestamps: true });
const TrainingDataModel = models.TrainingData || mongoose.model('TrainingData', TrainingDataSchema);
export default TrainingDataModel;
