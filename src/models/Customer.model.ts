// src/models/Customer.model.ts
import type { CustomerProfile, CustomerInteractionStatus } from '@/lib/types';
import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface ICustomer extends Document, Omit<CustomerProfile, 'id' | 'assignedStaffName' | 'interactionStatus' | 'lastMessagePreview' | 'lastMessageTimestamp'> {
  // id is managed by MongoDB as _id
  // assignedStaffName will be populated
  pinnedMessageIds: mongoose.Types.ObjectId[];
  interactionStatus: CustomerInteractionStatus;
  lastMessagePreview?: string;
  lastMessageTimestamp?: Date;
}

const CustomerSchema: Schema<ICustomer> = new Schema({
  phoneNumber: { type: String, required: true, unique: true, index: true },
  name: { type: String },
  internalName: { type: String },
  chatHistoryIds: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
  appointmentIds: [{ type: Schema.Types.ObjectId, ref: 'Appointment' }],
  productIds: [{ type: String }], // For now, keeping product IDs simple, can be ObjectId if Product collection exists
  noteIds: [{ type: Schema.Types.ObjectId, ref: 'Note' }],
  pinnedMessageIds: [{ type: Schema.Types.ObjectId, ref: 'Message', default: [] }],
  tags: [{ type: String, index: true }],
  assignedStaffId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  lastInteractionAt: { type: Date, default: Date.now, index: true },
  interactionStatus: { type: String, enum: ['unread', 'read', 'replied_by_staff'], default: 'unread', index: true },
  lastMessagePreview: { type: String, maxlength: 100 },
  lastMessageTimestamp: { type: Date, index: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });


const CustomerModel = models.Customer as Model<ICustomer> || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default CustomerModel;
