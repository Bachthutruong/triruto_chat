import mongoose, { Schema, Document, Model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IAppointmentReminder extends Document {
    appointmentId: Types.ObjectId;
    customerId: Types.ObjectId;
    scheduledFor: Date;
    sentAt?: Date;
    status: 'pending' | 'sent' | 'failed';
    errorMessage?: string;
    createdAt: Date;
    updatedAt: Date;
}

const AppointmentReminderSchema = new Schema<IAppointmentReminder>(
    {
        appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
        scheduledFor: { type: Date, required: true },
        sentAt: { type: Date },
        status: {
            type: String,
            enum: ['pending', 'sent', 'failed'],
            default: 'pending'
        },
        errorMessage: { type: String },
    },
    { timestamps: true }
);

// Create indexes for better query performance
AppointmentReminderSchema.index({ appointmentId: 1 });
AppointmentReminderSchema.index({ customerId: 1 });
AppointmentReminderSchema.index({ scheduledFor: 1 });
AppointmentReminderSchema.index({ status: 1 });

// Create or return existing model
const AppointmentReminderModel: Model<IAppointmentReminder> =
    mongoose.models.AppointmentReminder as Model<IAppointmentReminder> ||
    mongoose.model<IAppointmentReminder>('AppointmentReminder', AppointmentReminderSchema);

export default AppointmentReminderModel; 