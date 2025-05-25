import AppointmentModel from '@/models/Appointment.model';
import AppointmentReminderModel from '@/models/AppointmentReminder.model';
import AppSettingsModel from '@/models/AppSettings.model';
import MessageModel from '@/models/Message.model';
import ConversationModel from '@/models/Conversation.model';
import { format } from 'date-fns';
import { parseTimeString } from '@/lib/utils';
export class AppointmentReminderService {
    /**
     * Schedule a reminder for an appointment
     */
    static async scheduleReminder(appointmentId) {
        const appointment = await AppointmentModel.findById(appointmentId).lean();
        if (!appointment) {
            throw new Error('Appointment not found');
        }
        const settings = await AppSettingsModel.findOne();
        if (!(settings === null || settings === void 0 ? void 0 : settings.appointmentReminderEnabled)) {
            return null;
        }
        // Calculate reminder time
        const appointmentDate = new Date(appointment.date);
        const reminderTime = parseTimeString(settings.appointmentReminderTime);
        const reminderDate = new Date(appointmentDate);
        reminderDate.setDate(reminderDate.getDate() - settings.appointmentReminderDaysBefore);
        reminderDate.setHours(reminderTime.hours, reminderTime.minutes, 0, 0);
        // Create reminder record
        const reminder = await AppointmentReminderModel.create({
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
        const settings = await AppSettingsModel.findOne();
        if (!(settings === null || settings === void 0 ? void 0 : settings.appointmentReminderEnabled)) {
            return;
        }
        // Find all pending reminders that are due
        const pendingReminders = await AppointmentReminderModel.find({
            status: 'pending',
            scheduledFor: { $lte: now }
        }).populate('appointmentId').lean();
        for (const reminder of pendingReminders) {
            try {
                const appointment = await AppointmentModel.findById(reminder.appointmentId).lean();
                if (!appointment) {
                    throw new Error('Appointment not found');
                }
                // Format message template
                let message = settings.appointmentReminderMessageTemplate
                    .replace('{{service}}', appointment.service)
                    .replace('{{time}}', appointment.time)
                    .replace('{{date}}', format(new Date(appointment.date), 'dd/MM/yyyy'))
                    .replace('{{branch}}', appointment.branch || '');
                // Find the latest conversation for this customer
                const latestConversation = await ConversationModel.findOne({
                    customerId: reminder.customerId
                }).sort({ updatedAt: -1 });
                if (!latestConversation) {
                    throw new Error('No conversation found for customer');
                }
                // Create system message
                const systemMessage = await MessageModel.create({
                    conversationId: latestConversation._id,
                    content: message,
                    type: 'system',
                    sender: 'system',
                    timestamp: new Date(),
                    isRead: false
                });
                // Update conversation
                await ConversationModel.findByIdAndUpdate(latestConversation._id, {
                    $push: { messageIds: systemMessage._id },
                    lastMessageTimestamp: systemMessage.timestamp,
                    lastMessagePreview: systemMessage.content.substring(0, 100)
                });
                // Update reminder status
                await AppointmentReminderModel.findByIdAndUpdate(reminder._id, {
                    status: 'sent',
                    sentAt: new Date()
                });
            }
            catch (error) {
                await AppointmentReminderModel.findByIdAndUpdate(reminder._id, {
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
        await AppointmentReminderModel.updateMany({ appointmentId, status: 'pending' }, { status: 'failed', errorMessage: 'Appointment cancelled' });
    }
}
