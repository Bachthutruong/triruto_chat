import mongoose, { Schema, Document, Model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IReminder extends Document {
  customerId: Types.ObjectId | string;
  staffId: Types.ObjectId | string;
  title: string;
  description: string;
  dueDate: Date;
  status: 'pending' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  completedAt?: Date;
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
  },
  { timestamps: true }
);

// Create indexes for better query performance
ReminderSchema.index({ customerId: 1, status: 1 });
ReminderSchema.index({ staffId: 1, status: 1 });
ReminderSchema.index({ dueDate: 1 });

// Create or return existing model
const ReminderModel: Model<IReminder> = mongoose.models.Reminder as Model<IReminder> || mongoose.model<IReminder>('Reminder', ReminderSchema);

export default ReminderModel; 