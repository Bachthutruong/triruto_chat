// src/models/AppSettings.model.ts
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { AppSettings, SpecificDayRule } from '@/lib/types'; // Import SpecificDayRule

// Subdocument schema for SpecificDayRule
const SpecificDayRuleSchema: Schema<SpecificDayRule> = new Schema({
  date: { type: String, required: true }, // "YYYY-MM-DD"
  isOff: { type: Boolean },
  workingHours: [{ type: String }], // Array of "HH:MM"
  numberOfStaff: { type: Number },
  serviceDurationMinutes: { type: Number },
}, { _id: true }); // Mongoose will add _id automatically, which we can map to 'id'

export interface IAppSettings extends Document, Omit<AppSettings, 'id' | 'specificDayRules'> {
  // id is managed by MongoDB as _id
  specificDayRules?: mongoose.Types.DocumentArray<SpecificDayRule>; // Use Mongoose's DocumentArray for subdocuments
}

const AppSettingsSchema: Schema<IAppSettings> = new Schema({
  greetingMessage: { type: String, default: 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về dịch vụ hoặc đặt lịch hẹn.' },
  suggestedQuestions: [{ type: String, default: ['Dịch vụ của bạn là gì?', 'Làm thế nào để đặt lịch hẹn?'] }],
  brandName: { type: String, default: 'AetherChat' },
  logoUrl: { type: String, default: '' },
  footerText: { type: String, default: `© ${new Date().getFullYear()} AetherChat. Đã đăng ký Bản quyền.` },
  metaTitle: { type: String, default: 'AetherChat - Live Chat Thông Minh' },
  metaDescription: { type: String, default: 'Live chat tích hợp AI cho giao tiếp khách hàng liền mạch.' },
  metaKeywords: [{type: String}],
  openGraphImageUrl: {type: String},
  robotsTxtContent: {type: String},
  sitemapXmlContent: {type: String},

  // Scheduling Rules
  numberOfStaff: { type: Number, default: 1, min: 0 },
  defaultServiceDurationMinutes: { type: Number, default: 60, min: 5 },
  workingHours: [{ type: String, default: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"] }], // Example: "HH:MM"
  weeklyOffDays: [{ type: Number, min: 0, max: 6 }], // 0 for Sunday, 6 for Saturday
  oneTimeOffDates: [{ type: String }], // "YYYY-MM-DD"
  specificDayRules: [SpecificDayRuleSchema],

}, { timestamps: true, versionKey: false });

const AppSettingsModel = models.AppSettings as Model<IAppSettings> || mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);

export default AppSettingsModel;
