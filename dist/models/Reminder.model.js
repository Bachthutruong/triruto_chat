import mongoose, { Schema } from 'mongoose';
const ReminderSchema = new Schema({
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    dueDate: { type: Date, required: true },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    completedAt: { type: Date },
    reminderType: {
        type: String,
        enum: ['one_time', 'recurring'],
        default: 'one_time'
    },
    interval: {
        type: {
            type: String,
            enum: ['days', 'weeks', 'months']
        },
        value: { type: Number, min: 1 }
    },
    nextReminderDate: { type: Date },
    lastReminderSent: { type: Date }
}, { timestamps: true });
// Create indexes for better query performance
ReminderSchema.index({ customerId: 1, status: 1 });
ReminderSchema.index({ dueDate: 1, status: 1 });
ReminderSchema.index({ nextReminderDate: 1, status: 1 });
// Fix for mongoose models initialization
let ReminderModel;
try {
    // Try to get existing model
    ReminderModel = mongoose.model('Reminder');
}
catch (_a) {
    // If model doesn't exist, create it
    ReminderModel = mongoose.model('Reminder', ReminderSchema);
}
export default ReminderModel;
