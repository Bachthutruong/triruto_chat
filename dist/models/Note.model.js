// src/models/Note.model.ts
import mongoose, { Schema, models } from 'mongoose';
const NoteSchema = new Schema({
    //@ts-ignore
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    //@ts-ignore
    staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // User who created/last edited
    //@ts-ignore
    content: { type: String, trim: true }, // Made content optional at schema level
    //@ts-ignore
    imageDataUri: { type: String },
    //@ts-ignore
    imageFileName: { type: String },
}, { timestamps: true }); // createdAt and updatedAt managed by Mongoose
// Custom validator to ensure either content or imageDataUri exists
NoteSchema.pre('validate', function (next) {
    var _a;
    if (!((_a = this.content) === null || _a === void 0 ? void 0 : _a.trim()) && !this.imageDataUri) {
        next(new Error('Ghi chú phải có nội dung văn bản hoặc hình ảnh.'));
    }
    else {
        next();
    }
});
const NoteModel = models.Note || mongoose.model('Note', NoteSchema);
export default NoteModel;
