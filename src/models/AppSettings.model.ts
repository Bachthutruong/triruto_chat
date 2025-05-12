// src/models/AppSettings.model.ts
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { AppSettings } from '@/lib/types';

export interface IAppSettings extends Document, Omit<AppSettings, 'id'> {
  // id is managed by MongoDB as _id
}

const AppSettingsSchema: Schema<IAppSettings> = new Schema({
  greetingMessage: { type: String, default: 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về dịch vụ hoặc đặt lịch hẹn.' }, // Customizable part
  suggestedQuestions: [{ type: String, default: ['Dịch vụ của bạn là gì?', 'Làm thế nào để đặt lịch hẹn?'] }],
  brandName: { type: String, default: 'AetherChat' },
  logoUrl: { type: String, default: '' },
  footerText: { type: String, default: `© ${new Date().getFullYear()} AetherChat. Đã đăng ký Bản quyền.` },
  metaTitle: { type: String, default: 'AetherChat - Live Chat Thông Minh' },
  metaDescription: { type: String, default: 'Live chat tích hợp AI cho giao tiếp khách hàng liền mạch.' },
  metaKeywords: [{type: String}],
  openGraphImageUrl: {type: String},
  robotsTxtContent: {type: String},
  sitemapXmlContent: {type: String}
}, { timestamps: true, versionKey: false }); // versionKey: false to disable __v field

const AppSettingsModel = models.AppSettings as Model<IAppSettings> || mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);

export default AppSettingsModel;
