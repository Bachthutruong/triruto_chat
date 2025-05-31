"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const CustomerSchema = new mongoose_1.Schema({
    phoneNumber: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    internalName: { type: String },
    email: { type: String },
    address: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    notes: { type: String },
    conversationIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Conversation', default: [] }],
    appointmentIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Appointment', default: [] }],
    productIds: [{ type: String, default: [] }],
    noteIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Note', default: [] }],
    pinnedMessageIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Message', default: [] }],
    messagePinningAllowedConversationIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Conversation', default: [] }],
    pinnedConversationIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Conversation', default: [] }],
    tags: [{ type: String, index: true, default: [] }],
    assignedStaffId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', index: true },
    lastInteractionAt: { type: Date, default: Date.now, index: true },
    interactionStatus: { type: String, enum: ['unread', 'read', 'replied_by_staff'], default: 'unread', index: true },
    lastMessagePreview: { type: String, maxlength: 100 },
    lastMessageTimestamp: { type: Date, index: true },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true, strictPopulate: false }); // Added strictPopulate: false
const CustomerModel = mongoose_1.models.Customer || mongoose_1.default.model('Customer', CustomerSchema);
exports.default = CustomerModel;
