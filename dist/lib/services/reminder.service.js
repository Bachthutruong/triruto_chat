"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderService = void 0;
const Reminder_model_1 = __importDefault(require("../../models/Reminder.model"));
const Message_model_1 = __importDefault(require("../../models/Message.model"));
const Conversation_model_1 = __importDefault(require("../../models/Conversation.model"));
const date_fns_1 = require("date-fns");
class ReminderService {
    /**
     * Process pending reminders and send notifications
     */
    static async processPendingReminders() {
        const now = new Date();
        // Find all pending reminders that are due
        const pendingReminders = await Reminder_model_1.default.find({
            status: 'pending',
            $or: [
                { dueDate: { $lte: now } },
                { nextReminderDate: { $lte: now } }
            ]
        }).populate('customerId staffId');
        for (const reminder of pendingReminders) {
            try {
                // Find the latest conversation for this customer
                const latestConversation = await Conversation_model_1.default.findOne({
                    customerId: reminder.customerId
                }).sort({ updatedAt: -1 });
                if (!latestConversation) {
                    throw new Error('No conversation found for customer');
                }
                // Create system message for the reminder
                const systemMessage = await Message_model_1.default.create({
                    conversationId: latestConversation._id,
                    content: `${reminder.title}\n${reminder.description}`,
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
                reminder.lastReminderSent = new Date();
                if (reminder.reminderType === 'recurring' && reminder.interval) {
                    // Calculate next reminder date
                    let nextDate;
                    switch (reminder.interval.type) {
                        case 'days':
                            nextDate = (0, date_fns_1.addDays)(now, reminder.interval.value);
                            break;
                        case 'weeks':
                            nextDate = (0, date_fns_1.addWeeks)(now, reminder.interval.value);
                            break;
                        case 'months':
                            nextDate = (0, date_fns_1.addMonths)(now, reminder.interval.value);
                            break;
                        default:
                            nextDate = (0, date_fns_1.addDays)(now, 1);
                    }
                    reminder.nextReminderDate = nextDate;
                }
                else {
                    // For one-time reminders, mark as completed
                    reminder.status = 'completed';
                    reminder.completedAt = new Date();
                }
                await reminder.save();
            }
            catch (error) {
                console.error(`Error processing reminder ${reminder._id}:`, error);
                // Don't mark as failed, let it retry next time
            }
        }
    }
    /**
     * Create a new reminder
     */
    static async createReminder(data) {
        const reminder = new Reminder_model_1.default(Object.assign(Object.assign({}, data), { status: 'pending', priority: data.priority || 'medium', reminderType: data.reminderType || 'one_time' }));
        if (data.reminderType === 'recurring' && data.interval) {
            reminder.nextReminderDate = data.dueDate;
        }
        return await reminder.save();
    }
    /**
     * Get upcoming reminders for a customer
     */
    static async getUpcomingRemindersForCustomer(customerId) {
        const now = new Date();
        return await Reminder_model_1.default.find({
            customerId,
            status: 'pending',
            $or: [
                { dueDate: { $gte: now } },
                { nextReminderDate: { $gte: now } }
            ]
        }).sort({ dueDate: 1 });
    }
    /**
     * Get overdue reminders for a customer
     */
    static async getOverdueRemindersForCustomer(customerId) {
        const now = new Date();
        return await Reminder_model_1.default.find({
            customerId,
            status: 'pending',
            $or: [
                { dueDate: { $lt: now } },
                { nextReminderDate: { $lt: now } }
            ]
        }).sort({ dueDate: 1 });
    }
}
exports.ReminderService = ReminderService;
