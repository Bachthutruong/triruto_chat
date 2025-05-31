// src/app/actions.ts
'use server';
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppSettings = getAppSettings;
exports.updateAppSettings = updateAppSettings;
exports.createNewConversationForUser = createNewConversationForUser;
exports.handleCustomerAccess = handleCustomerAccess;
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.getConversationHistory = getConversationHistory;
exports.getUserConversations = getUserConversations;
exports.processUserMessage = processUserMessage;
exports.handleBookAppointmentFromForm = handleBookAppointmentFromForm;
exports.getCustomersForStaffView = getCustomersForStaffView;
exports.markCustomerInteractionAsReadByStaff = markCustomerInteractionAsReadByStaff;
exports.getCustomerDetails = getCustomerDetails;
exports.getAllUsers = getAllUsers;
exports.getStaffList = getStaffList;
exports.createStaffOrAdminUser = createStaffOrAdminUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.assignStaffToCustomer = assignStaffToCustomer;
exports.unassignStaffFromCustomer = unassignStaffFromCustomer;
exports.addTagToCustomer = addTagToCustomer;
exports.removeTagFromCustomer = removeTagFromCustomer;
exports.sendStaffMessage = sendStaffMessage;
exports.editStaffMessage = editStaffMessage;
exports.deleteStaffMessage = deleteStaffMessage;
exports.getKeywordMappings = getKeywordMappings;
exports.createKeywordMapping = createKeywordMapping;
exports.updateKeywordMapping = updateKeywordMapping;
exports.deleteKeywordMapping = deleteKeywordMapping;
exports.getTrainingDataItems = getTrainingDataItems;
exports.createTrainingData = createTrainingData;
exports.updateTrainingDataItem = updateTrainingDataItem;
exports.deleteTrainingDataItem = deleteTrainingDataItem;
exports.getAppointmentRules = getAppointmentRules;
exports.createAppointmentRule = createAppointmentRule;
exports.updateAppointmentRule = updateAppointmentRule;
exports.deleteAppointmentRule = deleteAppointmentRule;
exports.updateCustomerInternalName = updateCustomerInternalName;
exports.getAppointments = getAppointments;
exports.deleteExistingAppointment = deleteExistingAppointment;
exports.createNewAppointment = createNewAppointment;
exports.updateExistingAppointment = updateExistingAppointment;
exports.getCustomerListForSelect = getCustomerListForSelect;
exports.getAdminDashboardStats = getAdminDashboardStats;
exports.getStaffDashboardStats = getStaffDashboardStats;
exports.addNoteToCustomer = addNoteToCustomer;
exports.getNotesForCustomer = getNotesForCustomer;
exports.updateCustomerNote = updateCustomerNote;
exports.deleteCustomerNote = deleteCustomerNote;
exports.getAllProducts = getAllProducts;
exports.getProductById = getProductById;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.getAllReminders = getAllReminders;
exports.getReminderById = getReminderById;
exports.createReminder = createReminder;
exports.updateReminder = updateReminder;
exports.deleteReminder = deleteReminder;
exports.getUpcomingRemindersForStaff = getUpcomingRemindersForStaff;
exports.getOverdueRemindersForStaff = getOverdueRemindersForStaff;
exports.getCustomersWithProductsAndReminders = getCustomersWithProductsAndReminders;
exports.getAllCustomerTags = getAllCustomerTags;
exports.pinMessageToConversation = pinMessageToConversation;
exports.unpinMessageFromConversation = unpinMessageFromConversation;
exports.getMessagesByIds = getMessagesByIds;
exports.getCustomerMediaMessages = getCustomerMediaMessages;
exports.updateConversationTitle = updateConversationTitle;
exports.pinConversationForUser = pinConversationForUser;
exports.unpinConversationForUser = unpinConversationForUser;
exports.createBranch = createBranch;
exports.getBranches = getBranches;
exports.updateBranch = updateBranch;
exports.deleteBranch = deleteBranch;
exports.getQuickReplies = getQuickReplies;
exports.createQuickReply = createQuickReply;
exports.updateQuickReply = updateQuickReply;
exports.deleteQuickReply = deleteQuickReply;
exports.createSystemMessage = createSystemMessage;
exports.cancelAppointment = cancelAppointment;
exports.getPinnedMessagesForConversation = getPinnedMessagesForConversation;
const answer_user_question_1 = require("../ai/flows/answer-user-question");
const schedule_appointment_1 = require("../ai/flows/schedule-appointment");
const mongoose_1 = __importStar(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const date_fns_1 = require("date-fns");
const validator_1 = require("../lib/validator");
const appointmentReminder_service_1 = require("../lib/services/appointmentReminder.service");
// Ensure dotenv is configured correctly
if (process.env.NODE_ENV !== 'production') {
    dotenv_1.default.config({ path: process.cwd() + '/.env' });
}
else {
    dotenv_1.default.config();
}
if (!process.env.MONGODB_URI) {
    if (process.env.VERCEL_ENV) {
        console.warn("MONGODB_URI not found at build time (Vercel). Will be checked at runtime.");
    }
    else {
        console.warn("WARNING: MONGODB_URI is not defined in .env. App may not function correctly at runtime.");
    }
}
const mongodb_1 = __importDefault(require("../lib/mongodb"));
const User_model_1 = __importDefault(require("../models/User.model"));
const Customer_model_1 = __importDefault(require("../models/Customer.model"));
const Message_model_1 = __importDefault(require("../models/Message.model"));
const Appointment_model_1 = __importDefault(require("../models/Appointment.model"));
const AppSettings_model_1 = __importDefault(require("../models/AppSettings.model"));
const KeywordMapping_model_1 = __importDefault(require("../models/KeywordMapping.model"));
const TrainingData_model_1 = __importDefault(require("../models/TrainingData.model"));
const AppointmentRule_model_1 = __importDefault(require("../models/AppointmentRule.model"));
const Note_model_1 = __importDefault(require("../models/Note.model"));
const Product_model_1 = __importDefault(require("../models/Product.model"));
const Reminder_model_1 = __importDefault(require("../models/Reminder.model"));
const Conversation_model_1 = __importDefault(require("../models/Conversation.model"));
const Branch_model_1 = __importDefault(require("../models/Branch.model"));
const QuickReply_model_1 = __importDefault(require("../models/QuickReply.model"));
const locale_1 = require("date-fns/locale");
// interface IMessageWithConversation extends IMessage {
//   conversationId?: Types.ObjectId;
// }
function transformConversationDoc(doc) {
    if (!doc)
        return null;
    return {
        id: doc._id.toString(),
        customerId: doc.customerId.toString(),
        //@ts-ignore
        staffId: doc.staffId ? doc.staffId.toString() : undefined,
        //@ts-ignore
        title: doc.title,
        //@ts-ignore
        participants: (doc.participants || []).map((p) => {
            var _a;
            return ({
                userId: (_a = p.userId) === null || _a === void 0 ? void 0 : _a.toString(),
                role: p.role,
                name: p.name,
                phoneNumber: p.phoneNumber,
            });
        }).filter((p) => p.userId), // Filter out participants without userId (shouldn't happen if schema is correct)
        messageIds: (doc.messageIds || []).map(id => id.toString()),
        pinnedMessageIds: (doc.pinnedMessageIds || []).map((p) => {
            // p may be an ObjectId, a string, or a populated document
            if (typeof p === 'string')
                return p;
            if (p && typeof p === 'object' && p._id)
                return p._id.toString();
            return p.toString();
        }),
        //@ts-ignore
        isPinned: doc.isPinned,
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
        lastMessageTimestamp: doc.lastMessageTimestamp ? new Date(doc.lastMessageTimestamp) : undefined,
        lastMessagePreview: doc.lastMessagePreview,
    };
}
function formatChatHistoryForAI(messages) {
    var _a;
    const dataUriRegex = /^(data:[^;]+;base64,[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;
    const processedMessages = [];
    const seenQuestions = new Set();
    for (const msg of messages) {
        let displayContent = msg.content;
        const match = msg.content.match(dataUriRegex);
        if (match) {
            const textAfterFile = (_a = match[3]) === null || _a === void 0 ? void 0 : _a.trim();
            displayContent = `[Tệp đính kèm] ${textAfterFile || ''}`.trim();
        }
        if (msg.sender === 'ai' || msg.sender === 'system') {
            const isAskingAboutService = /bạn muốn đặt dịch vụ gì|dịch vụ nào|dịch vụ gì|muốn đặt gì/i.test(displayContent);
            const isAskingAboutDateTime = /ngày nào|giờ nào|thời gian nào|lúc mấy giờ|khi nào/i.test(displayContent);
            const questionKey = isAskingAboutService ? 'service' :
                isAskingAboutDateTime ? 'datetime' : '';
            if (questionKey && seenQuestions.has(questionKey)) {
                continue; // Skip if this type of question was already asked by AI recently
            }
            if (questionKey) {
                seenQuestions.add(questionKey); // Mark this type of question as asked
            }
        }
        processedMessages.push(`${msg.sender === 'user' ? 'Khách' : 'AI/Nhân viên'}: ${displayContent}`);
    }
    return processedMessages.join('\n');
}
function transformCustomerToSession(customerDoc, conversationId) {
    return {
        id: customerDoc._id.toString(),
        phoneNumber: customerDoc.phoneNumber,
        role: 'customer',
        name: customerDoc.name || `Người dùng ${customerDoc.phoneNumber}`,
        currentConversationId: conversationId,
        pinnedConversationIds: (customerDoc.pinnedConversationIds || []).map(id => id.toString()),
    };
}
function transformUserToSession(userDoc) {
    return {
        id: userDoc._id.toString(),
        phoneNumber: userDoc.phoneNumber,
        role: userDoc.role,
        name: userDoc.name || `${userDoc.role.charAt(0).toUpperCase() + userDoc.role.slice(1)} User`,
    };
}
function transformMessageDocToMessage(msgDoc) {
    var _a, _b;
    return {
        id: msgDoc._id.toString(),
        sender: msgDoc.sender,
        content: msgDoc.content,
        timestamp: new Date(msgDoc.timestamp),
        //@ts-ignore
        name: msgDoc.name,
        userId: (_a = msgDoc.userId) === null || _a === void 0 ? void 0 : _a.toString(),
        updatedAt: msgDoc.updatedAt ? new Date(msgDoc.updatedAt) : undefined,
        conversationId: (_b = msgDoc.conversationId) === null || _b === void 0 ? void 0 : _b.toString(),
    };
}
function transformAppointmentDocToDetails(apptDoc) {
    var _a, _b, _c, _d;
    const customerIdObj = apptDoc.customerId && typeof apptDoc.customerId === 'object' ? apptDoc.customerId : null;
    const staffIdObj = apptDoc.staffId && typeof apptDoc.staffId === 'object' ? apptDoc.staffId : null;
    return {
        appointmentId: apptDoc._id.toString(),
        userId: typeof apptDoc.customerId === 'string' ? apptDoc.customerId : (_a = customerIdObj === null || customerIdObj === void 0 ? void 0 : customerIdObj._id) === null || _a === void 0 ? void 0 : _a.toString(),
        service: apptDoc.service,
        productId: (_b = apptDoc.productId) === null || _b === void 0 ? void 0 : _b.toString(),
        time: apptDoc.time,
        date: apptDoc.date,
        branch: apptDoc.branch,
        branchId: (_c = apptDoc.branchId) === null || _c === void 0 ? void 0 : _c.toString(),
        status: apptDoc.status,
        notes: apptDoc.notes,
        createdAt: new Date(apptDoc.createdAt),
        updatedAt: new Date(apptDoc.updatedAt),
        staffId: typeof apptDoc.staffId === 'string' ? apptDoc.staffId : (_d = staffIdObj === null || staffIdObj === void 0 ? void 0 : staffIdObj._id) === null || _d === void 0 ? void 0 : _d.toString(),
        customerName: customerIdObj === null || customerIdObj === void 0 ? void 0 : customerIdObj.name,
        customerPhoneNumber: customerIdObj === null || customerIdObj === void 0 ? void 0 : customerIdObj.phoneNumber,
        staffName: staffIdObj === null || staffIdObj === void 0 ? void 0 : staffIdObj.name,
        packageType: apptDoc.packageType,
        priority: apptDoc.priority,
        recurrenceType: apptDoc.recurrenceType,
        recurrenceCount: apptDoc.recurrenceCount,
    };
}
function transformKeywordMappingDoc(doc) {
    return {
        id: doc._id.toString(),
        keywords: doc.keywords,
        response: doc.response,
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
    };
}
function transformTrainingDataDoc(doc) {
    return {
        id: doc._id.toString(),
        userInput: doc.userInput,
        idealResponse: doc.idealResponse,
        label: doc.label,
        status: doc.status,
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
    };
}
function transformAppointmentRuleDoc(doc) {
    return {
        id: doc._id.toString(),
        name: doc.name,
        keywords: doc.keywords,
        conditions: doc.conditions,
        aiPromptInstructions: doc.aiPromptInstructions,
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
    };
}
function transformNoteDocToNote(noteDoc) {
    var _a;
    return {
        id: noteDoc._id.toString(),
        customerId: noteDoc.customerId.toString(),
        staffId: noteDoc.staffId.toString(),
        staffName: (_a = noteDoc.staffId) === null || _a === void 0 ? void 0 : _a.name,
        content: noteDoc.content,
        imageDataUri: noteDoc.imageDataUri,
        imageFileName: noteDoc.imageFileName,
        createdAt: new Date(noteDoc.createdAt),
        updatedAt: new Date(noteDoc.updatedAt),
    };
}
function transformAppSettingsDoc(doc) {
    var _a, _b, _c;
    if (!doc)
        return null;
    const defaultBrandName = 'LiveChat';
    //@ts-ignore
    const initialDefaultSettings = {
        id: '',
        brandName: defaultBrandName,
        greetingMessage: 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay?',
        greetingMessageNewCustomer: 'Chào mừng bạn lần đầu đến với chúng tôi! Bạn cần hỗ trợ gì ạ?',
        greetingMessageReturningCustomer: 'Chào mừng bạn quay trở lại! Rất vui được gặp lại bạn.',
        suggestedQuestions: ['Các dịch vụ của bạn?', 'Đặt lịch hẹn', 'Địa chỉ của bạn ở đâu?'],
        successfulBookingMessageTemplate: "Lịch hẹn của bạn cho {{service}} vào lúc {{time}} ngày {{date}}{{#if branch}} tại {{branch}}{{/if}} đã được đặt thành công!",
        footerText: `© ${new Date().getFullYear()} ${defaultBrandName}. Đã đăng ký Bản quyền.`,
        metaTitle: `${defaultBrandName} - Live Chat Thông Minh`,
        metaDescription: 'Live chat tích hợp AI cho giao tiếp khách hàng liền mạch.',
        metaKeywords: [],
        numberOfStaff: 1,
        defaultServiceDurationMinutes: 60,
        workingHours: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
        weeklyOffDays: [],
        oneTimeOffDates: [],
        specificDayRules: [],
        outOfOfficeResponseEnabled: false,
        outOfOfficeMessage: 'Cảm ơn bạn đã liên hệ! Hiện tại chúng tôi đang ngoài giờ làm việc. Vui lòng để lại lời nhắn và chúng tôi sẽ phản hồi sớm nhất có thể.',
        officeHoursStart: "09:00",
        officeHoursEnd: "17:00",
        officeDays: [1, 2, 3, 4, 5], // Mon-Fri by default
    };
    const specificDayRulesPlain = (doc.specificDayRules || []).map(rule => {
        const plainRule = {
            id: rule._id ? rule._id.toString() : rule.id || new mongoose_1.default.Types.ObjectId().toString(),
            date: rule.date,
            isOff: rule.isOff || false,
            workingHours: rule.workingHours || [],
            numberOfStaff: rule.numberOfStaff,
            serviceDurationMinutes: rule.serviceDurationMinutes,
        };
        return plainRule;
    });
    //@ts-ignore
    return {
        id: doc._id.toString(),
        greetingMessage: doc.greetingMessage || initialDefaultSettings.greetingMessage,
        greetingMessageNewCustomer: doc.greetingMessageNewCustomer || initialDefaultSettings.greetingMessageNewCustomer,
        greetingMessageReturningCustomer: doc.greetingMessageReturningCustomer || initialDefaultSettings.greetingMessageReturningCustomer,
        suggestedQuestions: doc.suggestedQuestions && doc.suggestedQuestions.length > 0 ? doc.suggestedQuestions : initialDefaultSettings.suggestedQuestions,
        successfulBookingMessageTemplate: doc.successfulBookingMessageTemplate || initialDefaultSettings.successfulBookingMessageTemplate,
        brandName: doc.brandName || initialDefaultSettings.brandName,
        logoUrl: doc.logoUrl,
        logoDataUri: doc.logoDataUri,
        footerText: doc.footerText || initialDefaultSettings.footerText,
        metaTitle: doc.metaTitle || initialDefaultSettings.metaTitle,
        metaDescription: doc.metaDescription || initialDefaultSettings.metaDescription,
        metaKeywords: doc.metaKeywords && doc.metaKeywords.length > 0 ? doc.metaKeywords : initialDefaultSettings.metaKeywords,
        openGraphImageUrl: doc.openGraphImageUrl,
        robotsTxtContent: doc.robotsTxtContent,
        sitemapXmlContent: doc.sitemapXmlContent,
        numberOfStaff: (_a = doc.numberOfStaff) !== null && _a !== void 0 ? _a : initialDefaultSettings.numberOfStaff,
        defaultServiceDurationMinutes: (_b = doc.defaultServiceDurationMinutes) !== null && _b !== void 0 ? _b : initialDefaultSettings.defaultServiceDurationMinutes,
        workingHours: doc.workingHours && doc.workingHours.length > 0 ? doc.workingHours : initialDefaultSettings.workingHours,
        weeklyOffDays: doc.weeklyOffDays || initialDefaultSettings.weeklyOffDays || [],
        oneTimeOffDates: doc.oneTimeOffDates || initialDefaultSettings.oneTimeOffDates || [],
        specificDayRules: specificDayRulesPlain,
        outOfOfficeResponseEnabled: (_c = doc.outOfOfficeResponseEnabled) !== null && _c !== void 0 ? _c : initialDefaultSettings.outOfOfficeResponseEnabled,
        outOfOfficeMessage: doc.outOfOfficeMessage || initialDefaultSettings.outOfOfficeMessage,
        officeHoursStart: doc.officeHoursStart || initialDefaultSettings.officeHoursStart,
        officeHoursEnd: doc.officeHoursEnd || initialDefaultSettings.officeHoursEnd,
        officeDays: doc.officeDays && doc.officeDays.length > 0 ? doc.officeDays : initialDefaultSettings.officeDays,
        updatedAt: new Date(doc.updatedAt),
    };
}
async function getAppSettings() {
    await (0, mongodb_1.default)();
    let settingsDoc = await AppSettings_model_1.default.findOne({});
    // If no settings exist, create default settings
    if (!settingsDoc) {
        console.log("No app settings found, creating default settings...");
        settingsDoc = await new AppSettings_model_1.default({}).save();
        console.log("Default app settings created.");
    }
    return transformAppSettingsDoc(settingsDoc);
}
async function updateAppSettings(settings) {
    await (0, mongodb_1.default)();
    const processedSettings = Object.assign({}, settings);
    if (processedSettings.specificDayRules) {
        processedSettings.specificDayRules = processedSettings.specificDayRules.map(rule => {
            const { id } = rule, restOfRule = __rest(rule, ["id"]); // Remove client-side id before saving
            return restOfRule;
        });
    }
    // Ensure arrays are saved correctly, even if empty
    processedSettings.suggestedQuestions = Array.isArray(processedSettings.suggestedQuestions) ? processedSettings.suggestedQuestions : [];
    processedSettings.metaKeywords = Array.isArray(processedSettings.metaKeywords) ? processedSettings.metaKeywords : [];
    processedSettings.workingHours = Array.isArray(processedSettings.workingHours) ? processedSettings.workingHours : [];
    processedSettings.weeklyOffDays = Array.isArray(processedSettings.weeklyOffDays) ? processedSettings.weeklyOffDays : [];
    processedSettings.oneTimeOffDates = Array.isArray(processedSettings.oneTimeOffDates) ? processedSettings.oneTimeOffDates : [];
    processedSettings.officeDays = Array.isArray(processedSettings.officeDays) ? processedSettings.officeDays : [];
    processedSettings.specificDayRules = Array.isArray(processedSettings.specificDayRules) ? processedSettings.specificDayRules : [];
    const updatedSettingsDoc = await AppSettings_model_1.default.findOneAndUpdate({}, { $set: processedSettings }, { new: true, upsert: true, runValidators: true });
    return transformAppSettingsDoc(updatedSettingsDoc);
}
async function createNewConversationForUser(userId, title) {
    await (0, mongodb_1.default)();
    console.log("[ACTIONS] createNewConversationForUser: Called for userId:", userId);
    const user = await Customer_model_1.default.findById(userId);
    if (!user) {
        console.error(`[ACTIONS] createNewConversationForUser: Customer not found with ID: ${userId}`);
        return null;
    }
    const newConversation = new Conversation_model_1.default({
        customerId: user._id,
        title: title || `Trò chuyện với ${user.name || user.phoneNumber} lúc ${new Date().toLocaleString('vi-VN')}`,
        participants: [{
                userId: user._id,
                role: 'customer',
                name: user.name || `Người dùng ${user.phoneNumber}`,
                phoneNumber: user.phoneNumber,
            }],
        messageIds: [],
        pinnedMessageIds: [],
        lastMessageTimestamp: new Date(),
    });
    console.log("[ACTIONS] createNewConversationForUser: New conversation object to save:", newConversation);
    const savedConversation = await newConversation.save();
    console.log("[ACTIONS] createNewConversationForUser: Saved conversation:", savedConversation);
    user.conversationIds = user.conversationIds || []; // Initialize if undefined
    //@ts-ignore
    user.conversationIds.push(savedConversation._id);
    await user.save();
    console.log("[ACTIONS] createNewConversationForUser: Updated customer with new conversation ID.");
    return transformConversationDoc(savedConversation);
}
function isOutOfOffice(appSettings) {
    if (!appSettings.outOfOfficeResponseEnabled || !appSettings.officeHoursStart || !appSettings.officeHoursEnd || !appSettings.officeDays || appSettings.officeDays.length === 0) {
        return false;
    }
    const now = new Date();
    const currentDay = now.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
    const currentHour = (0, date_fns_1.getHours)(now);
    const currentMinute = (0, date_fns_1.getMinutes)(now);
    if (!appSettings.officeDays.includes(currentDay)) {
        return true; // It's an off-day
    }
    // Compare times
    const [startHour, startMinute] = appSettings.officeHoursStart.split(':').map(Number);
    const [endHour, endMinute] = appSettings.officeHoursEnd.split(':').map(Number);
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const officeStartTimeInMinutes = startHour * 60 + startMinute;
    const officeEndTimeInMinutes = endHour * 60 + endMinute;
    if (currentTimeInMinutes < officeStartTimeInMinutes || currentTimeInMinutes >= officeEndTimeInMinutes) {
        return true; // Outside working hours
    }
    return false; // Within office hours
}
async function handleCustomerAccess(phoneNumber) {
    var _a;
    console.log("handleCustomerAccess started for phoneNumber:", phoneNumber);
    await (0, mongodb_1.default)();
    if (!(0, validator_1.validatePhoneNumber)(phoneNumber)) {
        throw new Error("Số điện thoại không hợp lệ.");
    }
    let customer = await Customer_model_1.default.findOne({ phoneNumber });
    let isNewCustomer = false;
    if (!customer) {
        console.log("New customer, creating profile for:", phoneNumber);
        customer = new Customer_model_1.default({
            phoneNumber,
            name: `Người dùng ${phoneNumber}`,
            lastInteractionAt: new Date(),
            interactionStatus: 'unread',
            lastMessageTimestamp: new Date(),
            conversationIds: [],
            appointmentIds: [],
            productIds: [],
            noteIds: [],
            pinnedConversationIds: [],
            tags: [],
        });
        await customer.save();
        isNewCustomer = true;
    }
    else {
        console.log("Returning customer found:", customer.id);
        // Ensure these arrays are not undefined
        customer.conversationIds = customer.conversationIds || [];
        customer.appointmentIds = customer.appointmentIds || [];
        customer.productIds = customer.productIds || [];
        customer.noteIds = customer.noteIds || [];
        customer.pinnedConversationIds = customer.pinnedConversationIds || [];
        customer.tags = customer.tags || [];
    }
    let activeConversation = null;
    // For one-conversation-per-customer:
    if (customer.conversationIds && customer.conversationIds.length > 0) {
        activeConversation = await Conversation_model_1.default.findById(customer.conversationIds[0])
            .populate({
            path: 'messageIds',
            model: Message_model_1.default,
            options: { sort: { timestamp: 1 }, limit: 50 }
        });
        if (activeConversation)
            console.log("Found existing active conversation:", activeConversation.id);
    }
    if (!activeConversation) {
        console.log("No active conversation found, creating new one for customer:", customer.id);
        const newConvDocFromAction = await createNewConversationForUser(customer._id.toString(), `Trò chuyện chính với ${customer.name || customer.phoneNumber}`);
        if (!newConvDocFromAction || !newConvDocFromAction.id)
            throw new Error("Không thể tạo cuộc trò chuyện mới.");
        activeConversation = await Conversation_model_1.default.findById(newConvDocFromAction.id).populate({
            path: 'messageIds',
            model: Message_model_1.default,
            options: { sort: { timestamp: 1 }, limit: 50 }
        });
        if (activeConversation) {
            console.log("New conversation created and fetched:", activeConversation.id);
            const updatedCustomer = await Customer_model_1.default.findByIdAndUpdate(customer._id, { $addToSet: { conversationIds: activeConversation._id } }, { new: true });
            if (updatedCustomer)
                customer = updatedCustomer;
        }
    }
    if (!activeConversation) {
        console.error("CRITICAL: Failed to find or create an active conversation for customer:", customer.id);
        throw new Error("Không thể tìm hoặc tạo cuộc trò chuyện cho khách hàng.");
    }
    const userSession = transformCustomerToSession(customer, activeConversation._id.toString());
    const appSettings = await getAppSettings();
    console.log("AppSettings fetched for greeting logic:", appSettings ? "Loaded" : "Not loaded");
    let initialSystemMessageContent = "";
    const ultimateDefaultGreeting = 'Tôi có thể giúp gì cho bạn hôm nay?';
    if (appSettings) {
        if (appSettings.outOfOfficeResponseEnabled && isOutOfOffice(appSettings)) {
            initialSystemMessageContent = (((_a = appSettings.outOfOfficeMessage) === null || _a === void 0 ? void 0 : _a.trim()) || ultimateDefaultGreeting).trim();
            console.log("Out of office message selected:", initialSystemMessageContent);
        }
        else if (isNewCustomer && appSettings.greetingMessageNewCustomer && appSettings.greetingMessageNewCustomer.trim() !== "") {
            initialSystemMessageContent = appSettings.greetingMessageNewCustomer.trim();
            console.log("New customer greeting selected:", initialSystemMessageContent);
        }
        else if (!isNewCustomer && appSettings.greetingMessageReturningCustomer && appSettings.greetingMessageReturningCustomer.trim() !== "") {
            initialSystemMessageContent = appSettings.greetingMessageReturningCustomer.trim();
            console.log("Returning customer greeting selected:", initialSystemMessageContent);
        }
        else if (appSettings.greetingMessage && appSettings.greetingMessage.trim() !== "") {
            initialSystemMessageContent = appSettings.greetingMessage.trim();
            console.log("General greeting selected:", initialSystemMessageContent);
        }
    }
    if (initialSystemMessageContent.trim() === "") {
        initialSystemMessageContent = ultimateDefaultGreeting;
        console.log("Fallback to ultimate default greeting:", initialSystemMessageContent);
    }
    let finalInitialMessages = [];
    // Prepend the system greeting message
    if (initialSystemMessageContent.trim() !== "") {
        const systemGreetingMessage = {
            id: `msg_system_greeting_${Date.now()}`,
            sender: 'ai',
            content: initialSystemMessageContent,
            timestamp: new Date(),
            name: (appSettings === null || appSettings === void 0 ? void 0 : appSettings.brandName) || 'AI Assistant',
            conversationId: activeConversation._id.toString(),
        };
        finalInitialMessages.push(systemGreetingMessage);
    }
    // Then append existing messages from the conversation
    if (activeConversation.messageIds && activeConversation.messageIds.length > 0) {
        const firstMessageId = activeConversation.messageIds[0];
        if (typeof firstMessageId === 'object' && firstMessageId !== null && '_id' in firstMessageId) {
            const populatedMessages = activeConversation.messageIds.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            finalInitialMessages.push(...populatedMessages.map(transformMessageDocToMessage));
        }
        else {
            const conversationMessageDocs = await Message_model_1.default.find({ _id: { $in: activeConversation.messageIds } }).sort({ timestamp: 1 }).limit(50);
            finalInitialMessages.push(...conversationMessageDocs.map(transformMessageDocToMessage));
        }
    }
    let configuredSuggestedQuestions = [];
    // Only show suggested questions if it's effectively a "new" chat session display (only the system greeting)
    if (finalInitialMessages.length <= 1 && (appSettings === null || appSettings === void 0 ? void 0 : appSettings.suggestedQuestions) && appSettings.suggestedQuestions.length > 0) {
        configuredSuggestedQuestions = appSettings.suggestedQuestions;
    }
    console.log("handleCustomerAccess completed. Returning initial messages count:", finalInitialMessages.length);
    return {
        userSession,
        initialMessages: finalInitialMessages,
        initialSuggestedReplies: configuredSuggestedQuestions,
        activeConversationId: activeConversation._id.toString(),
        conversations: [transformConversationDoc(activeConversation)].filter(Boolean),
    };
}
async function registerUser(name, phoneNumber, password, role) {
    if (role === 'customer')
        throw new Error("Việc đăng ký khách hàng được xử lý theo cách khác.");
    await (0, mongodb_1.default)();
    if (!(0, validator_1.validatePhoneNumber)(phoneNumber)) {
        throw new Error("Số điện thoại không hợp lệ.");
    }
    const existingUser = await User_model_1.default.findOne({ phoneNumber });
    if (existingUser) {
        throw new Error('Người dùng với số điện thoại này đã tồn tại.');
    }
    const newUserDoc = new User_model_1.default({
        name,
        phoneNumber,
        password,
        role,
    });
    await newUserDoc.save();
    return transformUserToSession(newUserDoc);
}
async function loginUser(phoneNumber, passwordAttempt) {
    await (0, mongodb_1.default)();
    if (!(0, validator_1.validatePhoneNumber)(phoneNumber)) {
        throw new Error("Số điện thoại không hợp lệ.");
    }
    const user = await User_model_1.default.findOne({ phoneNumber }).select('+password');
    if (!user || user.role === 'customer') {
        throw new Error('Người dùng không tồn tại hoặc không được phép đăng nhập bằng mật khẩu.');
    }
    if (!user.password) {
        throw new Error('Mật khẩu chưa được đặt cho người dùng này. Vui lòng liên hệ quản trị viên.');
    }
    const isMatch = await user.comparePassword(passwordAttempt);
    if (!isMatch) {
        throw new Error('Thông tin đăng nhập không hợp lệ.');
    }
    return transformUserToSession(user);
}
async function getConversationHistory(conversationId) {
    await (0, mongodb_1.default)();
    if (!mongoose_1.default.Types.ObjectId.isValid(conversationId)) {
        console.warn(`[ACTIONS] Invalid conversationId for getConversationHistory: ${conversationId}`);
        return [];
    }
    const conversation = await Conversation_model_1.default.findById(conversationId).populate({
        path: 'messageIds',
        model: Message_model_1.default,
        options: { sort: { timestamp: 1 } }
    });
    if (!conversation || !conversation.messageIds || conversation.messageIds.length === 0) {
        return [];
    }
    const messages = conversation.messageIds;
    return messages.map(transformMessageDocToMessage);
}
async function getUserConversations(userId) {
    await (0, mongodb_1.default)();
    const customer = await Customer_model_1.default.findById(userId).populate({
        path: 'conversationIds',
        model: Conversation_model_1.default,
        options: { sort: { lastMessageTimestamp: -1 } }
    });
    if (!customer || !customer.conversationIds || customer.conversationIds.length === 0) {
        return [];
    }
    return customer.conversationIds.map(doc => transformConversationDoc(doc)).filter(Boolean);
}
function formatBookingConfirmation(template, details) {
    let message = template;
    message = message.replace(/{{service}}/g, details.service);
    try {
        const dateObj = (0, date_fns_1.parseISO)(details.date);
        if ((0, date_fns_1.isValid)(dateObj)) {
            message = message.replace(/{{date}}/g, (0, date_fns_1.format)(dateObj, 'dd/MM/yyyy', { locale: locale_1.vi }));
        }
        else {
            message = message.replace(/{{date}}/g, details.date);
        }
    }
    catch (e) {
        message = message.replace(/{{date}}/g, details.date);
    }
    message = message.replace(/{{time}}/g, details.time);
    message = message.replace(/{{branch}}/g, details.branch || '');
    if (!details.branch) {
        message = message.replace(/{{#if branch}}.*?{{\/if}}/g, '');
    }
    else {
        message = message.replace(/{{#if branch}}/g, '').replace(/{{\/if}}/g, '');
    }
    return message.trim();
}
async function processUserMessage(userMessageContent, currentUserSession, currentConversationId, currentChatHistory) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    await (0, mongodb_1.default)();
    console.log(`[processUserMessage] Called for conversation: ${currentConversationId}, user: ${currentUserSession.id}`);
    const customerId = currentUserSession.id;
    if (!mongoose_1.default.Types.ObjectId.isValid(currentConversationId) || !mongoose_1.default.Types.ObjectId.isValid(customerId)) {
        console.error("[processUserMessage] Invalid conversation or customer ID.");
        throw new Error("Mã cuộc trò chuyện hoặc khách hàng không hợp lệ.");
    }
    let textForAI = userMessageContent;
    let mediaDataUriForAI = undefined;
    const dataUriRegex = /^(data:[^;]+;base64,[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;
    const match = userMessageContent.match(dataUriRegex);
    if (match) {
        mediaDataUriForAI = match[1];
        const fileNameEncoded = match[2];
        let originalFileName = "attached_file";
        try {
            originalFileName = decodeURIComponent(fileNameEncoded);
        }
        catch (e) { /* ignore */ }
        textForAI = ((_a = match[3]) === null || _a === void 0 ? void 0 : _a.trim()) || `Tôi đã gửi một tệp: ${originalFileName}. Bạn có thể phân tích hoặc mô tả nó không?`;
    }
    const userMessageData = {
        sender: 'user',
        content: userMessageContent,
        timestamp: new Date(),
        //@ts-ignore
        name: currentUserSession.name || `Người dùng ${currentUserSession.phoneNumber}`,
        //@ts-ignore
        customerId: new mongoose_1.default.Types.ObjectId(customerId),
        //@ts-ignore
        userId: new mongoose_1.default.Types.ObjectId(customerId),
        //@ts-ignore
        conversationId: new mongoose_1.default.Types.ObjectId(currentConversationId),
    };
    const savedUserMessageDoc = await new Message_model_1.default(userMessageData).save();
    const userMessage = transformMessageDocToMessage(savedUserMessageDoc);
    console.log("[processUserMessage] User message saved:", userMessage.id);
    await Customer_model_1.default.findByIdAndUpdate(customerId, {
        lastInteractionAt: new Date(),
        interactionStatus: currentUserSession.role === 'customer' ? 'unread' : 'replied_by_staff',
        lastMessagePreview: textForAI.substring(0, 100),
        lastMessageTimestamp: userMessage.timestamp,
    });
    await Conversation_model_1.default.findByIdAndUpdate(currentConversationId, {
        $push: { messageIds: savedUserMessageDoc._id },
        lastMessageTimestamp: userMessage.timestamp,
        lastMessagePreview: textForAI.substring(0, 100),
    });
    let updatedChatHistoryWithUserMsg = [...currentChatHistory, userMessage];
    const formattedHistory = formatChatHistoryForAI(updatedChatHistoryWithUserMsg.slice(-10));
    let aiResponseContent = "";
    let finalAiMessage;
    let processedAppointmentDB = null;
    let scheduleOutputFromAI = null;
    const appSettings = await getAppSettings();
    if (!appSettings) {
        console.error("[processUserMessage] AppSettings not loaded.");
        throw new Error("Không thể tải cài đặt ứng dụng. Không thể xử lý tin nhắn.");
    }
    if (isOutOfOffice(appSettings) && appSettings.outOfOfficeResponseEnabled && appSettings.outOfOfficeMessage) {
        const lastAiMessage = currentChatHistory.slice().reverse().find(m => m.sender === 'ai' || m.sender === 'system');
        if (lastAiMessage && lastAiMessage.content === appSettings.outOfOfficeMessage) {
            aiResponseContent = "Chúng tôi vẫn đang ngoài giờ làm việc. Xin cảm ơn sự kiên nhẫn của bạn.";
        }
        else {
            aiResponseContent = appSettings.outOfOfficeMessage;
        }
        console.log("[processUserMessage] Out of office. AI response:", aiResponseContent);
    }
    else {
        const allProducts = await getAllProducts();
        const activeBranches = await getBranches(true);
        const branchNamesForAI = activeBranches.map(b => b.name);
        const customerAppointmentsDocs = await Appointment_model_1.default.find({
            customerId: new mongoose_1.default.Types.ObjectId(customerId),
            status: { $nin: ['cancelled', 'completed'] }
        }).populate('customerId staffId');
        //@ts-ignore
        const customerAppointmentsForAI = customerAppointmentsDocs.map(doc => {
            var _a, _b, _c, _d;
            return (Object.assign(Object.assign({}, transformAppointmentDocToDetails(doc)), { userId: (_b = (_a = doc.customerId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString(), createdAt: (_c = doc.createdAt) === null || _c === void 0 ? void 0 : _c.toISOString(), updatedAt: (_d = doc.updatedAt) === null || _d === void 0 ? void 0 : _d.toISOString() }));
        });
        const appointmentRulesFromDB = await getAppointmentRules();
        const appointmentRulesForAI = appointmentRulesFromDB.map((rule) => {
            var _a, _b;
            return ({
                id: rule.id, name: rule.name, keywords: rule.keywords, conditions: rule.conditions,
                aiPromptInstructions: rule.aiPromptInstructions, createdAt: (_a = rule.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString(), updatedAt: (_b = rule.updatedAt) === null || _b === void 0 ? void 0 : _b.toISOString(),
            });
        });
        scheduleOutputFromAI = await (0, schedule_appointment_1.scheduleAppointment)({
            userInput: textForAI,
            phoneNumber: currentUserSession.phoneNumber,
            userId: customerId,
            existingAppointments: customerAppointmentsForAI.length > 0 ? customerAppointmentsForAI : undefined,
            currentDateTime: new Date().toISOString(),
            chatHistory: formattedHistory,
            appointmentRules: appointmentRulesForAI.length > 0 ? appointmentRulesForAI : undefined,
            availableBranches: branchNamesForAI.length > 0 ? branchNamesForAI : undefined,
        });
        console.log("[processUserMessage] scheduleOutputFromAI received:", JSON.stringify(scheduleOutputFromAI, null, 2));
        if (!scheduleOutputFromAI) {
            aiResponseContent = "Xin lỗi, tôi không thể xử lý yêu cầu này ngay bây giờ.";
        }
        else {
            aiResponseContent = scheduleOutputFromAI.confirmationMessage;
            if ((scheduleOutputFromAI.intent === 'booked' || scheduleOutputFromAI.intent === 'rescheduled') &&
                ((_b = scheduleOutputFromAI.appointmentDetails) === null || _b === void 0 ? void 0 : _b.date) && ((_c = scheduleOutputFromAI.appointmentDetails) === null || _c === void 0 ? void 0 : _c.time) &&
                /^\d{4}-\d{2}-\d{2}$/.test(scheduleOutputFromAI.appointmentDetails.date) &&
                /^[0-2][0-9]:[0-5][0-9]$/.test(scheduleOutputFromAI.appointmentDetails.time) &&
                scheduleOutputFromAI.appointmentDetails.service) {
                const targetDate = (0, date_fns_1.parseISO)(scheduleOutputFromAI.appointmentDetails.date);
                const targetTime = scheduleOutputFromAI.appointmentDetails.time;
                const serviceName = scheduleOutputFromAI.appointmentDetails.service;
                const targetBranchId = (_d = activeBranches.find(b => { var _a; return b.name === ((_a = scheduleOutputFromAI === null || scheduleOutputFromAI === void 0 ? void 0 : scheduleOutputFromAI.appointmentDetails) === null || _a === void 0 ? void 0 : _a.branch); })) === null || _d === void 0 ? void 0 : _d.id;
                const productForService = await Product_model_1.default.findOne({ name: serviceName });
                if (!productForService || !productForService.isSchedulable) {
                    aiResponseContent = `Xin lỗi, dịch vụ "${serviceName}" hiện không thể đặt lịch hoặc không tồn tại.`;
                    scheduleOutputFromAI.intent = 'clarification_needed';
                    processedAppointmentDB = null;
                }
                else if (!(0, date_fns_1.isValid)(targetDate)) {
                    aiResponseContent = "Ngày bạn cung cấp không hợp lệ. Vui lòng kiểm tra lại (YYYY-MM-DD).";
                    scheduleOutputFromAI.intent = 'clarification_needed';
                    processedAppointmentDB = null;
                }
                else {
                    const effectiveSchedulingRules = {
                        numberOfStaff: (_g = (_f = (_e = productForService.schedulingRules) === null || _e === void 0 ? void 0 : _e.numberOfStaff) !== null && _f !== void 0 ? _f : appSettings.numberOfStaff) !== null && _g !== void 0 ? _g : 1,
                        workingHours: ((_j = (_h = productForService.schedulingRules) === null || _h === void 0 ? void 0 : _h.workingHours) === null || _j === void 0 ? void 0 : _j.length) ? productForService.schedulingRules.workingHours : (_k = appSettings.workingHours) !== null && _k !== void 0 ? _k : [],
                        weeklyOffDays: ((_m = (_l = productForService.schedulingRules) === null || _l === void 0 ? void 0 : _l.weeklyOffDays) === null || _m === void 0 ? void 0 : _m.length) ? productForService.schedulingRules.weeklyOffDays : (_o = appSettings.weeklyOffDays) !== null && _o !== void 0 ? _o : [],
                        oneTimeOffDates: ((_q = (_p = productForService.schedulingRules) === null || _p === void 0 ? void 0 : _p.oneTimeOffDates) === null || _q === void 0 ? void 0 : _q.length) ? productForService.schedulingRules.oneTimeOffDates : (_r = appSettings.oneTimeOffDates) !== null && _r !== void 0 ? _r : [],
                        specificDayRules: ((_t = (_s = productForService.schedulingRules) === null || _s === void 0 ? void 0 : _s.specificDayRules) === null || _t === void 0 ? void 0 : _t.length) ? productForService.schedulingRules.specificDayRules : (_u = appSettings.specificDayRules) !== null && _u !== void 0 ? _u : [],
                    };
                    const serviceDuration = (_x = (_w = (_v = productForService.schedulingRules) === null || _v === void 0 ? void 0 : _v.serviceDurationMinutes) !== null && _w !== void 0 ? _w : appSettings.defaultServiceDurationMinutes) !== null && _x !== void 0 ? _x : 60;
                    const availability = await (0, schedule_appointment_1.checkRealAvailability)(targetDate, targetTime, appSettings, serviceName, effectiveSchedulingRules, serviceDuration, targetBranchId);
                    console.log("[processUserMessage] Availability check for booking:", availability);
                    if (availability.isAvailable) {
                        const appointmentDataCommon = {
                            customerId: new mongoose_1.default.Types.ObjectId(customerId), service: serviceName, productId: productForService._id,
                            date: scheduleOutputFromAI.appointmentDetails.date, time: scheduleOutputFromAI.appointmentDetails.time,
                            branch: scheduleOutputFromAI.appointmentDetails.branch, branchId: targetBranchId ? new mongoose_1.default.Types.ObjectId(targetBranchId) : undefined,
                            notes: scheduleOutputFromAI.appointmentDetails.notes, packageType: scheduleOutputFromAI.appointmentDetails.packageType,
                            priority: scheduleOutputFromAI.appointmentDetails.priority,
                        };
                        if (scheduleOutputFromAI.intent === 'booked') {
                            const newAppointmentData = Object.assign(Object.assign({}, appointmentDataCommon), { status: 'booked' });
                            processedAppointmentDB = await new Appointment_model_1.default(newAppointmentData).save();
                        }
                        else { // Rescheduled
                            if (scheduleOutputFromAI.originalAppointmentIdToModify) {
                                processedAppointmentDB = await Appointment_model_1.default.findOneAndUpdate({ _id: new mongoose_1.default.Types.ObjectId(scheduleOutputFromAI.originalAppointmentIdToModify), customerId: new mongoose_1.default.Types.ObjectId(customerId) }, Object.assign(Object.assign({}, appointmentDataCommon), { status: 'booked', updatedAt: new Date() }), { new: true });
                            }
                        }
                        if (processedAppointmentDB && processedAppointmentDB._id) {
                            await Customer_model_1.default.findByIdAndUpdate(customerId, { $addToSet: { appointmentIds: processedAppointmentDB._id } });
                            if (appSettings.successfulBookingMessageTemplate) {
                                const detailsForTemplate = transformAppointmentDocToDetails(await Appointment_model_1.default.findById(processedAppointmentDB._id).populate('customerId staffId'));
                                aiResponseContent = formatBookingConfirmation(appSettings.successfulBookingMessageTemplate, detailsForTemplate);
                            }
                            else {
                                aiResponseContent = scheduleOutputFromAI.confirmationMessage; // Use AI's natural confirmation
                            }
                            console.log("[processUserMessage] Appointment booked/rescheduled. DB ID:", processedAppointmentDB._id);
                        }
                        else {
                            aiResponseContent = "Đã xảy ra lỗi khi lưu lịch hẹn của bạn. Vui lòng thử lại.";
                            console.error("[processUserMessage] Failed to save or find appointment after DB operation.");
                        }
                    }
                    else {
                        aiResponseContent = scheduleOutputFromAI.confirmationMessage; // AI should have handled this via availabilityCheckResult
                        processedAppointmentDB = null;
                    }
                }
            }
            else if (scheduleOutputFromAI.intent === 'cancelled') {
                if (scheduleOutputFromAI.originalAppointmentIdToModify) {
                    processedAppointmentDB = await Appointment_model_1.default.findOneAndUpdate({ _id: new mongoose_1.default.Types.ObjectId(scheduleOutputFromAI.originalAppointmentIdToModify), customerId: new mongoose_1.default.Types.ObjectId(customerId) }, { status: 'cancelled', updatedAt: new Date() }, { new: true });
                    console.log("[processUserMessage] Appointment cancelled. DB ID:", processedAppointmentDB === null || processedAppointmentDB === void 0 ? void 0 : processedAppointmentDB._id);
                }
                else {
                    console.warn("[processUserMessage] Attempted to cancel without originalAppointmentIdToModify.");
                }
            }
            else if (scheduleOutputFromAI.intent === 'no_action_needed' || scheduleOutputFromAI.intent === 'clarification_needed' || scheduleOutputFromAI.intent === 'error') {
                let keywordFound = false;
                if (!mediaDataUriForAI) {
                    const keywordMappings = await getKeywordMappings();
                    for (const mapping of keywordMappings) {
                        if (mapping.keywords.some(kw => textForAI.toLowerCase().includes(kw.toLowerCase()))) {
                            aiResponseContent = mapping.response;
                            keywordFound = true;
                            break;
                        }
                    }
                }
                if (!keywordFound) {
                    try {
                        const approvedTrainingDocs = await TrainingData_model_1.default.find({ status: 'approved' }).sort({ updatedAt: -1 }).limit(5);
                        const relevantTrainingData = approvedTrainingDocs.map(doc => ({ userInput: doc.userInput, idealResponse: doc.idealResponse }));
                        const answerResult = await (0, answer_user_question_1.answerUserQuestion)({
                            question: textForAI, chatHistory: formattedHistory, mediaDataUri: mediaDataUriForAI,
                            relevantTrainingData: relevantTrainingData.length > 0 ? relevantTrainingData : undefined,
                            //@ts-ignore
                            products: allProducts.map(p => ({ name: p.name, description: p.description, price: p.price, category: p.category })),
                        });
                        aiResponseContent = answerResult.answer;
                    }
                    catch (error) {
                        console.error('[processUserMessage] Error answering user question:', error);
                        aiResponseContent = "Xin lỗi, tôi đang gặp chút khó khăn để hiểu ý bạn. Bạn có thể hỏi theo cách khác được không?";
                    }
                }
            }
        }
    }
    const brandNameForAI = (appSettings === null || appSettings === void 0 ? void 0 : appSettings.brandName) || 'AI Assistant';
    const aiMessageData = {
        //@ts-ignore
        sender: 'ai', content: aiResponseContent, timestamp: new Date(), name: `${brandNameForAI}`,
        //@ts-ignore
        customerId: new mongoose_1.default.Types.ObjectId(customerId), conversationId: new mongoose_1.default.Types.ObjectId(currentConversationId),
    };
    const savedAiMessageDoc = await new Message_model_1.default(aiMessageData).save();
    finalAiMessage = transformMessageDocToMessage(savedAiMessageDoc);
    console.log("[processUserMessage] AI message saved:", finalAiMessage.id);
    await Customer_model_1.default.findByIdAndUpdate(customerId, { lastInteractionAt: new Date() });
    await Conversation_model_1.default.findByIdAndUpdate(currentConversationId, {
        $push: { messageIds: savedAiMessageDoc._id },
        lastMessageTimestamp: savedAiMessageDoc.timestamp,
        lastMessagePreview: savedAiMessageDoc.content.substring(0, 100),
    });
    const newSuggestedReplies = [];
    const updatedAppointmentClient = processedAppointmentDB ? transformAppointmentDocToDetails(processedAppointmentDB) : undefined;
    console.log("[processUserMessage] Returning:", { userMessageId: userMessage.id, aiMessageId: finalAiMessage.id, updatedAppointmentId: updatedAppointmentClient === null || updatedAppointmentClient === void 0 ? void 0 : updatedAppointmentClient.appointmentId });
    return { userMessage: userMessage, aiMessage: finalAiMessage, newSuggestedReplies, updatedAppointment: updatedAppointmentClient };
}
async function handleBookAppointmentFromForm(formData) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    await (0, mongodb_1.default)();
    const appSettings = await getAppSettings();
    if (!appSettings) {
        return { success: false, message: "Lỗi: Không thể tải cài đặt hệ thống." };
    }
    const productForService = await Product_model_1.default.findById(formData.productId);
    if (!productForService || !productForService.isSchedulable) {
        return { success: false, message: `Dịch vụ "${formData.service}" không thể đặt lịch hoặc không tồn tại.` };
    }
    try {
        const targetDate = (0, date_fns_1.parseISO)(formData.date);
        if (!(0, date_fns_1.isValid)(targetDate)) {
            return { success: false, message: "Ngày không hợp lệ." };
        }
        const effectiveSchedulingRules = {
            numberOfStaff: (_c = (_b = (_a = productForService.schedulingRules) === null || _a === void 0 ? void 0 : _a.numberOfStaff) !== null && _b !== void 0 ? _b : appSettings.numberOfStaff) !== null && _c !== void 0 ? _c : 1,
            workingHours: ((_e = (_d = productForService.schedulingRules) === null || _d === void 0 ? void 0 : _d.workingHours) === null || _e === void 0 ? void 0 : _e.length) ? productForService.schedulingRules.workingHours : (_f = appSettings.workingHours) !== null && _f !== void 0 ? _f : [],
            weeklyOffDays: ((_h = (_g = productForService.schedulingRules) === null || _g === void 0 ? void 0 : _g.weeklyOffDays) === null || _h === void 0 ? void 0 : _h.length) ? productForService.schedulingRules.weeklyOffDays : (_j = appSettings.weeklyOffDays) !== null && _j !== void 0 ? _j : [],
            oneTimeOffDates: ((_l = (_k = productForService.schedulingRules) === null || _k === void 0 ? void 0 : _k.oneTimeOffDates) === null || _l === void 0 ? void 0 : _l.length) ? productForService.schedulingRules.oneTimeOffDates : (_m = appSettings.oneTimeOffDates) !== null && _m !== void 0 ? _m : [],
            specificDayRules: ((_p = (_o = productForService.schedulingRules) === null || _o === void 0 ? void 0 : _o.specificDayRules) === null || _p === void 0 ? void 0 : _p.length) ? productForService.schedulingRules.specificDayRules : (_q = appSettings.specificDayRules) !== null && _q !== void 0 ? _q : [],
        };
        const serviceDuration = (_t = (_s = (_r = productForService.schedulingRules) === null || _r === void 0 ? void 0 : _r.serviceDurationMinutes) !== null && _s !== void 0 ? _s : appSettings.defaultServiceDurationMinutes) !== null && _t !== void 0 ? _t : 60;
        const availability = await (0, schedule_appointment_1.checkRealAvailability)(targetDate, formData.time, appSettings, formData.service, effectiveSchedulingRules, serviceDuration, formData.branchId);
        if (availability.isAvailable) {
            const appointmentDataList = [];
            const recurrenceCount = formData.recurrenceCount || 1;
            let currentBookingDate = targetDate;
            for (let i = 0; i < recurrenceCount; i++) {
                if (i > 0) {
                    if (formData.recurrenceType === 'daily') {
                        currentBookingDate = (0, date_fns_1.addDays)(currentBookingDate, 1);
                    }
                    else if (formData.recurrenceType === 'weekly') {
                        currentBookingDate = (0, date_fns_1.addWeeks)(currentBookingDate, 1);
                    }
                    else if (formData.recurrenceType === 'monthly') {
                        currentBookingDate = (0, date_fns_1.addMonths)(currentBookingDate, 1);
                    }
                    else {
                        break;
                    }
                }
                const instanceAvailability = await (0, schedule_appointment_1.checkRealAvailability)(currentBookingDate, formData.time, appSettings, formData.service, effectiveSchedulingRules, serviceDuration, formData.branchId);
                if (!instanceAvailability.isAvailable) {
                    const failedDateStr = (0, date_fns_1.format)(currentBookingDate, 'dd/MM/yyyy');
                    let failureMessage = `Không thể đặt lịch cho ngày ${failedDateStr} lúc ${formData.time} do đã hết chỗ hoặc không hợp lệ.`;
                    if (i > 0) {
                        failureMessage = `Đã đặt được ${i} lịch hẹn. ${failureMessage} Các lịch hẹn sau đó trong chuỗi cũng không được đặt.`;
                    }
                    return {
                        success: false,
                        message: failureMessage,
                        reason: instanceAvailability.reason,
                        suggestedSlots: instanceAvailability.suggestedSlots,
                    };
                }
                const appointmentData = {
                    customerId: new mongoose_1.default.Types.ObjectId(formData.customerId),
                    service: formData.service,
                    productId: new mongoose_1.default.Types.ObjectId(formData.productId),
                    date: (0, date_fns_1.format)(currentBookingDate, 'yyyy-MM-dd'),
                    time: formData.time,
                    branch: formData.branch,
                    branchId: formData.branchId ? new mongoose_1.default.Types.ObjectId(formData.branchId) : undefined,
                    notes: formData.notes,
                    status: 'booked',
                    recurrenceType: formData.recurrenceType || 'none',
                    recurrenceCount: formData.recurrenceCount,
                };
                appointmentDataList.push(appointmentData);
            }
            //@ts-ignore
            const savedAppointments = await Appointment_model_1.default.insertMany(appointmentDataList);
            const savedAppointmentIds = savedAppointments.map(appt => appt._id);
            await Customer_model_1.default.findByIdAndUpdate(formData.customerId, { $push: { appointmentIds: { $each: savedAppointmentIds } } });
            // Schedule reminders for each appointment
            for (const appointmentId of savedAppointmentIds) {
                try {
                    // Ensure appointmentId is string or ObjectId
                    const id = typeof appointmentId === 'object' && appointmentId !== null && 'toString' in appointmentId ? appointmentId.toString() : appointmentId;
                    //@ts-ignore
                    await appointmentReminder_service_1.AppointmentReminderService.scheduleReminder(id);
                }
                catch (error) {
                    console.error(`Failed to schedule reminder for appointment ${appointmentId}:`, error);
                }
            }
            const firstAppointmentDetails = transformAppointmentDocToDetails(await Appointment_model_1.default.findById(savedAppointmentIds[0])
                .populate('customerId', 'name phoneNumber')
                .populate('staffId', 'name'));
            let successMessage = `Lịch hẹn cho dịch vụ "${formData.service}" vào lúc ${formData.time} ngày ${(0, date_fns_1.format)(targetDate, 'dd/MM/yyyy')} ${formData.branch ? `tại ${formData.branch}` : ''} đã được đặt thành công.`;
            if (recurrenceCount > 1) {
                successMessage = `Chuỗi ${recurrenceCount} lịch hẹn (lặp lại ${formData.recurrenceType === 'daily' ? 'hàng ngày' : formData.recurrenceType === 'weekly' ? 'hàng tuần' : 'hàng tháng'}) cho dịch vụ "${formData.service}" bắt đầu từ ${formData.time} ngày ${(0, date_fns_1.format)(targetDate, 'dd/MM/yyyy')} ${formData.branch ? `tại ${formData.branch}` : ''} đã được đặt thành công.`;
            }
            else if (appSettings.successfulBookingMessageTemplate) {
                successMessage = formatBookingConfirmation(appSettings.successfulBookingMessageTemplate, firstAppointmentDetails);
            }
            return {
                success: true,
                message: successMessage,
                appointment: firstAppointmentDetails,
            };
        }
        else {
            return {
                success: false,
                message: `Rất tiếc, khung giờ bạn chọn (${formData.time} ngày ${(0, date_fns_1.format)(targetDate, 'dd/MM/yyyy')}) cho dịch vụ "${formData.service}" không còn trống. ${availability.reason || ''}`,
                reason: availability.reason,
                suggestedSlots: availability.suggestedSlots,
            };
        }
    }
    catch (error) {
        console.error("[handleBookAppointmentFromForm] Error:", error);
        return { success: false, message: error.message || "Đã xảy ra lỗi khi đặt lịch hẹn." };
    }
}
// --- Functions for Admin/Staff ---
async function getCustomersForStaffView(requestingStaffId, requestingStaffRole, filterTags) {
    await (0, mongodb_1.default)();
    const query = {};
    if (requestingStaffRole === 'staff' && requestingStaffId) {
        const staffSpecificTag = `staff:${requestingStaffId}`;
        query.$or = [
            { assignedStaffId: new mongoose_1.default.Types.ObjectId(requestingStaffId) },
            { assignedStaffId: { $exists: false } },
            { tags: staffSpecificTag }
        ];
    }
    else if (requestingStaffRole === 'admin') {
        if (filterTags && filterTags.some(tag => tag.startsWith('admin:'))) {
            query.tags = { $in: filterTags.filter(tag => tag.startsWith('admin:')) };
        }
    }
    if (filterTags && filterTags.length > 0) {
        const generalTagsToFilter = filterTags.filter(tag => !tag.startsWith('staff:') && !tag.startsWith('admin:'));
        if (generalTagsToFilter.length > 0) {
            if (query.$or) {
                query.$or = query.$or.map((condition) => ({
                    $and: [condition, { tags: { $in: generalTagsToFilter } }]
                }));
            }
            else {
                if (query.tags && query.tags.$in) {
                    query.tags.$in = [...new Set([...query.tags.$in, ...generalTagsToFilter])];
                }
                else {
                    query.tags = { $in: generalTagsToFilter };
                }
            }
        }
    }
    const customerDocs = await Customer_model_1.default.find(query)
        .populate('assignedStaffId', 'name')
        .sort({ lastMessageTimestamp: -1, lastInteractionAt: -1 })
        .limit(100);
    return customerDocs.map(doc => {
        var _a, _b, _c;
        return ({
            id: doc._id.toString(),
            phoneNumber: doc.phoneNumber,
            name: doc.name || `Người dùng ${doc.phoneNumber}`,
            internalName: doc.internalName,
            conversationIds: (doc.conversationIds || []).map(id => id.toString()),
            appointmentIds: (doc.appointmentIds || []).map(id => id.toString()),
            productIds: (doc.productIds || []).map(id => id.toString()),
            noteIds: (doc.noteIds || []).map(id => id.toString()),
            pinnedConversationIds: (doc.pinnedConversationIds || []).map(id => id.toString()),
            tags: doc.tags || [],
            assignedStaffId: (_b = (_a = doc.assignedStaffId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString(),
            assignedStaffName: (_c = doc.assignedStaffId) === null || _c === void 0 ? void 0 : _c.name,
            lastInteractionAt: new Date(doc.lastInteractionAt),
            createdAt: new Date(doc.createdAt),
            interactionStatus: doc.interactionStatus,
            lastMessagePreview: doc.lastMessagePreview,
            lastMessageTimestamp: doc.lastMessageTimestamp ? new Date(doc.lastMessageTimestamp) : undefined,
        });
    });
}
async function markCustomerInteractionAsReadByStaff(customerId, staffId) {
    await (0, mongodb_1.default)();
    const customer = await Customer_model_1.default.findById(customerId);
    if (customer && customer.interactionStatus === 'unread') {
        await Customer_model_1.default.findByIdAndUpdate(customerId, { interactionStatus: 'read' });
    }
}
async function getCustomerDetails(customerId) {
    var _a, _b, _c;
    await (0, mongodb_1.default)();
    const customerDoc = await Customer_model_1.default.findById(customerId)
        .populate('assignedStaffId', 'name')
        .populate({
        path: 'conversationIds',
        model: Conversation_model_1.default,
        options: { sort: { lastMessageTimestamp: -1 } },
        populate: {
            path: 'messageIds',
            model: Message_model_1.default,
            options: { sort: { timestamp: 1 }, limit: 50 }
        }
    });
    if (!customerDoc) {
        return { customer: null, messages: [], appointments: [], notes: [], conversations: [] };
    }
    const transformedConversations = (customerDoc.conversationIds || [])
        .map(convDoc => transformConversationDoc(convDoc))
        .filter(Boolean);
    let messagesForActiveConversation = [];
    if (transformedConversations.length > 0 && customerDoc.conversationIds && customerDoc.conversationIds[0]) {
        const activeConvDoc = customerDoc.conversationIds[0];
        if (activeConvDoc && activeConvDoc.messageIds) {
            messagesForActiveConversation = activeConvDoc.messageIds.map(transformMessageDocToMessage);
        }
    }
    const appointmentDocs = await Appointment_model_1.default.find({ customerId: customerDoc._id })
        .populate('customerId', 'name phoneNumber')
        .populate('staffId', 'name')
        .sort({ date: -1, time: -1 });
    const noteDocs = await Note_model_1.default.find({ customerId: customerDoc._id })
        .populate('staffId', 'name')
        .sort({ createdAt: -1 });
    const customerProfile = {
        id: customerDoc._id.toString(),
        phoneNumber: customerDoc.phoneNumber,
        name: customerDoc.name || `Người dùng ${customerDoc.phoneNumber}`,
        internalName: customerDoc.internalName,
        conversationIds: transformedConversations.map(c => c.id),
        appointmentIds: (customerDoc.appointmentIds || []).map(id => id.toString()),
        productIds: (customerDoc.productIds || []).map(id => id.toString()),
        noteIds: (customerDoc.noteIds || []).map(id => id.toString()),
        pinnedConversationIds: (customerDoc.pinnedConversationIds || []).map(id => id.toString()),
        tags: customerDoc.tags || [],
        assignedStaffId: (_b = (_a = customerDoc.assignedStaffId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString(),
        assignedStaffName: (_c = customerDoc.assignedStaffId) === null || _c === void 0 ? void 0 : _c.name,
        lastInteractionAt: new Date(customerDoc.lastInteractionAt),
        createdAt: new Date(customerDoc.createdAt),
        interactionStatus: customerDoc.interactionStatus,
        lastMessagePreview: customerDoc.lastMessagePreview,
        lastMessageTimestamp: customerDoc.lastMessageTimestamp ? new Date(customerDoc.lastMessageTimestamp) : undefined,
    };
    return {
        customer: customerProfile,
        messages: messagesForActiveConversation,
        appointments: appointmentDocs.map(transformAppointmentDocToDetails),
        notes: noteDocs.map(transformNoteDocToNote),
        conversations: transformedConversations,
    };
}
async function getAllUsers(roles = ['staff', 'admin']) {
    await (0, mongodb_1.default)();
    const userDocs = await User_model_1.default.find({ role: { $in: roles } });
    return userDocs.map(transformUserToSession);
}
async function getStaffList() {
    await (0, mongodb_1.default)();
    const staffUsers = await User_model_1.default.find({ role: { $in: ['staff', 'admin'] } }, 'name');
    return staffUsers.map(user => ({
        id: user._id.toString(),
        name: user.name || `User ${user._id.toString().slice(-4)}`
    }));
}
async function createStaffOrAdminUser(name, phoneNumber, role, password) {
    await (0, mongodb_1.default)();
    if (await User_model_1.default.findOne({ phoneNumber })) {
        throw new Error('Người dùng với số điện thoại này đã tồn tại.');
    }
    const newUser = new User_model_1.default({
        name,
        phoneNumber,
        role,
        password: password,
    });
    await newUser.save();
    return transformUserToSession(newUser);
}
async function updateUser(userId, data) {
    await (0, mongodb_1.default)();
    const user = await User_model_1.default.findById(userId);
    if (!user)
        throw new Error("Không tìm thấy người dùng.");
    if (data.name)
        user.name = data.name;
    if (data.role)
        user.role = data.role;
    if (data.password) {
        user.password = data.password;
    }
    await user.save();
    return transformUserToSession(user);
}
async function deleteUser(userId) {
    await (0, mongodb_1.default)();
    const result = await User_model_1.default.findByIdAndDelete(userId);
    if (!result)
        throw new Error("Không tìm thấy người dùng để xóa.");
    await Customer_model_1.default.updateMany({ assignedStaffId: userId }, { $unset: { assignedStaffId: "" } });
    await Appointment_model_1.default.updateMany({ staffId: userId }, { $unset: { staffId: "" } });
    return { success: true, message: "Người dùng đã được xóa." };
}
async function assignStaffToCustomer(customerId, staffId) {
    var _a, _b, _c;
    await (0, mongodb_1.default)();
    const updatedCustomerDoc = await Customer_model_1.default.findByIdAndUpdate(customerId, {
        assignedStaffId: new mongoose_1.default.Types.ObjectId(staffId),
        lastInteractionAt: new Date(),
        interactionStatus: 'read',
    }, { new: true }).populate('assignedStaffId', 'name');
    if (!updatedCustomerDoc)
        throw new Error("Không tìm thấy khách hàng.");
    return {
        id: updatedCustomerDoc._id.toString(),
        phoneNumber: updatedCustomerDoc.phoneNumber,
        name: updatedCustomerDoc.name || `Người dùng ${updatedCustomerDoc.phoneNumber}`,
        internalName: updatedCustomerDoc.internalName,
        conversationIds: (updatedCustomerDoc.conversationIds || []).map(id => id.toString()),
        appointmentIds: (updatedCustomerDoc.appointmentIds || []).map(id => id.toString()),
        productIds: (updatedCustomerDoc.productIds || []).map(id => id.toString()),
        noteIds: (updatedCustomerDoc.noteIds || []).map(id => id.toString()),
        pinnedConversationIds: (updatedCustomerDoc.pinnedConversationIds || []).map(id => id.toString()),
        tags: updatedCustomerDoc.tags || [],
        assignedStaffId: (_b = (_a = updatedCustomerDoc.assignedStaffId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString(),
        assignedStaffName: (_c = updatedCustomerDoc.assignedStaffId) === null || _c === void 0 ? void 0 : _c.name,
        lastInteractionAt: new Date(updatedCustomerDoc.lastInteractionAt),
        createdAt: new Date(updatedCustomerDoc.createdAt),
        interactionStatus: updatedCustomerDoc.interactionStatus,
        lastMessagePreview: updatedCustomerDoc.lastMessagePreview,
        lastMessageTimestamp: updatedCustomerDoc.lastMessageTimestamp ? new Date(updatedCustomerDoc.lastMessageTimestamp) : undefined,
    };
}
async function unassignStaffFromCustomer(customerId) {
    var _a;
    await (0, mongodb_1.default)();
    const updatedCustomerDoc = await Customer_model_1.default.findByIdAndUpdate(customerId, {
        $unset: { assignedStaffId: "" },
        lastInteractionAt: new Date(),
        interactionStatus: 'unread',
    }, { new: true });
    if (!updatedCustomerDoc)
        throw new Error("Không tìm thấy khách hàng.");
    return {
        id: updatedCustomerDoc._id.toString(),
        phoneNumber: updatedCustomerDoc.phoneNumber,
        name: updatedCustomerDoc.name || `Người dùng ${updatedCustomerDoc.phoneNumber}`,
        internalName: updatedCustomerDoc.internalName,
        conversationIds: (updatedCustomerDoc.conversationIds || []).map(id => id.toString()),
        appointmentIds: (updatedCustomerDoc.appointmentIds || []).map(id => id.toString()),
        productIds: (updatedCustomerDoc.productIds || []).map(id => id.toString()),
        noteIds: (updatedCustomerDoc.noteIds || []).map(id => id.toString()),
        pinnedConversationIds: (updatedCustomerDoc.pinnedConversationIds || []).map(id => id.toString()),
        tags: updatedCustomerDoc.tags || [],
        assignedStaffId: updatedCustomerDoc.assignedStaffId ? (_a = updatedCustomerDoc.assignedStaffId._id) === null || _a === void 0 ? void 0 : _a.toString() : undefined,
        assignedStaffName: undefined,
        lastInteractionAt: new Date(updatedCustomerDoc.lastInteractionAt),
        createdAt: new Date(updatedCustomerDoc.createdAt),
        interactionStatus: updatedCustomerDoc.interactionStatus,
        lastMessagePreview: updatedCustomerDoc.lastMessagePreview,
        lastMessageTimestamp: updatedCustomerDoc.lastMessageTimestamp ? new Date(updatedCustomerDoc.lastMessageTimestamp) : undefined,
    };
}
async function addTagToCustomer(customerId, tag) {
    var _a, _b, _c;
    await (0, mongodb_1.default)();
    const customer = await Customer_model_1.default.findById(customerId).populate('assignedStaffId', 'name');
    if (!customer)
        throw new Error("Không tìm thấy khách hàng.");
    if (!customer.tags) {
        customer.tags = [];
    }
    if (!customer.tags.includes(tag)) {
        customer.tags.push(tag);
        customer.lastInteractionAt = new Date();
        await customer.save();
    }
    return {
        id: customer._id.toString(),
        phoneNumber: customer.phoneNumber,
        name: customer.name || `Người dùng ${customer.phoneNumber}`,
        internalName: customer.internalName,
        conversationIds: (customer.conversationIds || []).map(id => id.toString()),
        appointmentIds: (customer.appointmentIds || []).map(id => id.toString()),
        productIds: (customer.productIds || []).map(id => id.toString()),
        noteIds: (customer.noteIds || []).map(id => id.toString()),
        pinnedConversationIds: (customer.pinnedConversationIds || []).map(id => id.toString()),
        tags: customer.tags || [],
        assignedStaffId: (_b = (_a = customer.assignedStaffId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString(),
        assignedStaffName: (_c = customer.assignedStaffId) === null || _c === void 0 ? void 0 : _c.name,
        lastInteractionAt: new Date(customer.lastInteractionAt),
        createdAt: new Date(customer.createdAt),
        interactionStatus: customer.interactionStatus,
        lastMessagePreview: customer.lastMessagePreview,
        lastMessageTimestamp: customer.lastMessageTimestamp ? new Date(customer.lastMessageTimestamp) : undefined,
    };
}
async function removeTagFromCustomer(customerId, tagToRemove) {
    var _a, _b, _c;
    await (0, mongodb_1.default)();
    const customer = await Customer_model_1.default.findByIdAndUpdate(customerId, { $pull: { tags: tagToRemove }, lastInteractionAt: new Date() }, { new: true }).populate('assignedStaffId', 'name');
    if (!customer)
        throw new Error("Không tìm thấy khách hàng.");
    return {
        id: customer._id.toString(),
        phoneNumber: customer.phoneNumber,
        name: customer.name || `Người dùng ${customer.phoneNumber}`,
        internalName: customer.internalName,
        conversationIds: (customer.conversationIds || []).map(id => id.toString()),
        appointmentIds: (customer.appointmentIds || []).map(id => id.toString()),
        productIds: (customer.productIds || []).map(id => id.toString()),
        noteIds: (customer.noteIds || []).map(id => id.toString()),
        pinnedConversationIds: (customer.pinnedConversationIds || []).map(id => id.toString()),
        tags: customer.tags || [],
        assignedStaffId: (_b = (_a = customer.assignedStaffId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString(),
        assignedStaffName: (_c = customer.assignedStaffId) === null || _c === void 0 ? void 0 : _c.name,
        lastInteractionAt: new Date(customer.lastInteractionAt),
        createdAt: new Date(customer.createdAt),
        interactionStatus: customer.interactionStatus,
        lastMessagePreview: customer.lastMessagePreview,
        lastMessageTimestamp: customer.lastMessageTimestamp ? new Date(customer.lastMessageTimestamp) : undefined,
    };
}
async function sendStaffMessage(staffSession, customerId, conversationId, messageContent) {
    console.log("Action: sendStaffMessage received:", { staffSessionId: staffSession.id, customerId, conversationId, messageContent: messageContent.substring(0, 50) + "..." });
    await (0, mongodb_1.default)();
    if (staffSession.role !== 'staff' && staffSession.role !== 'admin') {
        throw new Error("Không được phép gửi tin nhắn.");
    }
    const customer = await Customer_model_1.default.findById(customerId);
    if (!customer) {
        throw new Error("Không tìm thấy khách hàng.");
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(conversationId)) {
        throw new Error("Mã cuộc trò chuyện không hợp lệ.");
    }
    const conversation = await Conversation_model_1.default.findById(conversationId);
    if (!conversation) {
        throw new Error("Không tìm thấy cuộc trò chuyện.");
    }
    if (conversation.customerId.toString() !== customerId) {
        throw new Error("Cuộc trò chuyện không thuộc về khách hàng này.");
    }
    const staffMessageData = {
        sender: 'ai',
        content: messageContent,
        timestamp: new Date(),
        //@ts-ignore
        name: staffSession.name || (staffSession.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'),
        //@ts-ignore
        customerId: customer._id,
        userId: new mongoose_1.default.Types.ObjectId(staffSession.id),
        //@ts-ignore
        conversationId: new mongoose_1.default.Types.ObjectId(conversationId),
    };
    console.log("Action: staffMessageData to be saved:", JSON.stringify(staffMessageData));
    const savedStaffMessageDoc = await new Message_model_1.default(staffMessageData).save();
    console.log("Action: savedStaffMessageDoc from DB:", JSON.stringify(savedStaffMessageDoc));
    const savedMessageWithConvId = Object.assign(Object.assign({}, transformMessageDocToMessage(savedStaffMessageDoc)), { conversationId });
    console.log("Action: savedMessageWithConvId to be returned:", JSON.stringify(savedMessageWithConvId));
    await Customer_model_1.default.findByIdAndUpdate(customerId, {
        lastInteractionAt: new Date(),
        interactionStatus: 'replied_by_staff',
        lastMessagePreview: messageContent.substring(0, 100),
        lastMessageTimestamp: new Date(),
    });
    await Conversation_model_1.default.findByIdAndUpdate(conversationId, {
        $push: { messageIds: savedStaffMessageDoc._id },
        lastMessageTimestamp: savedStaffMessageDoc.timestamp,
        lastMessagePreview: savedStaffMessageDoc.content.substring(0, 100),
        $addToSet: { participants: { userId: staffSession.id, role: staffSession.role, name: staffSession.name, phoneNumber: staffSession.phoneNumber } }
    });
    return savedMessageWithConvId;
}
async function editStaffMessage(messageId, newContent, staffSession) {
    var _a, _b;
    await (0, mongodb_1.default)();
    const message = await Message_model_1.default.findById(messageId);
    if (!message) {
        throw new Error("Không tìm thấy tin nhắn.");
    }
    if (message.sender !== 'ai' || ((_a = message.userId) === null || _a === void 0 ? void 0 : _a.toString()) !== staffSession.id) {
        throw new Error("Bạn không có quyền chỉnh sửa tin nhắn này.");
    }
    message.content = newContent;
    message.updatedAt = new Date();
    await message.save();
    let conversationIdString = (_b = message.conversationId) === null || _b === void 0 ? void 0 : _b.toString();
    if (conversationIdString) {
        const conversation = await Conversation_model_1.default.findById(conversationIdString);
        if (conversation && conversation.lastMessageTimestamp && conversation.lastMessageTimestamp.getTime() <= message.timestamp.getTime()) {
            const lastMessageInConv = await Message_model_1.default.findOne({ conversationId: conversation._id }).sort({ timestamp: -1 });
            if (lastMessageInConv) {
                await Conversation_model_1.default.findByIdAndUpdate(conversation._id, {
                    lastMessagePreview: lastMessageInConv.content.substring(0, 100),
                    lastMessageTimestamp: lastMessageInConv.timestamp,
                });
            }
        }
    }
    //@ts-ignore
    if (message.customerId) {
        //@ts-ignore
        const customer = await Customer_model_1.default.findById(message.customerId);
        if (customer && customer.lastMessageTimestamp && message.updatedAt && customer.lastMessageTimestamp.getTime() <= message.timestamp.getTime()) {
            const lastMessageForCustomer = await Message_model_1.default.findOne({ customerId: customer._id, conversationId: conversationIdString ? new mongoose_1.Types.ObjectId(conversationIdString) : undefined }).sort({ timestamp: -1 });
            if (lastMessageForCustomer) {
                await Customer_model_1.default.findByIdAndUpdate(customer._id, {
                    lastMessagePreview: lastMessageForCustomer.content.substring(0, 100),
                    lastMessageTimestamp: lastMessageForCustomer.timestamp,
                });
            }
        }
    }
    return Object.assign(Object.assign({}, transformMessageDocToMessage(message)), { conversationId: conversationIdString });
}
async function deleteStaffMessage(messageId, staffSession) {
    var _a, _b, _c;
    await (0, mongodb_1.default)();
    const message = await Message_model_1.default.findById(messageId);
    if (!message) {
        throw new Error("Không tìm thấy tin nhắn.");
    }
    if (message.sender !== 'ai' || ((_a = message.userId) === null || _a === void 0 ? void 0 : _a.toString()) !== staffSession.id) {
        throw new Error("Bạn không có quyền xóa tin nhắn này.");
    }
    //@ts-ignore
    const customerIdString = (_b = message.customerId) === null || _b === void 0 ? void 0 : _b.toString();
    let conversationIdString = (_c = message.conversationId) === null || _c === void 0 ? void 0 : _c.toString();
    if (conversationIdString) {
        const conversation = await Conversation_model_1.default.findById(conversationIdString);
        if (conversation) {
            conversation.messageIds = conversation.messageIds.filter(id => !id.equals(new mongoose_1.default.Types.ObjectId(messageId)));
            conversation.pinnedMessageIds = (conversation.pinnedMessageIds || []).filter(id => !id.equals(new mongoose_1.default.Types.ObjectId(messageId)));
            const lastMessageInConv = await Message_model_1.default.findOne({
                conversationId: conversation._id,
                _id: { $ne: new mongoose_1.default.Types.ObjectId(messageId) }
            }).sort({ timestamp: -1 });
            if (lastMessageInConv) {
                conversation.lastMessagePreview = lastMessageInConv.content.substring(0, 100);
                conversation.lastMessageTimestamp = lastMessageInConv.timestamp;
            }
            else {
                conversation.lastMessagePreview = '';
                conversation.lastMessageTimestamp = conversation.createdAt;
            }
            await conversation.save();
        }
    }
    await Message_model_1.default.findByIdAndDelete(messageId);
    if (customerIdString) {
        const customer = await Customer_model_1.default.findById(customerIdString);
        if (customer) {
            const conversationsOfCustomer = await Conversation_model_1.default.find({ customerId: customer._id }).sort({ lastMessageTimestamp: -1 }).limit(1);
            if (conversationsOfCustomer.length > 0) {
                const latestConversation = conversationsOfCustomer[0];
                await Customer_model_1.default.findByIdAndUpdate(customerIdString, {
                    lastMessagePreview: latestConversation.lastMessagePreview,
                    lastMessageTimestamp: latestConversation.lastMessageTimestamp,
                });
            }
            else {
                await Customer_model_1.default.findByIdAndUpdate(customerIdString, {
                    lastMessagePreview: '',
                    lastMessageTimestamp: customer.createdAt,
                });
            }
        }
    }
    return { success: true, customerId: customerIdString, conversationId: conversationIdString };
}
// --- Q&A Management Actions ---
async function getKeywordMappings() {
    await (0, mongodb_1.default)();
    const docs = await KeywordMapping_model_1.default.find({}).sort({ createdAt: -1 });
    return docs.map(transformKeywordMappingDoc);
}
async function createKeywordMapping(data) {
    await (0, mongodb_1.default)();
    const newDoc = new KeywordMapping_model_1.default(data);
    await newDoc.save();
    return transformKeywordMappingDoc(newDoc);
}
async function updateKeywordMapping(id, data) {
    await (0, mongodb_1.default)();
    const updatedDoc = await KeywordMapping_model_1.default.findByIdAndUpdate(id, data, { new: true });
    return updatedDoc ? transformKeywordMappingDoc(updatedDoc) : null;
}
async function deleteKeywordMapping(id) {
    await (0, mongodb_1.default)();
    await KeywordMapping_model_1.default.findByIdAndDelete(id);
    return { success: true };
}
async function getTrainingDataItems() {
    await (0, mongodb_1.default)();
    const docs = await TrainingData_model_1.default.find({}).sort({ createdAt: -1 });
    return docs.map(transformTrainingDataDoc);
}
async function createTrainingData(data) {
    await (0, mongodb_1.default)();
    const newDoc = new TrainingData_model_1.default(Object.assign(Object.assign({}, data), { status: data.status || 'pending_review' }));
    await newDoc.save();
    return transformTrainingDataDoc(newDoc);
}
async function updateTrainingDataItem(id, data) {
    await (0, mongodb_1.default)();
    const updatedDoc = await TrainingData_model_1.default.findByIdAndUpdate(id, data, { new: true });
    return updatedDoc ? transformTrainingDataDoc(updatedDoc) : null;
}
async function deleteTrainingDataItem(id) {
    await (0, mongodb_1.default)();
    await TrainingData_model_1.default.findByIdAndDelete(id);
    return { success: true };
}
// --- Appointment Rule Management Actions ---
async function getAppointmentRules() {
    await (0, mongodb_1.default)();
    const docs = await AppointmentRule_model_1.default.find({}).sort({ name: 1 });
    return docs.map(transformAppointmentRuleDoc);
}
async function createAppointmentRule(data) {
    await (0, mongodb_1.default)();
    const newDoc = new AppointmentRule_model_1.default(data);
    await newDoc.save();
    return transformAppointmentRuleDoc(newDoc);
}
async function updateAppointmentRule(id, data) {
    await (0, mongodb_1.default)();
    const updatedDoc = await AppointmentRule_model_1.default.findByIdAndUpdate(id, data, { new: true });
    return updatedDoc ? transformAppointmentRuleDoc(updatedDoc) : null;
}
async function deleteAppointmentRule(id) {
    await (0, mongodb_1.default)();
    await AppointmentRule_model_1.default.findByIdAndDelete(id);
    return { success: true };
}
// --- Staff: Update Customer Internal Name ---
async function updateCustomerInternalName(customerId, internalName) {
    var _a, _b, _c;
    await (0, mongodb_1.default)();
    const customer = await Customer_model_1.default.findByIdAndUpdate(customerId, { internalName: internalName, lastInteractionAt: new Date() }, { new: true }).populate('assignedStaffId', 'name');
    if (!customer)
        throw new Error("Không tìm thấy khách hàng.");
    return {
        id: customer._id.toString(),
        phoneNumber: customer.phoneNumber,
        name: customer.name || `Người dùng ${customer.phoneNumber}`,
        internalName: customer.internalName,
        conversationIds: (customer.conversationIds || []).map(id => id.toString()),
        appointmentIds: (customer.appointmentIds || []).map(id => id.toString()),
        productIds: (customer.productIds || []).map(id => id.toString()),
        noteIds: (customer.noteIds || []).map(id => id.toString()),
        pinnedConversationIds: (customer.pinnedConversationIds || []).map(id => id.toString()),
        tags: customer.tags || [],
        assignedStaffId: (_b = (_a = customer.assignedStaffId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString(),
        assignedStaffName: (_c = customer.assignedStaffId) === null || _c === void 0 ? void 0 : _c.name,
        lastInteractionAt: new Date(customer.lastInteractionAt),
        createdAt: new Date(customer.createdAt),
        interactionStatus: customer.interactionStatus,
        lastMessagePreview: customer.lastMessagePreview,
        lastMessageTimestamp: customer.lastMessageTimestamp ? new Date(customer.lastMessageTimestamp) : undefined,
    };
}
// --- Appointment Management Actions ---
const NO_STAFF_MODAL_VALUE = "__NO_STAFF_ASSIGNED__";
async function getAppointments(filters = {}) {
    await (0, mongodb_1.default)();
    try {
        const query = {
            status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] }
        };
        if (filters.customerId) {
            query.customerId = new mongoose_1.default.Types.ObjectId(filters.customerId);
        }
        if (filters.date) {
            query.date = filters.date;
        }
        else if (filters.dates && filters.dates.length > 0) {
            query.date = { $in: filters.dates };
        }
        if (filters.staffId) {
            query.staffId = new mongoose_1.default.Types.ObjectId(filters.staffId);
        }
        const appointments = await Appointment_model_1.default.find(query)
            .populate('customerId', 'name phoneNumber')
            .populate('staffId', 'name')
            .sort({ date: 1, time: 1 })
            .lean();
        return appointments.map(appointment => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            return ({
                appointmentId: appointment._id.toString(),
                userId: (_b = (_a = appointment.customerId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString(),
                service: appointment.service,
                date: appointment.date,
                time: appointment.time,
                branch: appointment.branch || '',
                status: appointment.status,
                notes: appointment.notes || '',
                staffId: (_d = (_c = appointment.staffId) === null || _c === void 0 ? void 0 : _c._id) === null || _d === void 0 ? void 0 : _d.toString(),
                customerName: ((_e = appointment.customerId) === null || _e === void 0 ? void 0 : _e.name) || appointment.customerPhoneNumber || '',
                customerPhoneNumber: ((_f = appointment.customerId) === null || _f === void 0 ? void 0 : _f.phoneNumber) || '',
                staffName: ((_g = appointment.staffId) === null || _g === void 0 ? void 0 : _g.name) || '',
                recurrenceType: appointment.recurrenceType,
                recurrenceCount: appointment.recurrenceCount,
                createdAt: appointment.createdAt, // Keep as Date object
                updatedAt: appointment.updatedAt, // Keep as Date object
                // Ensure productId and branchId are converted to string
                productId: (_h = appointment.productId) === null || _h === void 0 ? void 0 : _h.toString(),
                branchId: (_j = appointment.branchId) === null || _j === void 0 ? void 0 : _j.toString(),
            });
        });
    }
    catch (error) {
        console.error('Error fetching appointments:', error);
        return [];
    }
}
async function deleteExistingAppointment(appointmentId) {
    await (0, mongodb_1.default)();
    try {
        const appointment = await Appointment_model_1.default.findById(appointmentId);
        if (!appointment) {
            throw new Error('Appointment not found');
        }
        // Update appointment status to cancelled
        appointment.status = 'cancelled';
        await appointment.save();
        // Remove appointment ID from customer's appointmentIds array
        await Customer_model_1.default.findByIdAndUpdate(appointment.customerId, { $pull: { appointmentIds: appointment._id } });
    }
    catch (error) {
        console.error('Error cancelling appointment:', error);
        throw error;
    }
}
async function createNewAppointment(data) {
    await (0, mongodb_1.default)();
    if (!mongoose_1.default.Types.ObjectId.isValid(data.customerId)) {
        throw new Error("Mã khách hàng không hợp lệ.");
    }
    const customer = await Customer_model_1.default.findById(data.customerId);
    if (!customer) {
        throw new Error("Không tìm thấy khách hàng.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        throw new Error("Định dạng ngày không hợp lệ. Phải là YYYY-MM-DD.");
    }
    const appointmentData = {
        customerId: new mongoose_1.default.Types.ObjectId(data.customerId),
        service: data.service,
        productId: data.productId ? new mongoose_1.default.Types.ObjectId(data.productId) : undefined,
        date: data.date,
        time: data.time,
        branch: data.branch,
        branchId: data.branchId ? new mongoose_1.default.Types.ObjectId(data.branchId) : undefined,
        status: data.status || 'booked',
        notes: data.notes,
        packageType: data.packageType,
        priority: data.priority,
        recurrenceType: data.recurrenceType || 'none',
        recurrenceCount: data.recurrenceCount || 1,
    };
    if (data.staffId && mongoose_1.default.Types.ObjectId.isValid(data.staffId) && data.staffId !== NO_STAFF_MODAL_VALUE) {
        appointmentData.staffId = new mongoose_1.default.Types.ObjectId(data.staffId);
    }
    else {
        delete appointmentData.staffId;
    }
    const newAppointmentDoc = new Appointment_model_1.default(appointmentData);
    await newAppointmentDoc.save();
    console.log("[ACTIONS] Manually created new appointment:", JSON.stringify(newAppointmentDoc));
    await Customer_model_1.default.findByIdAndUpdate(data.customerId, {
        $addToSet: { appointmentIds: newAppointmentDoc._id }
    });
    // Schedule reminder for the new appointment
    try {
        //@ts-ignore
        await appointmentReminder_service_1.AppointmentReminderService.scheduleReminder(newAppointmentDoc._id);
    }
    catch (error) {
        console.error(`Failed to schedule reminder for appointment ${newAppointmentDoc._id}:`, error);
    }
    const populatedAppointment = await Appointment_model_1.default.findById(newAppointmentDoc._id)
        .populate('customerId', 'name phoneNumber')
        .populate('staffId', 'name');
    if (!populatedAppointment)
        throw new Error("Không thể tạo hoặc tìm lại lịch hẹn.");
    return transformAppointmentDocToDetails(populatedAppointment);
}
async function updateExistingAppointment(appointmentId, data) {
    await (0, mongodb_1.default)();
    if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        throw new Error("Định dạng ngày không hợp lệ khi cập nhật. Phải là YYYY-MM-DD.");
    }
    const updateData = Object.assign(Object.assign({}, data), { updatedAt: new Date() });
    delete updateData.customerId;
    delete updateData.userId;
    if (data.staffId && mongoose_1.default.Types.ObjectId.isValid(data.staffId) && data.staffId !== NO_STAFF_MODAL_VALUE) {
        updateData.staffId = new mongoose_1.default.Types.ObjectId(data.staffId);
    }
    else if (data.staffId === null || data.staffId === '' || data.staffId === undefined || data.staffId === NO_STAFF_MODAL_VALUE) {
        if (!updateData.$unset)
            updateData.$unset = {};
        updateData.$unset.staffId = "";
        delete updateData.staffId;
    }
    if (data.recurrenceType)
        updateData.recurrenceType = data.recurrenceType;
    if (data.recurrenceCount)
        updateData.recurrenceCount = data.recurrenceCount;
    const updatedAppointmentDoc = await Appointment_model_1.default.findByIdAndUpdate(appointmentId, updateData, { new: true })
        .populate('customerId', 'name phoneNumber')
        .populate('staffId', 'name');
    console.log("[ACTIONS] Manually updated appointment:", appointmentId, "with data:", JSON.stringify(updateData), "Result:", JSON.stringify(updatedAppointmentDoc));
    return updatedAppointmentDoc ? transformAppointmentDocToDetails(updatedAppointmentDoc) : null;
}
async function getCustomerListForSelect() {
    await (0, mongodb_1.default)();
    const customers = await Customer_model_1.default.find({}, 'name phoneNumber').sort({ name: 1 });
    return customers.map(c => ({
        id: c._id.toString(),
        name: c.name || `Người dùng ${c.phoneNumber}`,
        phoneNumber: c.phoneNumber
    }));
}
// --- Dashboard Actions ---
async function getAdminDashboardStats() {
    await (0, mongodb_1.default)();
    const todayStart = (0, date_fns_1.startOfDay)(new Date());
    const todayEnd = (0, date_fns_1.endOfDay)(new Date());
    const sevenDaysAgo = (0, date_fns_1.subDays)(new Date(), 7);
    const activeUserCount = await Customer_model_1.default.countDocuments({ lastInteractionAt: { $gte: sevenDaysAgo } });
    const chatsTodayCount = await Message_model_1.default.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd } });
    const openIssuesCount = await Customer_model_1.default.countDocuments({ tags: "Cần hỗ trợ" });
    const recentAppointmentsDocs = await Appointment_model_1.default.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('customerId', 'name phoneNumber')
        .populate('staffId', 'name');
    const recentCustomersDocs = await Customer_model_1.default.find({}).sort({ createdAt: -1 }).limit(5);
    return {
        activeUserCount,
        chatsTodayCount,
        openIssuesCount,
        recentAppointments: recentAppointmentsDocs.map(transformAppointmentDocToDetails),
        recentCustomers: recentCustomersDocs.map(doc => ({
            id: doc._id.toString(),
            name: doc.name || `Người dùng ${doc.phoneNumber}`,
            phoneNumber: doc.phoneNumber,
            createdAt: new Date(doc.createdAt),
        })),
        systemStatus: 'Optimal',
    };
}
async function getStaffDashboardStats(staffId) {
    await (0, mongodb_1.default)();
    const todayStart = (0, date_fns_1.startOfDay)(new Date());
    const todayEnd = (0, date_fns_1.endOfDay)(new Date());
    const todayDateString = (0, date_fns_1.formatISO)(todayStart, { representation: 'date' });
    const activeChatsAssignedToMeCount = await Customer_model_1.default.countDocuments({
        assignedStaffId: new mongoose_1.default.Types.ObjectId(staffId),
        lastInteractionAt: { $gte: todayStart, $lt: todayEnd },
    });
    const myAppointmentsTodayCount = await Appointment_model_1.default.countDocuments({
        staffId: new mongoose_1.default.Types.ObjectId(staffId),
        date: todayDateString,
        status: { $nin: ['cancelled', 'completed'] }
    });
    const totalAssignedToMeCount = await Customer_model_1.default.countDocuments({ assignedStaffId: new mongoose_1.default.Types.ObjectId(staffId) });
    return {
        activeChatsAssignedToMeCount,
        myAppointmentsTodayCount,
        totalAssignedToMeCount,
    };
}
// --- Note CRUD Actions ---
async function addNoteToCustomer(customerId, staffId, content, imageDataUri, imageFileName) {
    await (0, mongodb_1.default)();
    console.log("[addNoteToCustomer] Called with:", { customerId, staffId, contentPresent: !!content, imagePresent: !!imageDataUri });
    if (!mongoose_1.default.Types.ObjectId.isValid(customerId) || !mongoose_1.default.Types.ObjectId.isValid(staffId)) {
        console.error("[addNoteToCustomer] Invalid customer or staff ID.");
        throw new Error("Invalid customer or staff ID.");
    }
    if (!(content === null || content === void 0 ? void 0 : content.trim()) && !imageDataUri) {
        console.error("[addNoteToCustomer] Note must have content or image.");
        throw new Error("Ghi chú phải có nội dung văn bản hoặc hình ảnh.");
    }
    try {
        const noteDoc = new Note_model_1.default({
            customerId: new mongoose_1.default.Types.ObjectId(customerId),
            staffId: new mongoose_1.default.Types.ObjectId(staffId),
            content: content === null || content === void 0 ? void 0 : content.trim(),
            imageDataUri,
            imageFileName,
        });
        await noteDoc.save();
        console.log("[addNoteToCustomer] Note saved, ID:", noteDoc._id);
        await Customer_model_1.default.findByIdAndUpdate(customerId, { $push: { noteIds: noteDoc._id } });
        console.log("[addNoteToCustomer] Customer updated with new note ID.");
        const populatedNote = await Note_model_1.default.findById(noteDoc._id).populate('staffId', 'name');
        if (!populatedNote) {
            console.error("[addNoteToCustomer] Failed to retrieve populated note after saving.");
            throw new Error("Failed to create or retrieve note.");
        }
        return transformNoteDocToNote(populatedNote);
    }
    catch (error) {
        console.error("[addNoteToCustomer] Error during note creation or update:", error);
        // Throw a more generic error or re-throw, depending on desired client feedback
        throw new Error(`Không thể thêm ghi chú: ${error.message || 'Lỗi không xác định từ server.'}`);
    }
}
async function getNotesForCustomer(customerId) {
    await (0, mongodb_1.default)();
    const noteDocs = await Note_model_1.default.find({ customerId: new mongoose_1.default.Types.ObjectId(customerId) })
        .populate('staffId', 'name')
        .sort({ createdAt: -1 });
    return noteDocs.map(transformNoteDocToNote);
}
async function updateCustomerNote(noteId, staffId, content, imageDataUri, imageFileName) {
    await (0, mongodb_1.default)();
    const note = await Note_model_1.default.findById(noteId);
    if (!note)
        throw new Error("Note not found.");
    const staffUser = await User_model_1.default.findById(staffId);
    if (!staffUser)
        throw new Error("Staff user not found.");
    if (staffUser.role !== 'admin' && note.staffId.toString() !== staffId) {
        throw new Error("You are not authorized to edit this note.");
    }
    const trimmedContent = content === null || content === void 0 ? void 0 : content.trim();
    if (!trimmedContent && imageDataUri === null && !note.imageDataUri) { // If trying to remove image and no text is left
        throw new Error("Ghi chú phải có nội dung văn bản hoặc hình ảnh.");
    }
    if (!trimmedContent && !imageDataUri && !note.imageDataUri) { // If all content is empty
        throw new Error("Ghi chú phải có nội dung văn bản hoặc hình ảnh.");
    }
    note.content = trimmedContent;
    if (imageDataUri === null) {
        note.imageDataUri = undefined;
        note.imageFileName = undefined;
    }
    else if (imageDataUri) {
        note.imageDataUri = imageDataUri;
        //@ts-ignore
        note.imageFileName = imageFileName;
    }
    await note.save();
    const populatedNote = await Note_model_1.default.findById(note._id).populate('staffId', 'name');
    return populatedNote ? transformNoteDocToNote(populatedNote) : null;
}
async function deleteCustomerNote(noteId, staffId) {
    await (0, mongodb_1.default)();
    const note = await Note_model_1.default.findById(noteId);
    if (!note)
        throw new Error("Note not found.");
    const staffUser = await User_model_1.default.findById(staffId);
    if (!staffUser)
        throw new Error("Staff user not found.");
    if (staffUser.role !== 'admin' && note.staffId.toString() !== staffId) {
        throw new Error("You are not authorized to delete this note.");
    }
    await Note_model_1.default.findByIdAndDelete(noteId);
    await Customer_model_1.default.findByIdAndUpdate(note.customerId, { $pull: { noteIds: noteId } });
    return { success: true };
}
function transformProductDocToProduct(doc) {
    return {
        id: doc._id.toString(),
        name: doc.name,
        description: doc.description,
        price: doc.price,
        category: doc.category,
        imageUrl: doc.imageUrl,
        isActive: doc.isActive,
        isSchedulable: doc.isSchedulable,
        schedulingRules: doc.schedulingRules, // Assuming direct mapping is okay, adjust if needed
        defaultSessions: doc.defaultSessions,
        expiryDays: doc.expiryDays,
        expiryReminderTemplate: doc.expiryReminderTemplate,
        expiryReminderDaysBefore: doc.expiryReminderDaysBefore,
        type: doc.type, // Cast to the new type
        expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null, // Include expiryDate and handle null
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
    };
}
function transformReminderDocToReminder(doc) {
    const staffName = doc.staffId && typeof doc.staffId === 'object' && 'name' in doc.staffId
        ? doc.staffId.name
        : undefined;
    const customerName = doc.customerId && typeof doc.customerId === 'object' && 'name' in doc.customerId
        ? doc.customerId.name || `Người dùng ${doc.customerId.phoneNumber}`
        : undefined;
    return {
        id: doc._id.toString(),
        customerId: typeof doc.customerId === 'string' ? doc.customerId : doc.customerId._id.toString(),
        staffId: typeof doc.staffId === 'string' ? doc.staffId : doc.staffId._id.toString(),
        customerName,
        staffName,
        title: doc.title,
        description: doc.description,
        dueDate: new Date(doc.dueDate),
        status: doc.status,
        priority: doc.priority,
        completedAt: doc.completedAt ? new Date(doc.completedAt) : undefined,
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
        reminderType: doc.reminderType, // Include reminderType
        interval: doc.interval, // Include interval
    }; // Explicitly cast to Reminder
}
async function getAllProducts() {
    await (0, mongodb_1.default)();
    try {
        const products = await Product_model_1.default.find({}).lean();
        return products.map(transformProductDocToProduct);
    }
    catch (error) {
        console.error("Error fetching all products:", error);
        throw new Error("Failed to fetch products.");
    }
}
async function getProductById(productId) {
    await (0, mongodb_1.default)();
    const product = await Product_model_1.default.findById(productId).lean(); // Add .lean()
    return product ? transformProductDocToProduct(product) : null;
}
async function createProduct(data) {
    await (0, mongodb_1.default)();
    try {
        const newProduct = new Product_model_1.default(Object.assign(Object.assign({}, data), { 
            // Ensure new fields are included
            type: data.type, expiryDate: data.expiryDate || null }));
        const savedProduct = await newProduct.save();
        return transformProductDocToProduct(savedProduct);
    }
    catch (error) {
        console.error("Error creating product:", error);
        throw new Error("Failed to create product.");
    }
}
async function updateProduct(productId, data) {
    await (0, mongodb_1.default)();
    try {
        const updatePayload = Object.assign(Object.assign({}, data), { updatedAt: new Date() });
        // Explicitly set type if it exists in data to handle potential undefined from Partial
        if (data.type !== undefined) {
            updatePayload.type = data.type;
        }
        // Explicitly set expiryDate if it exists in data (can be null)
        if (data.expiryDate !== undefined) {
            updatePayload.expiryDate = data.expiryDate;
        }
        const updatedProduct = await Product_model_1.default.findByIdAndUpdate(productId, updatePayload, { new: true }).lean();
        if (!updatedProduct) {
            return null;
        }
        return transformProductDocToProduct(updatedProduct);
    }
    catch (error) {
        console.error(`Error updating product ${productId}:`, error);
        throw new Error("Failed to update product.");
    }
}
async function deleteProduct(productId) {
    await (0, mongodb_1.default)();
    const result = await Product_model_1.default.findByIdAndDelete(productId);
    return { success: !!result };
}
async function getAllReminders(filters = {}) {
    await (0, mongodb_1.default)();
    const query = {};
    if (filters.staffId)
        query.staffId = filters.staffId;
    if (filters.customerId)
        query.customerId = filters.customerId;
    if (filters.status)
        query.status = filters.status;
    if (filters.dueBefore || filters.dueAfter) {
        query.dueDate = {};
        if (filters.dueBefore)
            query.dueDate.$lte = filters.dueBefore;
        if (filters.dueAfter)
            query.dueDate.$gte = filters.dueAfter;
    }
    const reminders = await Reminder_model_1.default.find(query)
        .populate('customerId', 'name phoneNumber')
        .populate('staffId', 'name')
        .sort({ dueDate: 1 });
    return reminders.map(transformReminderDocToReminder);
}
async function getReminderById(reminderId) {
    await (0, mongodb_1.default)();
    const reminder = await Reminder_model_1.default.findById(reminderId)
        .populate('customerId', 'name phoneNumber')
        .populate('staffId', 'name');
    return reminder ? transformReminderDocToReminder(reminder) : null;
}
async function createReminder(data) {
    await (0, mongodb_1.default)();
    const newReminder = new Reminder_model_1.default(data);
    const savedReminder = await newReminder.save();
    const populatedReminder = await Reminder_model_1.default.findById(savedReminder._id)
        .populate('customerId', 'name phoneNumber')
        .populate('staffId', 'name');
    if (!populatedReminder)
        throw new Error("Failed to populate created reminder");
    return transformReminderDocToReminder(populatedReminder);
}
async function updateReminder(reminderId, data) {
    await (0, mongodb_1.default)();
    if (data.status === 'completed' && !data.completedAt) {
        data.completedAt = new Date();
    }
    const updatedReminderDoc = await Reminder_model_1.default.findByIdAndUpdate(reminderId, { $set: data }, { new: true })
        .populate('customerId', 'name phoneNumber')
        .populate('staffId', 'name');
    return updatedReminderDoc ? transformReminderDocToReminder(updatedReminderDoc) : null;
}
async function deleteReminder(reminderId) {
    await (0, mongodb_1.default)();
    const result = await Reminder_model_1.default.findByIdAndDelete(reminderId);
    return { success: !!result };
}
async function getUpcomingRemindersForStaff(staffId) {
    await (0, mongodb_1.default)();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfNextWeek = new Date(today);
    endOfNextWeek.setDate(today.getDate() + 7);
    endOfNextWeek.setHours(23, 59, 59, 999);
    const reminders = await Reminder_model_1.default.find({
        staffId,
        status: 'pending',
        dueDate: { $gte: today, $lte: endOfNextWeek }
    })
        .populate('customerId', 'name phoneNumber')
        .populate('staffId', 'name')
        .sort({ dueDate: 1 });
    return reminders.map(transformReminderDocToReminder);
}
async function getOverdueRemindersForStaff(staffId) {
    await (0, mongodb_1.default)();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminders = await Reminder_model_1.default.find({
        staffId,
        status: 'pending',
        dueDate: { $lt: today }
    })
        .populate('customerId', 'name phoneNumber')
        .populate('staffId', 'name')
        .sort({ dueDate: 1 });
    return reminders.map(transformReminderDocToReminder);
}
async function getCustomersWithProductsAndReminders(staffId) {
    var _a, _b, _c;
    await (0, mongodb_1.default)();
    const query = {};
    if (staffId) {
        query.$or = [
            { assignedStaffId: new mongoose_1.default.Types.ObjectId(staffId) },
            { assignedStaffId: { $exists: false } }
        ];
    }
    const customers = await Customer_model_1.default.find(query)
        .populate('assignedStaffId', 'name')
        .sort({ lastInteractionAt: -1 });
    const result = [];
    for (const customer of customers) {
        const pendingRemindersCount = await Reminder_model_1.default.countDocuments({
            customerId: customer._id,
            status: 'pending'
        });
        result.push({
            id: customer._id.toString(),
            name: customer.name || `Người dùng ${customer.phoneNumber}`,
            phoneNumber: customer.phoneNumber,
            internalName: customer.internalName,
            lastInteractionAt: customer.lastInteractionAt,
            tags: customer.tags || [],
            assignedStaffId: (_b = (_a = customer.assignedStaffId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString(),
            assignedStaffName: (_c = customer.assignedStaffId) === null || _c === void 0 ? void 0 : _c.name,
            pendingRemindersCount,
            interactionStatus: customer.interactionStatus,
            lastMessagePreview: customer.lastMessagePreview,
            lastMessageTimestamp: customer.lastMessageTimestamp ? new Date(customer.lastMessageTimestamp) : undefined,
        });
    }
    return result;
}
async function getAllCustomerTags() {
    await (0, mongodb_1.default)();
    try {
        const tags = await Customer_model_1.default.distinct('tags');
        return tags.filter(tag => typeof tag === 'string' && tag.trim() !== '');
    }
    catch (error) {
        console.error("Error fetching all customer tags:", error);
        return [];
    }
}
async function pinMessageToConversation(conversationId, messageId, userSession) {
    var _a, _b;
    await (0, mongodb_1.default)();
    if (!mongoose_1.default.Types.ObjectId.isValid(conversationId) || !mongoose_1.default.Types.ObjectId.isValid(messageId)) {
        throw new Error("Mã cuộc trò chuyện hoặc tin nhắn không hợp lệ.");
    }
    const conversation = await Conversation_model_1.default.findById(conversationId);
    if (!conversation)
        throw new Error("Không tìm thấy cuộc trò chuyện.");
    // Kiểm tra quyền ghim tin nhắn
    let hasPermission = false;
    // Admin luôn có quyền
    if (userSession.role === 'admin') {
        hasPermission = true;
    }
    // Staff có quyền nếu là người tham gia cuộc trò chuyện
    //@ts-ignore
    else if (userSession.role === 'staff') {
        //@ts-ignore
        hasPermission = ((_a = conversation.participants) === null || _a === void 0 ? void 0 : _a.some(p => { var _a; return ((_a = p.userId) === null || _a === void 0 ? void 0 : _a.toString()) === userSession.id; })) || false;
    }
    // Customer có quyền nếu là chủ cuộc trò chuyện
    else if (userSession.role === 'customer') {
        hasPermission = conversation.customerId.toString() === userSession.id;
    }
    if (!hasPermission) {
        throw new Error("Bạn không có quyền ghim tin nhắn trong cuộc trò chuyện này.");
    }
    const messageObjectId = new mongoose_1.default.Types.ObjectId(messageId);
    let newPinnedMessageIds = [...(conversation.pinnedMessageIds || [])];
    const isAlreadyPinned = newPinnedMessageIds.some(id => id.equals(messageObjectId));
    if (!isAlreadyPinned) {
        if (newPinnedMessageIds.length >= 3) {
            newPinnedMessageIds.shift();
        }
        newPinnedMessageIds.push(messageObjectId);
    }
    conversation.pinnedMessageIds = newPinnedMessageIds;
    await conversation.save();
    // Return only the message IDs as strings instead of the full populated messages
    return Object.assign(Object.assign({}, conversation.toObject()), { 
        //@ts-ignore
        id: conversation._id.toString(), customerId: conversation.customerId.toString(), 
        //@ts-ignore
        staffId: (_b = conversation.staffId) === null || _b === void 0 ? void 0 : _b.toString(), messageIds: conversation.messageIds.map(id => id.toString()), pinnedMessageIds: conversation.pinnedMessageIds.map(id => id.toString()), 
        //@ts-ignore
        participants: (conversation.participants || []).map(p => {
            var _a;
            return (Object.assign(Object.assign({}, p), { userId: ((_a = p.userId) === null || _a === void 0 ? void 0 : _a.toString()) || '' }));
        }), createdAt: new Date(conversation.createdAt), updatedAt: new Date(conversation.updatedAt), lastMessageTimestamp: conversation.lastMessageTimestamp ? new Date(conversation.lastMessageTimestamp) : undefined });
}
async function unpinMessageFromConversation(conversationId, messageId, userSession) {
    var _a;
    await (0, mongodb_1.default)();
    if (!mongoose_1.default.Types.ObjectId.isValid(conversationId) || !mongoose_1.default.Types.ObjectId.isValid(messageId)) {
        throw new Error("Mã cuộc trò chuyện hoặc tin nhắn không hợp lệ.");
    }
    const conversation = await Conversation_model_1.default.findById(conversationId);
    if (!conversation)
        throw new Error("Không tìm thấy cuộc trò chuyện.");
    // Kiểm tra quyền bỏ ghim tin nhắn
    let hasPermission = false;
    // Admin luôn có quyền
    if (userSession.role === 'admin') {
        hasPermission = true;
    }
    // Staff có quyền nếu là người tham gia cuộc trò chuyện
    else if (userSession.role === 'staff') {
        //@ts-ignore
        hasPermission = ((_a = conversation.participants) === null || _a === void 0 ? void 0 : _a.some(p => { var _a; return ((_a = p.userId) === null || _a === void 0 ? void 0 : _a.toString()) === userSession.id; })) || false;
    }
    // Customer có quyền nếu là chủ cuộc trò chuyện
    else if (userSession.role === 'customer') {
        hasPermission = conversation.customerId.toString() === userSession.id;
    }
    if (!hasPermission) {
        throw new Error("Bạn không có quyền bỏ ghim tin nhắn trong cuộc trò chuyện này.");
    }
    const messageObjectId = new mongoose_1.default.Types.ObjectId(messageId);
    conversation.pinnedMessageIds = (conversation.pinnedMessageIds || []).filter(id => !id.equals(messageObjectId));
    await conversation.save();
    // Return the updated conversation with populated messages
    const updatedConversation = await Conversation_model_1.default.findById(conversationId)
        .populate({
        path: 'messageIds',
        model: Message_model_1.default,
        options: { sort: { timestamp: 1 } }
    })
        .populate({
        path: 'pinnedMessageIds',
        model: Message_model_1.default
    });
    return transformConversationDoc(updatedConversation);
}
async function getMessagesByIds(messageIds) {
    await (0, mongodb_1.default)();
    const objectIds = messageIds.map(id => {
        try {
            return new mongoose_1.default.Types.ObjectId(id);
        }
        catch (e) {
            console.warn(`Invalid ObjectId string for message: ${id}`);
            return null;
        }
    }).filter(id => id !== null);
    if (objectIds.length === 0)
        return [];
    const messageDocs = await Message_model_1.default.find({ _id: { $in: objectIds } });
    const messagesMap = new Map(messageDocs.map(doc => [doc._id.toString(), transformMessageDocToMessage(doc)]));
    return messageIds.map(id => messagesMap.get(id)).filter(Boolean);
}
// --- Media History Actions ---
async function getCustomerMediaMessages(customerId) {
    await (0, mongodb_1.default)();
    const messages = await Message_model_1.default.find({
        customerId: new mongoose_1.default.Types.ObjectId(customerId),
        content: { $regex: /^data:(image\/(jpeg|png|gif|webp|svg\+xml)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|plain|rtf|zip|x-rar-compressed|octet-stream))/ }
    }).sort({ timestamp: -1 });
    return messages.map(transformMessageDocToMessage);
}
async function updateConversationTitle(conversationId, newTitle, userId) {
    await (0, mongodb_1.default)();
    if (!mongoose_1.default.Types.ObjectId.isValid(conversationId) || !mongoose_1.default.Types.ObjectId.isValid(userId)) {
        throw new Error("Mã cuộc trò chuyện hoặc người dùng không hợp lệ.");
    }
    const conversation = await Conversation_model_1.default.findById(conversationId);
    if (!conversation) {
        throw new Error("Không tìm thấy cuộc trò chuyện.");
    }
    //@ts-ignore
    const isParticipant = conversation.participants.some(p => { var _a; return ((_a = p.userId) === null || _a === void 0 ? void 0 : _a.toString()) === userId; });
    let userIsAdmin = false;
    if (!isParticipant) {
        const user = await User_model_1.default.findById(userId);
        if (user && user.role === 'admin') {
            userIsAdmin = true;
        }
    }
    if (!isParticipant && !userIsAdmin) {
        throw new Error("Bạn không có quyền chỉnh sửa tiêu đề cuộc trò chuyện này.");
    }
    //@ts-ignore
    conversation.title = newTitle;
    await conversation.save();
    return transformConversationDoc(conversation);
}
async function pinConversationForUser(userId, conversationId) {
    var _a, _b, _c;
    await (0, mongodb_1.default)();
    if (!mongoose_1.default.Types.ObjectId.isValid(userId) || !mongoose_1.default.Types.ObjectId.isValid(conversationId)) {
        throw new Error("Mã người dùng hoặc cuộc trò chuyện không hợp lệ.");
    }
    const customer = await Customer_model_1.default.findById(userId);
    if (!customer)
        throw new Error("Không tìm thấy khách hàng.");
    let newPinnedConversationIds = [...(customer.pinnedConversationIds || [])];
    const conversationObjectId = new mongoose_1.default.Types.ObjectId(conversationId);
    if (!newPinnedConversationIds.some(id => id.equals(conversationObjectId))) {
        if (newPinnedConversationIds.length >= 3) {
            newPinnedConversationIds.shift();
        }
        newPinnedConversationIds.push(conversationObjectId);
    }
    customer.pinnedConversationIds = newPinnedConversationIds;
    await customer.save();
    const updatedCustomer = await Customer_model_1.default.findById(userId).populate('assignedStaffId', 'name');
    if (!updatedCustomer)
        return null;
    return {
        id: updatedCustomer._id.toString(),
        phoneNumber: updatedCustomer.phoneNumber,
        name: updatedCustomer.name || `Người dùng ${updatedCustomer.phoneNumber}`,
        internalName: updatedCustomer.internalName,
        conversationIds: (updatedCustomer.conversationIds || []).map(id => id.toString()),
        appointmentIds: (updatedCustomer.appointmentIds || []).map(id => id.toString()),
        productIds: (updatedCustomer.productIds || []).map(id => id.toString()),
        noteIds: (updatedCustomer.noteIds || []).map(id => id.toString()),
        pinnedConversationIds: (updatedCustomer.pinnedConversationIds || []).map(id => id.toString()),
        tags: updatedCustomer.tags || [],
        assignedStaffId: (_b = (_a = updatedCustomer.assignedStaffId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString(),
        assignedStaffName: (_c = updatedCustomer.assignedStaffId) === null || _c === void 0 ? void 0 : _c.name,
        lastInteractionAt: new Date(updatedCustomer.lastInteractionAt),
        createdAt: new Date(updatedCustomer.createdAt),
        interactionStatus: updatedCustomer.interactionStatus,
        lastMessagePreview: updatedCustomer.lastMessagePreview,
        lastMessageTimestamp: updatedCustomer.lastMessageTimestamp ? new Date(updatedCustomer.lastMessageTimestamp) : undefined,
    };
}
async function unpinConversationForUser(userId, conversationId) {
    var _a, _b, _c;
    await (0, mongodb_1.default)();
    if (!mongoose_1.default.Types.ObjectId.isValid(userId) || !mongoose_1.default.Types.ObjectId.isValid(conversationId)) {
        throw new Error("Mã người dùng hoặc cuộc trò chuyện không hợp lệ.");
    }
    const conversationObjectId = new mongoose_1.default.Types.ObjectId(conversationId);
    const updatedCustomer = await Customer_model_1.default.findByIdAndUpdate(userId, { $pull: { pinnedConversationIds: conversationObjectId } }, { new: true }).populate('assignedStaffId', 'name');
    if (!updatedCustomer)
        return null;
    return {
        id: updatedCustomer._id.toString(),
        phoneNumber: updatedCustomer.phoneNumber,
        name: updatedCustomer.name || `Người dùng ${updatedCustomer.phoneNumber}`,
        internalName: updatedCustomer.internalName,
        conversationIds: (updatedCustomer.conversationIds || []).map(id => id.toString()),
        appointmentIds: (updatedCustomer.appointmentIds || []).map(id => id.toString()),
        productIds: (updatedCustomer.productIds || []).map(id => id.toString()),
        noteIds: (updatedCustomer.noteIds || []).map(id => id.toString()),
        pinnedConversationIds: (updatedCustomer.pinnedConversationIds || []).map(id => id.toString()),
        tags: updatedCustomer.tags || [],
        assignedStaffId: (_b = (_a = updatedCustomer.assignedStaffId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString(),
        assignedStaffName: (_c = updatedCustomer.assignedStaffId) === null || _c === void 0 ? void 0 : _c.name,
        lastInteractionAt: new Date(updatedCustomer.lastInteractionAt),
        createdAt: new Date(updatedCustomer.createdAt),
        interactionStatus: updatedCustomer.interactionStatus,
        lastMessagePreview: updatedCustomer.lastMessagePreview,
        lastMessageTimestamp: updatedCustomer.lastMessageTimestamp ? new Date(updatedCustomer.lastMessageTimestamp) : undefined,
    };
}
// Branch Management Actions
function transformBranchDoc(doc) {
    if (!doc)
        return null;
    return {
        id: doc._id.toString(),
        name: doc.name,
        address: doc.address,
        contactInfo: doc.contactInfo,
        isActive: doc.isActive,
        workingHours: doc.workingHours,
        offDays: doc.offDays,
        numberOfStaff: doc.numberOfStaff,
        specificDayOverrides: (doc.specificDayOverrides || []).map(r => {
            var _a;
            return ({
                id: ((_a = r._id) === null || _a === void 0 ? void 0 : _a.toString()) || new mongoose_1.default.Types.ObjectId().toString(),
                date: r.date,
                isOff: r.isOff,
                workingHours: r.workingHours,
                numberOfStaff: r.numberOfStaff,
            });
        }),
        //@ts-ignore
        createdAt: new Date(doc.createdAt),
        //@ts-ignore
        updatedAt: new Date(doc.updatedAt),
    };
}
async function createBranch(data) {
    await (0, mongodb_1.default)();
    const newBranch = new Branch_model_1.default(data);
    const savedBranch = await newBranch.save();
    const transformed = transformBranchDoc(savedBranch);
    if (!transformed)
        throw new Error("Could not transform created branch.");
    return transformed;
}
async function getBranches(activeOnly = false) {
    await (0, mongodb_1.default)();
    const query = activeOnly ? { isActive: true } : {};
    const branchDocs = await Branch_model_1.default.find(query).sort({ name: 1 });
    return branchDocs.map(transformBranchDoc).filter(Boolean);
}
async function updateBranch(id, data) {
    await (0, mongodb_1.default)();
    const processedData = Object.assign({}, data);
    if (processedData.specificDayOverrides) {
        processedData.specificDayOverrides = processedData.specificDayOverrides.map(rule => {
            const { id: ruleId } = rule, restOfRule = __rest(rule, ["id"]);
            return restOfRule;
        });
    }
    const updatedBranch = await Branch_model_1.default.findByIdAndUpdate(id, { $set: processedData }, { new: true, runValidators: true });
    return transformBranchDoc(updatedBranch);
}
async function deleteBranch(id) {
    await (0, mongodb_1.default)();
    const appointmentUsingBranch = await Appointment_model_1.default.findOne({ branchId: id });
    if (appointmentUsingBranch) {
        throw new Error("Không thể xóa chi nhánh vì đang được sử dụng trong lịch hẹn.");
    }
    const result = await Branch_model_1.default.findByIdAndDelete(id);
    return { success: !!result };
}
// --- Quick Reply Actions ---
function transformQuickReplyDoc(doc) {
    return {
        id: doc._id.toString(),
        title: doc.title,
        content: doc.content,
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
    };
}
async function getQuickReplies() {
    await (0, mongodb_1.default)();
    const quickReplies = await QuickReply_model_1.default.find({}).sort({ title: 1 });
    return quickReplies.map(transformQuickReplyDoc);
}
async function createQuickReply(data) {
    await (0, mongodb_1.default)();
    const newQuickReply = new QuickReply_model_1.default(data);
    const savedQuickReply = await newQuickReply.save();
    return transformQuickReplyDoc(savedQuickReply);
}
async function updateQuickReply(id, data) {
    await (0, mongodb_1.default)();
    const updatedQuickReply = await QuickReply_model_1.default.findByIdAndUpdate(id, { $set: data }, { new: true });
    return updatedQuickReply ? transformQuickReplyDoc(updatedQuickReply) : null;
}
async function deleteQuickReply(id) {
    await (0, mongodb_1.default)();
    const result = await QuickReply_model_1.default.findByIdAndDelete(id);
    return { success: !!result };
}
async function createSystemMessage({ conversationId, content }) {
    await (0, mongodb_1.default)();
    const message = await Message_model_1.default.create({
        conversationId,
        content,
        type: 'system',
        sender: 'system',
        timestamp: new Date(),
        isRead: false
    });
    // Update conversation with new message
    await Conversation_model_1.default.findByIdAndUpdate(conversationId, {
        $push: { messageIds: message._id },
        lastMessageTimestamp: message.timestamp,
        lastMessagePreview: message.content.substring(0, 100)
    });
    return {
        //@ts-ignore
        //@ts-ignore
        id: message._id.toString(),
        sender: message.sender,
        content: message.content,
        timestamp: message.timestamp,
        type: message.type,
        isRead: message.isRead,
        conversationId: message.conversationId.toString()
    };
}
async function cancelAppointment(appointmentId, userSession) {
    await (0, mongodb_1.default)();
    const appointment = await Appointment_model_1.default.findById(appointmentId);
    if (!appointment) {
        throw new Error("Không tìm thấy lịch hẹn.");
    }
    // Cancel any pending reminders
    await appointmentReminder_service_1.AppointmentReminderService.cancelReminder(appointmentId);
    appointment.status = 'cancelled';
    await appointment.save();
    return true;
}
async function getPinnedMessagesForConversation(conversationId) {
    await (0, mongodb_1.default)();
    if (!mongoose_1.default.Types.ObjectId.isValid(conversationId)) {
        throw new Error("Mã cuộc trò chuyện không hợp lệ.");
    }
    const conversation = await Conversation_model_1.default.findById(conversationId)
        .populate({
        path: 'pinnedMessageIds',
        model: Message_model_1.default,
        options: { sort: { timestamp: -1 } }
    });
    if (!conversation) {
        throw new Error("Không tìm thấy cuộc trò chuyện.");
    }
    return conversation.pinnedMessageIds.map(transformMessageDocToMessage);
}
