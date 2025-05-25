import { ReminderService } from '../services/reminder.service';
import { logger } from '../utils/logger';

export async function processReminders() {
    try {
        logger.info('Starting reminder processing job');
        await ReminderService.processPendingReminders();
        logger.info('Completed reminder processing job');
    } catch (error) {
        logger.error('Error in reminder processing job:', error);
    }
} 