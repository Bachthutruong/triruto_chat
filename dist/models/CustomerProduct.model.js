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
const CustomerProductSchema = new mongoose_1.Schema({
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productName: { type: String, required: true },
    totalSessions: { type: Number, required: true, min: 0 },
    usedSessions: { type: Number, default: 0, min: 0 },
    remainingSessions: { type: Number, required: true, min: 0 },
    assignedDate: { type: Date, required: true, default: Date.now },
    expiryDate: { type: Date, index: true },
    expiryDays: { type: Number, min: 1 },
    isActive: { type: Boolean, default: true, index: true },
    lastUsedDate: { type: Date, index: true },
    staffId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String },
}, {
    timestamps: true
});
// Middleware để tự động tính remainingSessions
CustomerProductSchema.pre('save', function (next) {
    if (this.isModified('totalSessions') || this.isModified('usedSessions')) {
        this.remainingSessions = Math.max(0, this.totalSessions - this.usedSessions);
    }
    next();
});
// Index compound để tối ưu truy vấn
CustomerProductSchema.index({ customerId: 1, isActive: 1 });
CustomerProductSchema.index({ expiryDate: 1, isActive: 1 });
const CustomerProductModel = mongoose_1.default.models.CustomerProduct ||
    mongoose_1.default.model('CustomerProduct', CustomerProductSchema);
exports.default = CustomerProductModel;
