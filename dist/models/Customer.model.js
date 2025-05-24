import mongoose, { Schema, models } from 'mongoose';
const CustomerSchema = new Schema({
    phoneNumber: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    internalName: { type: String },
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
const CustomerModel = models.Customer || mongoose.model('Customer', CustomerSchema);
export default CustomerModel;
