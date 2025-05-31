"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentReminderService = void 0;
const Appointment_model_1 = __importDefault(require("../../models/Appointment.model"));
const AppointmentReminder_model_1 = __importDefault(require("../../models/AppointmentReminder.model"));
const AppSettings_model_1 = __importDefault(require("../../models/AppSettings.model"));
const Message_model_1 = __importDefault(require("../../models/Message.model"));
const Conversation_model_1 = __importDefault(require("../../models/Conversation.model"));
const date_fns_1 = require("date-fns");
const utils_1 = require("../../lib/utils");
class AppointmentReminderService {
    /**
     * Schedule a reminder for an appointment
     */
    static async scheduleReminder(appointmentId) {
        const appointment = await Appointment_model_1.default.findById(appointmentId).lean();
        if (!appointment) {
            throw new Error('Appointment not found');
        }
        const settings = await AppSettings_model_1.default.findOne();
        if (!(settings === null || settings === void 0 ? void 0 : settings.appointmentReminderEnabled)) {
            return null;
        }
        // Calculate reminder time
        const appointmentDate = new Date(appointment.date);
        const reminderTime = (0, utils_1.parseTimeString)(settings.appointmentReminderTime);
        const reminderDate = new Date(appointmentDate);
        reminderDate.setDate(reminderDate.getDate() - settings.appointmentReminderDaysBefore);
        reminderDate.setHours(reminderTime.hours, reminderTime.minutes, 0, 0);
        // Create reminder record
        const reminder = await AppointmentReminder_model_1.default.create({
            appointmentId: appointment._id,
            customerId: appointment.customerId,
            scheduledFor: reminderDate,
            status: 'pending'
        });
        return reminder;
    }
    /**
     * Process pending reminders
     */
    static async processPendingReminders() {
        const now = new Date();
        const settings = await AppSettings_model_1.default.findOne();
        if (!(settings === null || settings === void 0 ? void 0 : settings.appointmentReminderEnabled)) {
            return;
        }
        // Find all pending reminders that are due
        const pendingReminders = await AppointmentReminder_model_1.default.find({
            status: 'pending',
            scheduledFor: { $lte: now }
        }).populate('appointmentId').lean();
        for (const reminder of pendingReminders) {
            try {
                const appointment = await Appointment_model_1.default.findById(reminder.appointmentId).lean();
                if (!appointment) {
                    throw new Error('Appointment not found');
                }
                // Format message template
                let message = settings.appointmentReminderMessageTemplate
                    .replace('{{service}}', appointment.service)
                    .replace('{{time}}', appointment.time)
                    .replace('{{date}}', (0, date_fns_1.format)(new Date(appointment.date), 'dd/MM/yyyy'))
                    .replace('{{branch}}', appointment.branch || '');
                // Find the latest conversation for this customer
                const latestConversation = await Conversation_model_1.default.findOne({
                    customerId: reminder.customerId
                }).sort({ updatedAt: -1 });
                if (!latestConversation) {
                    throw new Error('No conversation found for customer');
                }
                // Create system message
                const systemMessage = await Message_model_1.default.create({
                    conversationId: latestConversation._id,
                    content: message,
                    type: 'system',
                    sender: 'system',
                    timestamp: new Date(),
                    isRead: false
                });
                // Update conversation
                await Conversation_model_1.default.findByIdAndUpdate(latestConversation._id, {
                    $push: { messageIds: systemMessage._id },
                    lastMessageTimestamp: systemMessage.timestamp,
                    lastMessagePreview: systemMessage.content.substring(0, 100)
                });
                // Update reminder status
                await AppointmentReminder_model_1.default.findByIdAndUpdate(reminder._id, {
                    status: 'sent',
                    sentAt: new Date()
                });
            }
            catch (error) {
                await AppointmentReminder_model_1.default.findByIdAndUpdate(reminder._id, {
                    status: 'failed',
                    errorMessage: error.message
                });
            }
        }
    }
    /**
     * Cancel reminder for an appointment
     */
    static async cancelReminder(appointmentId) {
        await AppointmentReminder_model_1.default.updateMany({ appointmentId, status: 'pending' }, { status: 'failed', errorMessage: 'Appointment cancelled' });
    }
}
exports.AppointmentReminderService = AppointmentReminderService;
