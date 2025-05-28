import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICustomerProduct extends Document {
    customerId: mongoose.Types.ObjectId;
    productId: mongoose.Types.ObjectId;
    productName: string; // Lưu tên sản phẩm để dễ truy vấn
    totalSessions: number; // Tổng số buổi
    usedSessions: number; // Số buổi đã sử dụng
    remainingSessions: number; // Số buổi còn lại
    assignedDate: Date; // Ngày gán sản phẩm cho khách
    expiryDate?: Date; // Ngày hết hạn (tính từ assignedDate + thời hạn sử dụng)
    expiryDays?: number; // Số ngày có thể sử dụng
    isActive: boolean; // Còn hiệu lực hay không
    lastUsedDate?: Date; // Lần sử dụng cuối cùng
    staffId: mongoose.Types.ObjectId; // Nhân viên tạo hóa đơn
    notes?: string; // Ghi chú
    createdAt: Date;
    updatedAt: Date;
}

const CustomerProductSchema = new Schema<ICustomerProduct>(
    {
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
    },
    {
        timestamps: true
    }
);

// Middleware để tự động tính remainingSessions
CustomerProductSchema.pre('save', function (next) {
    if (this.isModified('totalSessions') || this.isModified('usedSessions')) {
        (this as any).remainingSessions = Math.max(0, (this as any).totalSessions - (this as any).usedSessions);
    }
    next();
});

// Index compound để tối ưu truy vấn
CustomerProductSchema.index({ customerId: 1, isActive: 1 });
CustomerProductSchema.index({ expiryDate: 1, isActive: 1 });

const CustomerProductModel: Model<ICustomerProduct> =
    mongoose.models.CustomerProduct as Model<ICustomerProduct> ||
    mongoose.model<ICustomerProduct>('CustomerProduct', CustomerProductSchema);

export default CustomerProductModel; 