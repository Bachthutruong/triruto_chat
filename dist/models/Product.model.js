import mongoose, { Schema } from 'mongoose';
// Sub-schema for SpecificDayRule within ProductSchedulingRules
const ProductSpecificDayRuleSchema = new Schema({
    date: { type: String, required: true }, // "YYYY-MM-DD"
    isOff: { type: Boolean },
    workingHours: [{ type: String }], // ["HH:MM", "HH:MM"]
    numberOfStaff: { type: Number, min: 0 },
    serviceDurationMinutes: { type: Number, min: 5 },
}, { _id: false }); // _id is false as it's embedded
// Sub-schema for ProductSchedulingRules
const ProductSchedulingRulesSchema = new Schema({
    numberOfStaff: { type: Number, min: 0 },
    serviceDurationMinutes: { type: Number, min: 5 },
    workingHours: [{ type: String }],
    weeklyOffDays: [{ type: Number, min: 0, max: 6 }],
    oneTimeOffDates: [{ type: String }], // "YYYY-MM-DD"
    specificDayRules: [ProductSpecificDayRuleSchema],
}, { _id: false }); // _id is false as it's embedded
const ProductSchema = new Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true },
    isSchedulable: { type: Boolean, default: true }, // Default to true, admin can disable
    schedulingRules: { type: ProductSchedulingRulesSchema, default: {} }, // Default to empty object
    // Thêm các trường mới
    defaultSessions: { type: Number, min: 1 }, // Số buổi mặc định
    expiryDays: { type: Number, min: 1 }, // Số ngày có thể sử dụng
    expiryReminderTemplate: {
        type: String,
        default: 'Xin chào {customerName}, gói dịch vụ {productName} của bạn sẽ hết hạn vào ngày {expiryDate}. Vui lòng liên hệ để gia hạn hoặc sử dụng hết số buổi còn lại.'
    },
    expiryReminderDaysBefore: { type: Number, default: 3, min: 1 }, // Nhắc trước 3 ngày
    type: {
        type: String,
        enum: ['session-based', 'time-based', 'unlimited'],
        default: 'session-based'
    },
}, { timestamps: true });
const ProductModel = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export default ProductModel;
