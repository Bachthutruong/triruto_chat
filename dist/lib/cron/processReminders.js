"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processReminders = processReminders;
const reminder_service_1 = require("../services/reminder.service");
const logger_1 = require("../utils/logger");
async function processReminders() {
    try {
        logger_1.logger.info('Starting reminder processing job');
        await reminder_service_1.ReminderService.processPendingReminders();
        logger_1.logger.info('Completed reminder processing job');
    }
    catch (error) {
        logger_1.logger.error('Error in reminder processing job:', error);
    }
}
