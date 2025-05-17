
// src/models/Branch.model.ts
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { Branch, BranchSpecificDayRule } from '@/lib/types';

// Subdocument schema for BranchSpecificDayRule
const BranchSpecificDayRuleSchema: Schema<BranchSpecificDayRule> = new Schema({
  date: { type: String, required: true }, // "YYYY-MM-DD"
  isOff: { type: Boolean },
  workingHours: [{ type: String }],
  numberOfStaff: { type: Number },
}, { _id: true });


export interface IBranch extends Document, Omit<Branch, 'id' | 'specificDayOverrides' | 'createdAt' | 'updatedAt' > {
  specificDayOverrides?: mongoose.Types.DocumentArray<Omit<BranchSpecificDayRule, 'id'>>;
}

const BranchSchema: Schema<IBranch> = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  address: { type: String, trim: true },
  contactInfo: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  workingHours: [{ type: String }], // Branch specific working hours ["HH:MM", "HH:MM"]
  offDays: [{ type: Number, min:0, max: 6 }], // Branch specific weekly off days [0-6]
  numberOfStaff: { type: Number, min: 0 }, // Branch specific staff count
  specificDayOverrides: [BranchSpecificDayRuleSchema],
}, { timestamps: true });

const BranchModel = models.Branch as Model<IBranch> || mongoose.model<IBranch>('Branch', BranchSchema);

export default BranchModel;
