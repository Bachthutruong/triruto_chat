// src/models/Branch.model.ts
import mongoose, { Schema, models } from 'mongoose';
// Subdocument schema for BranchSpecificDayRule
const BranchSpecificDayRuleSchema = new Schema({
    date: { type: String, required: true }, // "YYYY-MM-DD"
    isOff: { type: Boolean },
    workingHours: [{ type: String }],
    numberOfStaff: { type: Number },
}, { _id: true });
const BranchSchema = new Schema({
    name: { type: String, required: true, unique: true, trim: true },
    address: { type: String, trim: true },
    contactInfo: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    workingHours: [{ type: String }], // Branch specific working hours ["HH:MM", "HH:MM"]
    offDays: [{ type: Number, min: 0, max: 6 }], // Branch specific weekly off days [0-6]
    numberOfStaff: { type: Number, min: 0 }, // Branch specific staff count
    specificDayOverrides: [BranchSpecificDayRuleSchema],
}, { timestamps: true });
const BranchModel = models.Branch || mongoose.model('Branch', BranchSchema);
export default BranchModel;
