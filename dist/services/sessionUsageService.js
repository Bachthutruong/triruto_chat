"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEndOfDaySessionUsage = processEndOfDaySessionUsage;
exports.sendExpiryReminders = sendExpiryReminders;
exports.calculateDaysSinceLastAppointment = calculateDaysSinceLastAppointment;
const mongodb_1 = __importDefault(require("../lib/mongodb"));
const Appointment_model_1 = __importDefault(require("../models/Appointment.model"));
const CustomerProduct_model_1 = __importDefault(require("../models/CustomerProduct.model"));
const Message_model_1 = __importDefault(require("../models/Message.model"));
const Conversation_model_1 = __importDefault(require("../models/Conversation.model"));
// Tự động đánh dấu các buổi đã sử dụng (chạy cuối ngày)
async function processEndOfDaySessionUsage() {
    try {
        await (0, mongodb_1.default)();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        // Lấy tất cả lịch hẹn hôm nay chưa bị hủy và chưa được đánh dấu sử dụng
        const appointments = await Appointment_model_1.default.find({
            date: today,
            status: { $ne: 'cancelled' },
            isSessionUsed: { $ne: true }
        });
        console.log(`Processing ${appointments.length} appointments for session usage`);
        for (const appointment of appointments) {
            try {
                // Đánh dấu buổi đã sử dụng
                appointment.isSessionUsed = true;
                appointment.sessionUsedAt = new Date();
                await appointment.save();
                // Nếu có liên kết với CustomerProduct, cập nhật số buổi đã sử dụng
                if (appointment.customerProductId && !appointment.isStandaloneSession) {
                    const customerProduct = await CustomerProduct_model_1.default.findById(appointment.customerProductId);
                    if (customerProduct) {
                        customerProduct.usedSessions += 1;
                        customerProduct.lastUsedDate = new Date();
                        await customerProduct.save();
                        console.log(`Updated session usage for customer product ${customerProduct._id}`);
                    }
                }
            }
            catch (error) {
                console.error(`Error processing appointment ${appointment._id}:`, error);
            }
        }
        console.log('End of day session usage processing completed');
    }
    catch (error) {
        console.error('Error in processEndOfDaySessionUsage:', error);
    }
}
// Gửi tin nhắn nhắc nhở hết hạn
async function sendExpiryReminders() {
    var _a;
    try {
        await (0, mongodb_1.default)();
        const now = new Date();
        // Lấy tất cả sản phẩm sắp hết hạn
        const expiringProducts = await CustomerProduct_model_1.default
            .find({
            isActive: true,
            expiryDate: { $exists: true }
        })
            .populate('customerId', 'name phoneNumber conversationIds')
            .populate('productId', 'expiryReminderTemplate expiryReminderDaysBefore');
        for (const customerProduct of expiringProducts) {
            try {
                if (!customerProduct.expiryDate || !customerProduct.productId)
                    continue;
                const product = customerProduct.productId;
                const customer = customerProduct.customerId;
                const daysUntilExpiry = Math.ceil((customerProduct.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const reminderDaysBefore = product.expiryReminderDaysBefore || 3;
                // Kiểm tra xem có cần gửi nhắc nhở không
                if (daysUntilExpiry === reminderDaysBefore || daysUntilExpiry === 0) {
                    // Tạo tin nhắn từ template
                    let message = product.expiryReminderTemplate ||
                        'Xin chào {customerName}, gói dịch vụ {productName} của bạn sẽ hết hạn vào ngày {expiryDate}. Vui lòng liên hệ để gia hạn hoặc sử dụng hết số buổi còn lại.';
                    message = message
                        .replace('{customerName}', customer.name || 'Quý khách')
                        .replace('{productName}', customerProduct.productName)
                        .replace('{expiryDate}', customerProduct.expiryDate.toLocaleDateString('vi-VN'))
                        .replace('{remainingSessions}', customerProduct.remainingSessions.toString());
                    // Tìm conversation của khách hàng
                    let conversationId = (_a = customer.conversationIds) === null || _a === void 0 ? void 0 : _a[0];
                    if (!conversationId) {
                        // Tạo conversation mới nếu chưa có
                        const newConversation = new Conversation_model_1.default({
                            customerId: customer._id,
                            participants: [
                                {
                                    userId: customer._id.toString(),
                                    role: 'customer',
                                    name: customer.name,
                                    phoneNumber: customer.phoneNumber
                                }
                            ],
                            messageIds: []
                        });
                        await newConversation.save();
                        conversationId = newConversation._id;
                        // Cập nhật customer
                        customer.conversationIds.push(conversationId);
                        await customer.save();
                    }
                    // Tạo tin nhắn nhắc nhở
                    const reminderMessage = new Message_model_1.default({
                        sender: 'system',
                        content: message,
                        timestamp: new Date(),
                        conversationId: conversationId.toString(),
                        name: 'Hệ thống'
                    });
                    await reminderMessage.save();
                    // Cập nhật conversation
                    await Conversation_model_1.default.findByIdAndUpdate(conversationId, {
                        $push: { messageIds: reminderMessage._id },
                        lastMessageTimestamp: new Date(),
                        lastMessagePreview: message.substring(0, 100)
                    });
                    console.log(`Sent expiry reminder to customer ${customer.phoneNumber} for product ${customerProduct.productName}`);
                }
            }
            catch (error) {
                console.error(`Error sending reminder for customer product ${customerProduct._id}:`, error);
            }
        }
        console.log('Expiry reminders processing completed');
    }
    catch (error) {
        console.error('Error in sendExpiryReminders:', error);
    }
}
// Tính khoảng cách từ lần hẹn cuối cùng
async function calculateDaysSinceLastAppointment(customerId) {
    try {
        await (0, mongodb_1.default)();
        const lastAppointment = await Appointment_model_1.default
            .findOne({
            customerId,
            status: { $in: ['completed', 'booked'] },
            isSessionUsed: true
        })
            .sort({ sessionUsedAt: -1 });
        if (!lastAppointment || !lastAppointment.sessionUsedAt) {
            return null;
        }
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - lastAppointment.sessionUsedAt.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff;
    }
    catch (error) {
        console.error('Error calculating days since last appointment:', error);
        return null;
    }
}
