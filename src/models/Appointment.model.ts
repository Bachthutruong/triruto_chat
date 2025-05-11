// src/models/Appointment.model.ts
import type { AppointmentDetails, AppointmentStatus } from '@/lib/types';
import mongoose, { Schema, Document, models, Model } from 'mongoose';

// The appointmentId field in AppointmentDetails type will map to _id in MongoDB.
// We'll transform _id to appointmentId when sending data to the client.
export interface IAppointment extends Document, Omit<AppointmentDetails, 'appointmentId' | 'userId' > {
  customerId: Schema.Types.ObjectId; // Changed from userId to customerId for clarity
  // appointmentId is _id
}

const AppointmentSchema: Schema<IAppointment> = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  service: { type: String, required: true },
  time: { type: String, required: true },
  date: { type: String, required: true }, // Store as String YYYY-MM-DD for simplicity with AI
  branch: { type: String },
  packageType: { type: String },
  priority: { type: String },
  status: { type: String, enum: ['booked', 'cancelled', 'completed', 'pending_confirmation', 'rescheduled'], required: true },
  notes: { type: String },
  staffId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }); // createdAt and updatedAt will be automatically managed by Mongoose

const AppointmentModel = models.Appointment as Model<IAppointment> || mongoose.model<IAppointment>('Appointment', AppointmentSchema);

export default AppointmentModel;
