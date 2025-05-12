// src/models/AppointmentRule.model.ts
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { AppointmentRule } from '@/lib/types';

export interface IAppointmentRule extends Document, Omit<AppointmentRule, 'id'> {
  // id is managed by MongoDB as _id
}

const AppointmentRuleSchema: Schema<IAppointmentRule> = new Schema({
  name: { type: String, required: true, unique: true },
  keywords: { type: [String], required: true, index: true },
  conditions: { type: String, required: true }, // e.g., "service:Haircut,time_range:[5PM-8PM]"
  aiPromptInstructions: { type: String, required: true },
}, { timestamps: true });

const AppointmentRuleModel = models.AppointmentRule as Model<IAppointmentRule> || mongoose.model<IAppointmentRule>('AppointmentRule', AppointmentRuleSchema);

export default AppointmentRuleModel;