// src/models/Customer.model.ts
import type { CustomerProfile } from '@/lib/types';
import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface ICustomer extends Document, Omit<CustomerProfile, 'id'> {
  // id is managed by MongoDB as _id
}

const CustomerSchema: Schema<ICustomer> = new Schema({
  phoneNumber: { type: String, required: true, unique: true, index: true },
  name: { type: String },
  internalName: { type: String },
  chatHistoryIds: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
  appointmentIds: [{ type: Schema.Types.ObjectId, ref: 'Appointment' }],
  productIds: [{ type: String }], // For now, keeping product IDs simple, can be ObjectId if Product collection exists
  noteIds: [{ type: Schema.Types.ObjectId, ref: 'Note' }], // Assuming a Note model
  tags: [{ type: String }],
  assignedStaffId: { type: Schema.Types.ObjectId, ref: 'User' },
  lastInteractionAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  // userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, // This links a customer profile to a User record if they are a user
}, { timestamps: true });


const CustomerModel = models.Customer as Model<ICustomer> || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default CustomerModel;
