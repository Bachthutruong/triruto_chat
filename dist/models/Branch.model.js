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
// src/models/Branch.model.ts
const mongoose_1 = __importStar(require("mongoose"));
// Subdocument schema for BranchSpecificDayRule
const BranchSpecificDayRuleSchema = new mongoose_1.Schema({
    date: { type: String, required: true }, // "YYYY-MM-DD"
    isOff: { type: Boolean },
    workingHours: [{ type: String }],
    numberOfStaff: { type: Number },
}, { _id: true });
const BranchSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    address: { type: String, trim: true },
    contactInfo: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    workingHours: [{ type: String }], // Branch specific working hours ["HH:MM", "HH:MM"]
    offDays: [{ type: Number, min: 0, max: 6 }], // Branch specific weekly off days [0-6]
    numberOfStaff: { type: Number, min: 0 }, // Branch specific staff count
    specificDayOverrides: [BranchSpecificDayRuleSchema],
}, { timestamps: true });
const BranchModel = mongoose_1.models.Branch || mongoose_1.default.model('Branch', BranchSchema);
exports.default = BranchModel;
