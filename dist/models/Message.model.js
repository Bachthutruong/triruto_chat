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
// src/models/Message.model.ts
const mongoose_1 = __importStar(require("mongoose"));
const MessageSchema = new mongoose_1.Schema({
    conversationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    content: { type: String, required: true },
    type: {
        type: String,
        enum: ['text', 'image', 'file', 'system'],
        default: 'text'
    },
    sender: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer' },
    staffId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    editedAt: { type: Date },
    editedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true }
}, { timestamps: true });
// Create indexes for better query performance
MessageSchema.index({ conversationId: 1, timestamp: 1 }); // Updated index
// Fix for mongoose models initialization
let MessageModel;
try {
    // Try to get existing model
    MessageModel = mongoose_1.default.model('Message');
}
catch (_a) {
    // If model doesn't exist, create it
    MessageModel = mongoose_1.default.model('Message', MessageSchema);
}
exports.default = MessageModel;
