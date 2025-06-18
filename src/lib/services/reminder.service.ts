import { Types } from 'mongoose';
import ReminderModel from '@/models/Reminder.model';
import MessageModel from '@/models/Message.model';
import ConversationModel from '@/models/Conversation.model';
import { addDays, addWeeks, addMonths } from 'date-fns';

export class ReminderService {
    /**
     * Process pending reminders and send notifications
     */
    static async processPendingReminders() {
        const now = new Date();

        // Find all pending reminders that are due
        const pendingReminders = await ReminderModel.find({
            status: 'pending',
            $or: [
                { dueDate: { $lte: now } },
                { nextReminderDate: { $lte: now } }
            ]
        }).populate('customerId staffId');

        for (const reminder of pendingReminders) {
            try {
                // Find the latest conversation for this customer
                const latestConversation = await ConversationModel.findOne({
                    customerId: reminder.customerId
                }).sort({ updatedAt: -1 });

                if (!latestConversation) {
                    throw new Error('No conversation found for customer');
                }

                // Create system message for the reminder
                const systemMessage = await MessageModel.create({
                    conversationId: latestConversation._id,
                    content: `${reminder.title}\n${reminder.description}`,
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
                reminder.lastReminderSent = new Date();

                if (reminder.reminderType === 'recurring' && reminder.interval) {
                    // Calculate next reminder date
                    let nextDate: Date;
                    switch (reminder.interval.type) {
                        case 'days':
                            nextDate = addDays(now, reminder.interval.value);
                            break;
                        case 'weeks':
                            nextDate = addWeeks(now, reminder.interval.value);
                            break;
                        case 'months':
                            nextDate = addMonths(now, reminder.interval.value);
                            break;
                        default:
                            nextDate = addDays(now, 1);
                    }
                    reminder.nextReminderDate = nextDate;
                } else {
                    // For one-time reminders, mark as completed
                    reminder.status = 'completed';
                    reminder.completedAt = new Date();
                }

                await reminder.save();
            } catch (error: any) {
                console.error(`Error processing reminder ${reminder._id}:`, error);
                // Don't mark as failed, let it retry next time
            }
        }
    }

    /**
     * Create a new reminder
     */
    static async createReminder(data: {
        customerId: Types.ObjectId;
        staffId: Types.ObjectId;
        title: string;
        description: string;
        dueDate: Date;
        priority?: 'low' | 'medium' | 'high';
        reminderType?: 'one_time' | 'recurring';
        interval?: {
            type: 'days' | 'weeks' | 'months';
            value: number;
        };
    }) {
        const reminder = new ReminderModel({
            ...data,
            status: 'pending',
            priority: data.priority || 'medium',
            reminderType: data.reminderType || 'one_time'
        });

        if (data.reminderType === 'recurring' && data.interval) {
            reminder.nextReminderDate = data.dueDate;
        }

        return await reminder.save();
    }

    /**
     * Get upcoming reminders for a customer
     */
    static async getUpcomingRemindersForCustomer(customerId: Types.ObjectId) {
        const now = new Date();
        return await ReminderModel.find({
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
    static async getOverdueRemindersForCustomer(customerId: Types.ObjectId) {
        const now = new Date();
        return await ReminderModel.find({
            customerId,
            status: 'pending',
            $or: [
                { dueDate: { $lt: now } },
                { nextReminderDate: { $lt: now } }
            ]
        }).sort({ dueDate: 1 });
    }
} 