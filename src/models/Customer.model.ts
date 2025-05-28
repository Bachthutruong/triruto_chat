// src/models/Customer.model.ts
import type { CustomerProfile, CustomerInteractionStatus } from '@/lib/types';
import mongoose, { Schema, Document, models, Model, Types } from 'mongoose';

//@ts-ignore
export interface ICustomer extends Document, Omit<CustomerProfile, 'id' | 'assignedStaffName' | 'interactionStatus' | 'lastMessagePreview' | 'lastMessageTimestamp' | 'conversationIds' | 'appointmentIds' | 'productIds' | 'noteIds' | 'pinnedMessageIds' | 'messagePinningAllowedConversationIds' | 'pinnedConversationIds' | 'tags'> {
  // id is managed by MongoDB as _id
  // assignedStaffName will be populated
  conversationIds: mongoose.Types.ObjectId[];
  appointmentIds: mongoose.Types.ObjectId[];
  productIds: string[]; // For now, keeping product IDs simple, can be ObjectId if Product collection exists
  noteIds: mongoose.Types.ObjectId[];
  pinnedMessageIds: mongoose.Types.ObjectId[];
  tags?: string[];
  assignedStaffId?: mongoose.Types.ObjectId; // Reference to User model
  lastInteractionAt: Date;
  createdAt: Date;
  interactionStatus: CustomerInteractionStatus;
  lastMessagePreview?: string;
  lastMessageTimestamp?: Date;
  messagePinningAllowedConversationIds: mongoose.Types.ObjectId[];
  pinnedConversationIds: mongoose.Types.ObjectId[];
  // Thêm các trường còn thiếu
  email?: string;
  address?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  notes?: string;
}

const CustomerSchema: Schema<ICustomer> = new Schema({
  phoneNumber: { type: String, required: true, unique: true, index: true },
  name: { type: String },
  internalName: { type: String },
  email: { type: String },
  address: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  notes: { type: String },
  conversationIds: [{ type: Schema.Types.ObjectId, ref: 'Conversation', default: [] }],
  appointmentIds: [{ type: Schema.Types.ObjectId, ref: 'Appointment', default: [] }],
  productIds: [{ type: String, default: [] }],
  noteIds: [{ type: Schema.Types.ObjectId, ref: 'Note', default: [] }],
  pinnedMessageIds: [{ type: Schema.Types.ObjectId, ref: 'Message', default: [] }],
  messagePinningAllowedConversationIds: [{ type: Schema.Types.ObjectId, ref: 'Conversation', default: [] }],
  pinnedConversationIds: [{ type: Schema.Types.ObjectId, ref: 'Conversation', default: [] }],
  tags: [{ type: String, index: true, default: [] }],
  assignedStaffId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  lastInteractionAt: { type: Date, default: Date.now, index: true },
  interactionStatus: { type: String, enum: ['unread', 'read', 'replied_by_staff'], default: 'unread', index: true },
  lastMessagePreview: { type: String, maxlength: 100 },
  lastMessageTimestamp: { type: Date, index: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true, strictPopulate: false }); // Added strictPopulate: false


const CustomerModel = models.Customer as Model<ICustomer> || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default CustomerModel;
