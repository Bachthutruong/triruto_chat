import mongoose, { Schema } from 'mongoose';
const AppointmentReminderSchema = new Schema({
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
}, { timestamps: true });
// Create indexes for better query performance
AppointmentReminderSchema.index({ appointmentId: 1 });
AppointmentReminderSchema.index({ customerId: 1 });
AppointmentReminderSchema.index({ scheduledFor: 1 });
AppointmentReminderSchema.index({ status: 1 });
// Create or return existing model
const AppointmentReminderModel = mongoose.models.AppointmentReminder ||
    mongoose.model('AppointmentReminder', AppointmentReminderSchema);
export default AppointmentReminderModel;
