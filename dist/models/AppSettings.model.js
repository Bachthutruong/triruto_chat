// src/models/AppSettings.model.ts
import mongoose, { Schema, models } from 'mongoose';
const SpecificDayRuleSchema = new Schema({
    id: { type: String, required: false },
    date: { type: String, required: true },
    isOff: { type: Boolean, default: false },
    workingHours: [{ type: String }],
    numberOfStaff: { type: Number },
    serviceDurationMinutes: { type: Number },
}, { _id: true });
const AppSettingsSchema = new Schema({
    greetingMessage: { type: String, default: 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay?' },
    greetingMessageNewCustomer: { type: String, default: 'Chào mừng bạn lần đầu đến với chúng tôi! Bạn cần hỗ trợ gì ạ?' },
    greetingMessageReturningCustomer: { type: String, default: 'Chào mừng bạn quay trở lại! Rất vui được gặp lại bạn.' },
    suggestedQuestions: { type: [String], default: ['Các dịch vụ của bạn?', 'Đặt lịch hẹn', 'Địa chỉ của bạn ở đâu?'] },
    successfulBookingMessageTemplate: { type: String, default: "Lịch hẹn của bạn cho {{service}} vào lúc {{time}} ngày {{date}}{{#if branch}} tại {{branch}}{{/if}} đã được đặt thành công!" },
    brandName: { type: String, default: 'AetherChat' },
    logoUrl: { type: String },
    logoDataUri: { type: String },
    footerText: { type: String, default: `© ${new Date().getFullYear()} AetherChat. Đã đăng ký Bản quyền.` },
    metaTitle: { type: String, default: 'Triruto' },
    metaDescription: { type: String, default: 'Live chat tích hợp AI cho giao tiếp khách hàng liền mạch.' },
    metaKeywords: { type: [String], default: [] },
    openGraphImageUrl: { type: String },
    robotsTxtContent: { type: String, default: "User-agent: *\nAllow: /" },
    sitemapXmlContent: { type: String },
    numberOfStaff: { type: Number, default: 1, min: 0 },
    defaultServiceDurationMinutes: { type: Number, default: 60, min: 5 },
    workingHours: { type: [String], default: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"] },
    weeklyOffDays: { type: [Number], default: [] },
    oneTimeOffDates: { type: [String], default: [] },
    specificDayRules: { type: [SpecificDayRuleSchema], default: [] },
    outOfOfficeResponseEnabled: { type: Boolean, default: false },
    outOfOfficeMessage: { type: String, default: 'Cảm ơn bạn đã liên hệ! Hiện tại chúng tôi đang ngoài giờ làm việc. Vui lòng để lại lời nhắn và chúng tôi sẽ phản hồi sớm nhất có thể.' },
    officeHoursStart: { type: String, default: "09:00" },
    officeHoursEnd: { type: String, default: "17:00" },
    officeDays: { type: [Number], default: [1, 2, 3, 4, 5] }, // Mon-Fri
    // Appointment reminder settings
    appointmentReminderEnabled: { type: Boolean, default: true },
    appointmentReminderMessageTemplate: { type: String, default: "Nhắc nhở: Bạn có lịch hẹn {{service}} vào lúc {{time}} ngày {{date}}{{#if branch}} tại {{branch}}{{/if}}. Vui lòng đến đúng giờ!" },
    appointmentReminderTime: { type: String, default: "09:00" }, // Time of day to send reminders
    appointmentReminderDaysBefore: { type: Number, default: 1, min: 1 }, // Days before appointment to send reminder
}, { timestamps: true, versionKey: false });
// Ensure default for sitemapXmlContent if it's not set
AppSettingsSchema.pre('save', function (next) {
    if (!this.sitemapXmlContent) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002';
        this.sitemapXmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n  </url>\n</urlset>`;
    }
    next();
});
const AppSettingsModel = models.AppSettings || mongoose.model('AppSettings', AppSettingsSchema);
export default AppSettingsModel;
