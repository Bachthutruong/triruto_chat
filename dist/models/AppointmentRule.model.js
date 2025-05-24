// src/models/AppointmentRule.model.ts
import mongoose, { Schema, models } from 'mongoose';
const AppointmentRuleSchema = new Schema({
    name: { type: String, required: true, unique: true },
    keywords: { type: [String], required: true, index: true },
    conditions: { type: String, required: true }, // e.g., "service:Haircut,time_range:[5PM-8PM]"
    aiPromptInstructions: { type: String, required: true },
}, { timestamps: true });
const AppointmentRuleModel = models.AppointmentRule || mongoose.model('AppointmentRule', AppointmentRuleSchema);
export default AppointmentRuleModel;
