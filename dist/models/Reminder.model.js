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
const ReminderSchema = new mongoose_1.Schema({
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true },
    staffId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
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
    ReminderModel = mongoose_1.default.model('Reminder');
}
catch (_a) {
    // If model doesn't exist, create it
    ReminderModel = mongoose_1.default.model('Reminder', ReminderSchema);
}
exports.default = ReminderModel;
