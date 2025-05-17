
// src/models/Appointment.model.ts
import type { AppointmentDetails, AppointmentStatus } from '@/lib/types';
import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface IAppointment extends Document, Omit<AppointmentDetails, 'appointmentId' | 'userId' > {
  customerId: Schema.Types.ObjectId; 
  productId?: Schema.Types.ObjectId; // For linking to ProductItem if applicable
  branchId?: Schema.Types.ObjectId; // For linking to Branch if applicable
}

const AppointmentSchema: Schema<IAppointment> = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  service: { type: String, required: true }, // This would be the product/service name
  productId: { type: Schema.Types.ObjectId, ref: 'Product' }, // Optional link to Product collection
  time: { type: String, required: true },
  date: { type: String, required: true }, // Store as String YYYY-MM-DD for simplicity with AI
  branch: { type: String }, // Branch name
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' }, // Optional link to Branch collection
  packageType: { type: String },
  priority: { type: String },
  status: { type: String, enum: ['booked', 'cancelled', 'completed', 'pending_confirmation', 'rescheduled'], required: true },
  notes: { type: String },
  staffId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const AppointmentModel = models.Appointment as Model<IAppointment> || mongoose.model<IAppointment>('Appointment', AppointmentSchema);

export default AppointmentModel;
