import mongoose, { Schema } from 'mongoose';
const CustomerProductSchema = new Schema({
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productName: { type: String, required: true },
    totalSessions: { type: Number, required: true, min: 0 },
    usedSessions: { type: Number, default: 0, min: 0 },
    remainingSessions: { type: Number, required: true, min: 0 },
    assignedDate: { type: Date, required: true, default: Date.now },
    expiryDate: { type: Date, index: true },
    expiryDays: { type: Number, min: 1 },
    isActive: { type: Boolean, default: true, index: true },
    lastUsedDate: { type: Date, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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
const CustomerProductModel = mongoose.models.CustomerProduct ||
    mongoose.model('CustomerProduct', CustomerProductSchema);
export default CustomerProductModel;
