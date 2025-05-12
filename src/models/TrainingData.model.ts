// src/models/TrainingData.model.ts
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { TrainingData, TrainingDataStatus } from '@/lib/types';

export interface ITrainingData extends Document, Omit<TrainingData, 'id'> {
  // id is managed by MongoDB as _id
}

const TrainingDataSchema: Schema<ITrainingData> = new Schema({
  userInput: { type: String, required: true },
  idealResponse: { type: String },
  label: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending_review', 'approved', 'rejected'], default: 'pending_review', required: true },
}, { timestamps: true });

const TrainingDataModel = models.TrainingData as Model<ITrainingData> || mongoose.model<ITrainingData>('TrainingData', TrainingDataSchema);

export default TrainingDataModel;