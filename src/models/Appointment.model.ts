
// src/models/Appointment.model.ts
import type { AppointmentDetails, AppointmentStatus } from '@/lib/types';
import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface IAppointment extends Document, Omit<AppointmentDetails, 'appointmentId' | 'userId' > {
  customerId: Schema.Types.ObjectId; 
  productId: Schema.Types.ObjectId; // Changed from optional string to required ObjectId
  branchId?: Schema.Types.ObjectId; 
}

const AppointmentSchema: Schema<IAppointment> = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  service: { type: String, required: true }, 
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // Made required
  time: { type: String, required: true },
  date: { type: String, required: true }, 
  branch: { type: String }, 
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' }, 
  packageType: { type: String },
  priority: { type: String },
  status: { type: String, enum: ['booked', 'cancelled', 'completed', 'pending_confirmation', 'rescheduled'], required: true },
  notes: { type: String },
  staffId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const AppointmentModel = models.Appointment as Model<IAppointment> || mongoose.model<IAppointment>('Appointment', AppointmentSchema);

export default AppointmentModel;
