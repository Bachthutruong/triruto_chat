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
const AppointmentSchema = new mongoose_1.Schema({
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    service: { type: String, required: true },
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true },
    time: { type: String, required: true },
    date: { type: String, required: true },
    branch: { type: String },
    branchId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Branch' },
    packageType: { type: String },
    priority: { type: String },
    status: { type: String, enum: ['booked', 'cancelled', 'completed', 'pending_confirmation', 'rescheduled'], required: true },
    notes: { type: String },
    staffId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    recurrenceType: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
    recurrenceCount: { type: Number, default: 1, min: 1 },
    customerProductId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CustomerProduct', index: true },
    isSessionUsed: { type: Boolean, default: false, index: true },
    sessionUsedAt: { type: Date, index: true },
    isStandaloneSession: { type: Boolean, default: false },
}, { timestamps: true });
AppointmentSchema.index({ customerId: 1, date: 1 });
AppointmentSchema.index({ customerProductId: 1, isSessionUsed: 1 });
const AppointmentModel = mongoose_1.models.Appointment || mongoose_1.default.model('Appointment', AppointmentSchema);
exports.default = AppointmentModel;
