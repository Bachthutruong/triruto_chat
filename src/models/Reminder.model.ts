import mongoose, { Schema, Document } from 'mongoose';
import type { Types } from 'mongoose';

export interface IReminder extends Document {
  customerId: Types.ObjectId;
  staffId: Types.ObjectId;
  title: string;
  description: string;
  dueDate: Date;
  status: 'pending' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  completedAt?: Date;
  reminderType: 'one_time' | 'recurring';
  interval?: {
    type: 'days' | 'weeks' | 'months';
    value: number;
  };
  nextReminderDate?: Date;
  lastReminderSent?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
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
  },
  { timestamps: true }
);

// Create indexes for better query performance
ReminderSchema.index({ customerId: 1, status: 1 });
ReminderSchema.index({ dueDate: 1, status: 1 });
ReminderSchema.index({ nextReminderDate: 1, status: 1 });

// Fix for mongoose models initialization
let ReminderModel: mongoose.Model<IReminder>;

try {
  // Try to get existing model
  ReminderModel = mongoose.model<IReminder>('Reminder');
} catch {
  // If model doesn't exist, create it
  ReminderModel = mongoose.model<IReminder>('Reminder', ReminderSchema);
}

export default ReminderModel; 