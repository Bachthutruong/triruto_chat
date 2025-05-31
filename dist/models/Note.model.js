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
// src/models/Note.model.ts
const mongoose_1 = __importStar(require("mongoose"));
const NoteSchema = new mongoose_1.Schema({
    //@ts-ignore
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    //@ts-ignore
    staffId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // User who created/last edited
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
const NoteModel = mongoose_1.models.Note || mongoose_1.default.model('Note', NoteSchema);
exports.default = NoteModel;
