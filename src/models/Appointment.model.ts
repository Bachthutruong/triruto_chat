// src/models/Appointment.model.ts
import type { AppointmentDetails, AppointmentStatus } from '@/lib/types';
import mongoose, { Schema, Document, models, Model } from 'mongoose';
//@ts-ignore
export interface IAppointment extends Document, Omit<AppointmentDetails, 'appointmentId' | 'userId'> {
  customerId: Schema.Types.ObjectId;
  productId: Schema.Types.ObjectId;
  branchId?: Schema.Types.ObjectId;
  recurrenceType?: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrenceCount?: number;
  customerProductId?: Schema.Types.ObjectId;
  isSessionUsed?: boolean;
  sessionUsedAt?: Date;
  isStandaloneSession?: boolean;
}

const AppointmentSchema: Schema<IAppointment> = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  service: { type: String, required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  time: { type: String, required: true },
  date: { type: String, required: true },
  branch: { type: String },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  packageType: { type: String },
  priority: { type: String },
  status: { type: String, enum: ['booked', 'cancelled', 'completed', 'pending_confirmation', 'rescheduled'], required: true },
  notes: { type: String },
  staffId: { type: Schema.Types.ObjectId, ref: 'User' },
  recurrenceType: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
  recurrenceCount: { type: Number, default: 1, min: 1 },
  customerProductId: { type: Schema.Types.ObjectId, ref: 'CustomerProduct', index: true },
  isSessionUsed: { type: Boolean, default: false, index: true },
  sessionUsedAt: { type: Date, index: true },
  isStandaloneSession: { type: Boolean, default: false },
}, { timestamps: true });

AppointmentSchema.index({ customerId: 1, date: 1 });
AppointmentSchema.index({ customerProductId: 1, isSessionUsed: 1 });

const AppointmentModel = models.Appointment as Model<IAppointment> || mongoose.model<IAppointment>('Appointment', AppointmentSchema);

export default AppointmentModel;
