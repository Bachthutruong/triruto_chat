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
// Sub-schema for SpecificDayRule within ProductSchedulingRules
const ProductSpecificDayRuleSchema = new mongoose_1.Schema({
    date: { type: String, required: true }, // "YYYY-MM-DD"
    isOff: { type: Boolean },
    workingHours: [{ type: String }], // ["HH:MM", "HH:MM"]
    numberOfStaff: { type: Number, min: 0 },
    serviceDurationMinutes: { type: Number, min: 5 },
}, { _id: false }); // _id is false as it's embedded
// Sub-schema for ProductSchedulingRules
const ProductSchedulingRulesSchema = new mongoose_1.Schema({
    numberOfStaff: { type: Number, min: 0 },
    serviceDurationMinutes: { type: Number, min: 5 },
    workingHours: [{ type: String }],
    weeklyOffDays: [{ type: Number, min: 0, max: 6 }],
    oneTimeOffDates: [{ type: String }], // "YYYY-MM-DD"
    specificDayRules: [ProductSpecificDayRuleSchema],
}, { _id: false }); // _id is false as it's embedded
const ProductSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true },
    isSchedulable: { type: Boolean, default: true }, // Default to true, admin can disable
    schedulingRules: { type: ProductSchedulingRulesSchema, default: {} }, // Default to empty object
    // Existing fields
    defaultSessions: { type: Number, min: 1 }, // Số buổi mặc định
    expiryDays: { type: Number, min: 1 }, // Số ngày có thể sử dụng
    expiryReminderTemplate: {
        type: String,
        default: 'Xin chào {customerName}, gói dịch vụ {productName} của bạn sẽ hết hạn vào ngày {expiryDate}. Vui lòng liên hệ để gia hạn hoặc sử dụng hết số buổi còn lại.'
    },
    expiryReminderDaysBefore: { type: Number, default: 3, min: 1 }, // Nhắc trước 3 ngày
    // New fields
    type: {
        type: String,
        enum: ['product', 'service'], // Updated type enum
        required: true, // type should be required
    },
    expiryDate: { type: Date, default: null }, // Added expiry date
}, { timestamps: true });
const ProductModel = mongoose_1.default.models.Product || mongoose_1.default.model('Product', ProductSchema);
exports.default = ProductModel;
