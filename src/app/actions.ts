// src/app/actions.ts
'use server';

import type { Message, UserSession, AppointmentDetails, Product, Note, CustomerProfile, UserRole, KeywordMapping, TrainingData, TrainingDataStatus, AppSettings, GetAppointmentsFilters, AdminDashboardStats, StaffDashboardStats, ProductItem, Reminder, ReminderStatus, ReminderPriority, SpecificDayRule, CustomerInteractionStatus, Conversation, AppointmentBookingFormData, Branch, BranchSpecificDayRule, QuickReplyType, ProductSchedulingRules, EffectiveSchedulingRules } from '@/lib/types';
import type { AppointmentRule as LibAppointmentRuleType, Conversation as LibConversationType } from '@/lib/types';
import { answerUserQuestion } from '@/ai/flows/answer-user-question';
import { scheduleAppointment as scheduleAppointmentAIFlow, checkRealAvailability as checkRealAvailabilityAIFlow, scheduleAppointmentPrompt } from '@/ai/flows/schedule-appointment';
import type { ScheduleAppointmentOutput, AppointmentRule as AIAppointmentRuleType, AppointmentDetailsSchema as AIAppointmentDetails, ScheduleAppointmentInput } from '@/ai/schemas/schedule-appointment-schemas';

import { randomUUID } from 'crypto';
import mongoose, { Types, Document } from 'mongoose';
import dotenv from 'dotenv';
import { startOfDay, endOfDay, subDays, formatISO, parse, isValid as isValidDateFns, parseISO as dateFnsParseISO, setHours, setMinutes, setSeconds, setMilliseconds, getDay, addMinutes, isBefore, isEqual, format as dateFnsFormat, getHours, getMinutes, addDays as dateFnsAddDays, addWeeks as dateFnsAddWeeks, addMonths as dateFnsAddMonths } from 'date-fns';
import { validatePhoneNumber } from '@/lib/validator';
import { AppointmentReminderService } from '@/lib/services/appointmentReminder.service';


// Ensure dotenv is configured correctly
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: process.cwd() + '/.env' });
} else {
  dotenv.config();
}

if (!process.env.MONGODB_URI) {
  if (process.env.VERCEL_ENV) {
    console.warn("MONGODB_URI not found at build time (Vercel). Will be checked at runtime.");
  } else {
    console.warn("WARNING: MONGODB_URI is not defined in .env. App may not function correctly at runtime.");
  }
}


import dbConnect from '@/lib/mongodb';
import UserModel from '@/models/User.model';
import CustomerModel, { type ICustomer } from '@/models/Customer.model';
import MessageModel from '@/models/Message.model';
import AppointmentModel from '@/models/Appointment.model';
import AppSettingsModel from '@/models/AppSettings.model';
import KeywordMappingModel from '@/models/KeywordMapping.model';
import TrainingDataModel from '@/models/TrainingData.model';
import AppointmentRuleModel from '@/models/AppointmentRule.model';
import NoteModel from '@/models/Note.model';
import ProductModel from '@/models/Product.model';
import ReminderModel from '@/models/Reminder.model';
import ConversationModel from '@/models/Conversation.model';
import type { IConversation } from '@/models/Conversation.model';
import BranchModel from '@/models/Branch.model';
import QuickReplyModel from '@/models/QuickReply.model';

import type { IUser } from '@/models/User.model';
import type { IMessage } from '@/models/Message.model';
import type { IAppointment } from '@/models/Appointment.model';
import type { IAppSettings } from '@/models/AppSettings.model';
import type { IKeywordMapping } from '@/models/KeywordMapping.model';
import type { ITrainingData } from '@/models/TrainingData.model';
import type { IAppointmentRule } from '@/models/AppointmentRule.model';
import type { INote } from '@/models/Note.model';
import type { IProduct } from '@/models/Product.model';
import type { IReminder } from '@/models/Reminder.model';
import type { IBranch } from '@/models/Branch.model';
import type { IQuickReply } from '@/models/QuickReply.model';
import { vi } from 'date-fns/locale';
import { emitNewCustomerNotification, emitNewMessageNotification, emitChatReplyNotification, getSocketInstance } from '@/lib/utils/socket-emitter';
import { uploadToCloudinary, deleteFromCloudinary, extractPublicIdFromUrl } from '@/lib/utils/cloudinary';


// interface IMessageWithConversation extends IMessage {
//   conversationId?: Types.ObjectId;
// }

function transformConversationDoc(doc: IConversation | null): Conversation | null {
  if (!doc) return null;
  return {
    id: (doc._id as Types.ObjectId).toString(),
    customerId: (doc.customerId as Types.ObjectId).toString(),
    //@ts-ignore
    staffId: doc.staffId ? (doc.staffId as Types.ObjectId).toString() : undefined,
    //@ts-ignore

    title: doc.title,
    //@ts-ignore

    participants: (doc.participants || []).map((p: any) => ({
      userId: p.userId?.toString(),
      role: p.role,
      name: p.name,
      phoneNumber: p.phoneNumber,
    })).filter((p: any) => p.userId), // Filter out participants without userId (shouldn't happen if schema is correct)
    messageIds: (doc.messageIds as Types.ObjectId[] || []).map(id => id.toString()),
    pinnedMessageIds: (doc.pinnedMessageIds || []).map((p: any) => {
      // p may be an ObjectId, a string, or a populated document
      if (typeof p === 'string') return p;
      if (p && typeof p === 'object' && (p as any)._id) return (p as any)._id.toString();
      return p.toString();
    }),
    //@ts-ignore

    isPinned: doc.isPinned,
    createdAt: new Date(doc.createdAt as Date),
    updatedAt: new Date(doc.updatedAt as Date),
    lastMessageTimestamp: doc.lastMessageTimestamp ? new Date(doc.lastMessageTimestamp) : undefined,
    lastMessagePreview: doc.lastMessagePreview,
  };
}


function formatChatHistoryForAI(messages: Message[]): string {
  const dataUriRegex = /^(data:[^;]+;base64,[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;

  const processedMessages = [];
  const seenQuestions = new Set<string>();

  for (const msg of messages) {
    let displayContent = msg.content;
    const match = msg.content.match(dataUriRegex);
    if (match) {
      const textAfterFile = match[3]?.trim();
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


function transformCustomerToSession(customerDoc: ICustomer, conversationId?: string): UserSession {
  return {
    id: (customerDoc._id as Types.ObjectId).toString(),
    phoneNumber: customerDoc.phoneNumber,
    role: 'customer',
    name: customerDoc.name || `Người dùng ${customerDoc.phoneNumber}`,
    currentConversationId: conversationId,
    pinnedConversationIds: (customerDoc.pinnedConversationIds || []).map(id => id.toString()),
  };
}

function transformUserToSession(userDoc: IUser): UserSession {
  return {
    id: (userDoc._id as Types.ObjectId).toString(),
    phoneNumber: userDoc.phoneNumber,
    role: userDoc.role,
    name: userDoc.name || `${userDoc.role.charAt(0).toUpperCase() + userDoc.role.slice(1)} User`,
  };
}

function transformMessageDocToMessage(msgDoc: IMessage): Message {
  return {
    id: (msgDoc._id as Types.ObjectId).toString(),
    sender: msgDoc.sender as 'user' | 'ai' | 'system',
    content: msgDoc.content,
    timestamp: new Date(msgDoc.timestamp),
    //@ts-ignore
    name: msgDoc.name,
    userId: msgDoc.userId?.toString(),
    updatedAt: msgDoc.updatedAt ? new Date(msgDoc.updatedAt) : undefined,
    conversationId: (msgDoc as any).conversationId?.toString(),
  };
}

function transformAppointmentDocToDetails(apptDoc: any): AppointmentDetails {
  const customerIdObj = apptDoc.customerId && typeof apptDoc.customerId === 'object' ? apptDoc.customerId : null;
  const staffIdObj = apptDoc.staffId && typeof apptDoc.staffId === 'object' ? apptDoc.staffId : null;

  return {
    appointmentId: (apptDoc._id as Types.ObjectId).toString(),
    userId: typeof apptDoc.customerId === 'string' ? apptDoc.customerId : customerIdObj?._id?.toString(),
    service: apptDoc.service,
    productId: apptDoc.productId?.toString(),
    time: apptDoc.time,
    date: apptDoc.date,
    branch: apptDoc.branch,
    branchId: apptDoc.branchId?.toString(),
    status: apptDoc.status as AppointmentDetails['status'],
    notes: apptDoc.notes,
    createdAt: new Date(apptDoc.createdAt as Date),
    updatedAt: new Date(apptDoc.updatedAt as Date),
    staffId: typeof apptDoc.staffId === 'string' ? apptDoc.staffId : staffIdObj?._id?.toString(),
    customerName: customerIdObj?.name,
    customerPhoneNumber: customerIdObj?.phoneNumber,
    internalName: customerIdObj?.internalName,
    staffName: staffIdObj?.name,
    packageType: apptDoc.packageType,
    priority: apptDoc.priority,
    recurrenceType: apptDoc.recurrenceType,
    recurrenceCount: apptDoc.recurrenceCount,
  };
}


function transformKeywordMappingDoc(doc: IKeywordMapping): KeywordMapping {
  return {
    id: (doc._id as Types.ObjectId).toString(),
    keywords: doc.keywords,
    response: doc.response,
    createdAt: new Date(doc.createdAt as Date),
    updatedAt: new Date(doc.updatedAt as Date),
  };
}

function transformTrainingDataDoc(doc: ITrainingData): TrainingData {
  return {
    id: (doc._id as Types.ObjectId).toString(),
    userInput: doc.userInput,
    idealResponse: doc.idealResponse,
    label: doc.label,
    status: doc.status as TrainingDataStatus,
    createdAt: new Date(doc.createdAt as Date),
    updatedAt: new Date(doc.updatedAt as Date),
  };
}

function transformAppointmentRuleDoc(doc: IAppointmentRule): LibAppointmentRuleType {
  return {
    id: (doc._id as Types.ObjectId).toString(),
    name: doc.name,
    keywords: doc.keywords,
    conditions: doc.conditions,
    aiPromptInstructions: doc.aiPromptInstructions,
    createdAt: new Date(doc.createdAt as Date),
    updatedAt: new Date(doc.updatedAt as Date),
  };
}

function transformNoteDocToNote(noteDoc: any): Note {
  return {
    id: (noteDoc._id as Types.ObjectId).toString(),
    customerId: noteDoc.customerId.toString(),
    staffId: noteDoc.staffId.toString(),
    staffName: (noteDoc.staffId as any)?.name,
    content: noteDoc.content,
    imageUrl: noteDoc.imageUrl,
    imagePublicId: noteDoc.imagePublicId,
    imageFileName: noteDoc.imageFileName,
    createdAt: new Date(noteDoc.createdAt as Date),
    updatedAt: new Date(noteDoc.updatedAt as Date),
  };
}


function transformAppSettingsDoc(doc: IAppSettings | null): AppSettings | null {
  if (!doc) return null;
  const defaultBrandName = 'LiveChat';
  //@ts-ignore
  const initialDefaultSettings: AppSettings = {
    id: '',
    brandName: defaultBrandName,
    greetingMessage: 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay?',
    greetingMessageNewCustomer: 'Chào mừng bạn lần đầu đến với chúng tôi! Bạn cần hỗ trợ gì ạ?',
    greetingMessageReturningCustomer: 'Chào mừng bạn quay trở lại! Rất vui được gặp lại bạn.',
    suggestedQuestions: ['Các dịch vụ của bạn?', 'Đặt lịch hẹn', 'Địa chỉ của bạn ở đâu?'],
    successfulBookingMessageTemplate: "Lịch hẹn của bạn cho {{service}} vào lúc {{time}} ngày {{date}}{{#if branch}} tại {{branch}}{{/if}} đã được đặt thành công!",
    footerText: `© ${new Date().getFullYear()} ${defaultBrandName}. Đã đăng ký Bản quyền.`,
    metaTitle: `Triruto - Trợ lý AI cho giao tiếp khách hàng liền mạch.`,
    metaDescription: 'Live chat tích hợp AI cho giao tiếp khách hàng liền mạch.',
    metaKeywords: [],
    numberOfStaff: 1,
    defaultServiceDurationMinutes: 60,
    workingHours: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
    breakTimes: [],
    breakTimeNotificationEnabled: false,
    breakTimeNotificationMessage: 'Hiện tại chúng tôi đang trong giờ nghỉ {{breakName}} từ {{startTime}} đến {{endTime}}. Vui lòng liên hệ lại sau hoặc để lại lời nhắn.',
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
    const plainRule: SpecificDayRule = {
      id: (rule as any)._id ? (rule as any)._id.toString() : rule.id || new mongoose.Types.ObjectId().toString(),
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
    id: (doc._id as Types.ObjectId).toString(),
    greetingMessage: doc.greetingMessage || initialDefaultSettings.greetingMessage,
    greetingMessageNewCustomer: doc.greetingMessageNewCustomer || initialDefaultSettings.greetingMessageNewCustomer,
    greetingMessageReturningCustomer: doc.greetingMessageReturningCustomer || initialDefaultSettings.greetingMessageReturningCustomer,
    suggestedQuestions: doc.suggestedQuestions && doc.suggestedQuestions.length > 0 ? doc.suggestedQuestions : initialDefaultSettings.suggestedQuestions!,
    successfulBookingMessageTemplate: doc.successfulBookingMessageTemplate || initialDefaultSettings.successfulBookingMessageTemplate,
    cancelledAppointmentMessageTemplate: doc.cancelledAppointmentMessageTemplate || "Lịch hẹn {{service}} vào lúc {{time}} ngày {{date}}{{#if branch}} tại {{branch}}{{/if}} đã được hủy thành công.",
    rescheduledAppointmentMessageTemplate: doc.rescheduledAppointmentMessageTemplate || "Lịch hẹn {{service}} đã được đổi thành {{time}} ngày {{date}}{{#if branch}} tại {{branch}}{{/if}}.",
    brandName: doc.brandName || initialDefaultSettings.brandName,
    logoUrl: doc.logoUrl,
    logoDataUri: doc.logoDataUri,
    footerText: doc.footerText || initialDefaultSettings.footerText,
    metaTitle: doc.metaTitle || initialDefaultSettings.metaTitle,
    metaDescription: doc.metaDescription || initialDefaultSettings.metaDescription,
    metaKeywords: doc.metaKeywords && doc.metaKeywords.length > 0 ? doc.metaKeywords : initialDefaultSettings.metaKeywords!,
    openGraphImageUrl: doc.openGraphImageUrl,
    robotsTxtContent: doc.robotsTxtContent,
    sitemapXmlContent: doc.sitemapXmlContent,
    numberOfStaff: doc.numberOfStaff ?? initialDefaultSettings.numberOfStaff,
    defaultServiceDurationMinutes: doc.defaultServiceDurationMinutes ?? initialDefaultSettings.defaultServiceDurationMinutes,
    workingHours: doc.workingHours && doc.workingHours.length > 0 ? doc.workingHours : initialDefaultSettings.workingHours!,
    breakTimes: (doc.breakTimes || []).map(bt => ({
      id: bt.id || Date.now().toString() + Math.random().toString(),
      startTime: bt.startTime,
      endTime: bt.endTime,
      name: bt.name,
    })),
    breakTimeNotificationEnabled: doc.breakTimeNotificationEnabled ?? initialDefaultSettings.breakTimeNotificationEnabled,
    breakTimeNotificationMessage: doc.breakTimeNotificationMessage || initialDefaultSettings.breakTimeNotificationMessage,
    weeklyOffDays: doc.weeklyOffDays || initialDefaultSettings.weeklyOffDays || [],
    oneTimeOffDates: doc.oneTimeOffDates || initialDefaultSettings.oneTimeOffDates || [],
    specificDayRules: specificDayRulesPlain,
    outOfOfficeResponseEnabled: doc.outOfOfficeResponseEnabled ?? initialDefaultSettings.outOfOfficeResponseEnabled,
    outOfOfficeMessage: doc.outOfOfficeMessage || initialDefaultSettings.outOfOfficeMessage,
    officeHoursStart: doc.officeHoursStart || initialDefaultSettings.officeHoursStart,
    officeHoursEnd: doc.officeHoursEnd || initialDefaultSettings.officeHoursEnd,
    officeDays: doc.officeDays && doc.officeDays.length > 0 ? doc.officeDays : initialDefaultSettings.officeDays!,
    updatedAt: new Date(doc.updatedAt as Date),
  };
}


export async function getAppSettings(): Promise<AppSettings | null> {
  await dbConnect();
  let settingsDoc = await AppSettingsModel.findOne<IAppSettings>({});

  // If no settings exist, create default settings
  if (!settingsDoc) {
    console.log("No app settings found, creating default settings...");
    settingsDoc = await new AppSettingsModel({}).save();
    console.log("Default app settings created.");
  }

  return transformAppSettingsDoc(settingsDoc);
}

export async function updateAppSettings(settings: Partial<Omit<AppSettings, 'id' | 'updatedAt'>>): Promise<AppSettings | null> {
  await dbConnect();
  const processedSettings = { ...settings };
  if (processedSettings.specificDayRules) {
    processedSettings.specificDayRules = processedSettings.specificDayRules.map(rule => {
      const { id, ...restOfRule } = rule; // Remove client-side id before saving
      return restOfRule as Omit<SpecificDayRule, 'id'>;
    });
  }

  // Ensure arrays are saved correctly, even if empty
  processedSettings.suggestedQuestions = Array.isArray(processedSettings.suggestedQuestions) ? processedSettings.suggestedQuestions : [];
  processedSettings.metaKeywords = Array.isArray(processedSettings.metaKeywords) ? processedSettings.metaKeywords : [];
  processedSettings.workingHours = Array.isArray(processedSettings.workingHours) ? processedSettings.workingHours : [];
  processedSettings.breakTimes = Array.isArray(processedSettings.breakTimes) ? processedSettings.breakTimes : [];
  processedSettings.weeklyOffDays = Array.isArray(processedSettings.weeklyOffDays) ? processedSettings.weeklyOffDays : [];
  processedSettings.oneTimeOffDates = Array.isArray(processedSettings.oneTimeOffDates) ? processedSettings.oneTimeOffDates : [];
  processedSettings.officeDays = Array.isArray(processedSettings.officeDays) ? processedSettings.officeDays : [];
  processedSettings.specificDayRules = Array.isArray(processedSettings.specificDayRules) ? processedSettings.specificDayRules : [];


  const updatedSettingsDoc = await AppSettingsModel.findOneAndUpdate({}, { $set: processedSettings }, { new: true, upsert: true, runValidators: true });
  return transformAppSettingsDoc(updatedSettingsDoc);
}


export async function createNewConversationForUser(userId: string, title?: string): Promise<Conversation | null> {
  await dbConnect();
  console.log("[ACTIONS] createNewConversationForUser: Called for userId:", userId);
  const user = await CustomerModel.findById(userId);
  if (!user) {
    console.error(`[ACTIONS] createNewConversationForUser: Customer not found with ID: ${userId}`);
    return null;
  }

  const newConversation = new ConversationModel({
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

function isOutOfOffice(appSettings: AppSettings): boolean {
  if (!appSettings.outOfOfficeResponseEnabled || !appSettings.officeHoursStart || !appSettings.officeHoursEnd || !appSettings.officeDays || appSettings.officeDays.length === 0) {
    return false;
  }

  const now = new Date();
  const currentDay = now.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
  const currentHour = getHours(now);
  const currentMinute = getMinutes(now);

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

function getCurrentBreakTime(appSettings: AppSettings): { breakTime: any; message: string } | null {
  try {
    if (!appSettings.breakTimeNotificationEnabled || !appSettings.breakTimes || appSettings.breakTimes.length === 0) {
      console.log("[DEBUG getCurrentBreakTime] Early return:", {
        breakTimeNotificationEnabled: appSettings.breakTimeNotificationEnabled,
        breakTimesLength: appSettings.breakTimes?.length || 0
      });
      return null;
    }

    const now = new Date();
    const currentHour = getHours(now);
    const currentMinute = getMinutes(now);
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    console.log("[DEBUG getCurrentBreakTime] Current time:", {
      now: now.toISOString(),
      localTime: now.toLocaleString('vi-VN'),
      currentHour,
      currentMinute,
      currentTimeInMinutes,
      formattedTime: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`
    });

    // Check if current time falls within any break time
    for (const breakTime of appSettings.breakTimes) {
      if (!breakTime || !breakTime.startTime || !breakTime.endTime) continue;
      
      // Validate time format
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(breakTime.startTime) || !timeRegex.test(breakTime.endTime)) continue;
      
      const startTimeParts = breakTime.startTime.split(':');
      const endTimeParts = breakTime.endTime.split(':');
      
      if (startTimeParts.length !== 2 || endTimeParts.length !== 2) continue;
      
      const startHour = parseInt(startTimeParts[0], 10);
      const startMinute = parseInt(startTimeParts[1], 10);
      const endHour = parseInt(endTimeParts[0], 10);
      const endMinute = parseInt(endTimeParts[1], 10);
      
      if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) continue;

      const startTimeInMinutes = startHour * 60 + startMinute;
      const endTimeInMinutes = endHour * 60 + endMinute;

      if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes) {
        // Format the break time notification message safely
        const baseMessage = appSettings.breakTimeNotificationMessage || 'Hiện tại chúng tôi đang trong giờ nghỉ từ {{startTime}} đến {{endTime}}.';
        
        // Limit message length to prevent issues
        let message = String(baseMessage).substring(0, 500);
        
        // Sanitize replacement values to prevent infinite loops
        const breakName = String(breakTime.name || 'nghỉ').substring(0, 50).replace(/[{}]/g, '');
        const startTime = String(breakTime.startTime).substring(0, 10).replace(/[{}]/g, '');
        const endTime = String(breakTime.endTime).substring(0, 10).replace(/[{}]/g, '');
        
        // Simple replacement without regex to be extra safe
        message = message.split('{{breakName}}').join(breakName);
        message = message.split('{{startTime}}').join(startTime);
        message = message.split('{{endTime}}').join(endTime);

        return { breakTime, message };
      }
    }

    return null;
  } catch (error) {
    console.error('Error in getCurrentBreakTime:', error);
    return null;
  }
}




export async function handleCustomerAccess(phoneNumber: string): Promise<{
  userSession: UserSession;
  initialMessages: Message[];
  initialSuggestedReplies: string[];
  activeConversationId: string;
  conversations: Conversation[];
}> {
  console.log("handleCustomerAccess started for phoneNumber:", phoneNumber);
  await dbConnect();
  if (!validatePhoneNumber(phoneNumber)) {
    throw new Error("Số điện thoại không hợp lệ.");
  }
  let customer = await CustomerModel.findOne({ phoneNumber });
  let isNewCustomer = false;
  if (!customer) {
    console.log("New customer, creating profile for:", phoneNumber);
    customer = new CustomerModel({
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
    
    // Emit new customer notification
    emitNewCustomerNotification({
      customerId: customer._id!.toString(),
      customerName: customer.name,
      customerPhone: customer.phoneNumber,
    });
  } else {
    console.log("Returning customer found:", customer.id);
    // Ensure these arrays are not undefined
    customer.conversationIds = customer.conversationIds || [];
    customer.appointmentIds = customer.appointmentIds || [];
    customer.productIds = customer.productIds || [];
    customer.noteIds = customer.noteIds || [];
    customer.pinnedConversationIds = customer.pinnedConversationIds || [];
    customer.tags = customer.tags || [];
  }

  let activeConversation: IConversation | null = null;
  // For one-conversation-per-customer:
  if (customer.conversationIds && customer.conversationIds.length > 0) {
    activeConversation = await ConversationModel.findById(customer.conversationIds[0])
      .populate({
        path: 'messageIds',
        model: MessageModel,
        options: { sort: { timestamp: 1 } } // Bỏ giới hạn - load tất cả tin nhắn
      });
    if (activeConversation) console.log("Found existing active conversation:", activeConversation.id);
  }

  if (!activeConversation) {
    console.log("No active conversation found, creating new one for customer:", customer.id);
    const newConvDocFromAction = await createNewConversationForUser(customer._id!.toString(), `Trò chuyện chính với ${customer.name || customer.phoneNumber}`);
    if (!newConvDocFromAction || !newConvDocFromAction.id) throw new Error("Không thể tạo cuộc trò chuyện mới.");
    activeConversation = await ConversationModel.findById(newConvDocFromAction.id).populate({
      path: 'messageIds',
      model: MessageModel,
      options: { sort: { timestamp: 1 } } // Bỏ giới hạn - load tất cả tin nhắn
    });
    if (activeConversation) {
      console.log("New conversation created and fetched:", activeConversation.id);
      const updatedCustomer = await CustomerModel.findByIdAndUpdate(
        customer._id,
        { $addToSet: { conversationIds: activeConversation._id } },
        { new: true }
      );
      if (updatedCustomer) customer = updatedCustomer;
    }
  }

  if (!activeConversation) {
    console.error("CRITICAL: Failed to find or create an active conversation for customer:", customer.id);
    throw new Error("Không thể tìm hoặc tạo cuộc trò chuyện cho khách hàng.");
  }

  const userSession = transformCustomerToSession(customer, (activeConversation._id as Types.ObjectId).toString());
  const appSettings = await getAppSettings();
  console.log("AppSettings fetched for greeting logic:", appSettings ? "Loaded" : "Not loaded");

  let initialSystemMessageContent: string = "";
  const ultimateDefaultGreeting = 'Tôi có thể giúp gì cho bạn hôm nay?';

  if (appSettings) {
    let currentBreakTime = null;
    try {
      currentBreakTime = getCurrentBreakTime(appSettings);
    } catch (error) {
      console.error("Error checking break time:", error);
    }
    
    if (currentBreakTime) {
      initialSystemMessageContent = currentBreakTime.message.trim();
      console.log("Break time message selected:", initialSystemMessageContent);
    } else if (appSettings.outOfOfficeResponseEnabled && isOutOfOffice(appSettings)) {
      initialSystemMessageContent = (appSettings.outOfOfficeMessage?.trim() || ultimateDefaultGreeting).trim();
      console.log("Out of office message selected:", initialSystemMessageContent);
    } else if (isNewCustomer && appSettings.greetingMessageNewCustomer && appSettings.greetingMessageNewCustomer.trim() !== "") {
      initialSystemMessageContent = appSettings.greetingMessageNewCustomer.trim();
      console.log("New customer greeting selected:", initialSystemMessageContent);
    } else if (!isNewCustomer && appSettings.greetingMessageReturningCustomer && appSettings.greetingMessageReturningCustomer.trim() !== "") {
      initialSystemMessageContent = appSettings.greetingMessageReturningCustomer.trim();
      console.log("Returning customer greeting selected:", initialSystemMessageContent);
    } else if (appSettings.greetingMessage && appSettings.greetingMessage.trim() !== "") {
      initialSystemMessageContent = appSettings.greetingMessage.trim();
      console.log("General greeting selected:", initialSystemMessageContent);
    }
  }

  if (initialSystemMessageContent.trim() === "") {
    initialSystemMessageContent = ultimateDefaultGreeting;
    console.log("Fallback to ultimate default greeting:", initialSystemMessageContent);
  }


  let finalInitialMessages: Message[] = [];

  // Prepend the system greeting message
  if (initialSystemMessageContent.trim() !== "") {
    const systemGreetingMessage: Message = {
      id: `msg_system_greeting_${Date.now()}`,
      sender: 'ai',
      content: initialSystemMessageContent,
      timestamp: new Date(),
      name: appSettings?.brandName || 'AI Assistant',
      conversationId: (activeConversation._id as Types.ObjectId).toString(),
    };
    finalInitialMessages.push(systemGreetingMessage);
  }

  // Then append existing messages from the conversation
  if (activeConversation.messageIds && activeConversation.messageIds.length > 0) {
    const firstMessageId = activeConversation.messageIds[0];
    if (typeof firstMessageId === 'object' && firstMessageId !== null && '_id' in firstMessageId) {
      const populatedMessages = (activeConversation.messageIds as unknown as IMessage[]).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      finalInitialMessages.push(...populatedMessages.map(transformMessageDocToMessage));
    } else {
              const conversationMessageDocs = await MessageModel.find({ _id: { $in: activeConversation.messageIds as Types.ObjectId[] } }).sort({ timestamp: 1 });
      finalInitialMessages.push(...conversationMessageDocs.map(transformMessageDocToMessage));
    }
  }

  let configuredSuggestedQuestions: string[] = [];
  // Only show suggested questions if it's effectively a "new" chat session display (only the system greeting)
  if (finalInitialMessages.length <= 1 && appSettings?.suggestedQuestions && appSettings.suggestedQuestions.length > 0) {
    configuredSuggestedQuestions = appSettings.suggestedQuestions;
  }
  console.log("handleCustomerAccess completed. Returning initial messages count:", finalInitialMessages.length);
  return {
    userSession,
    initialMessages: finalInitialMessages,
    initialSuggestedReplies: configuredSuggestedQuestions,
    activeConversationId: (activeConversation._id as Types.ObjectId).toString(),
    conversations: [transformConversationDoc(activeConversation)].filter(Boolean) as Conversation[],
  };
}


export async function registerUser(name: string, phoneNumber: string, password: string, role: UserRole): Promise<UserSession | null> {
  if (role === 'customer') throw new Error("Việc đăng ký khách hàng được xử lý theo cách khác.");
  await dbConnect();

  if (!validatePhoneNumber(phoneNumber)) {
    throw new Error("Số điện thoại không hợp lệ.");
  }

  const existingUser = await UserModel.findOne({ phoneNumber });
  if (existingUser) {
    throw new Error('Người dùng với số điện thoại này đã tồn tại.');
  }

  const newUserDoc = new UserModel({
    name,
    phoneNumber,
    password,
    role,
  });
  await newUserDoc.save();
  return transformUserToSession(newUserDoc);
}

export async function loginUser(phoneNumber: string, passwordAttempt: string): Promise<UserSession | null> {
  await dbConnect();

  if (!validatePhoneNumber(phoneNumber)) {
    throw new Error("Số điện thoại không hợp lệ.");
  }
  const user = await UserModel.findOne({ phoneNumber }).select('+password');

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

interface AvailabilityResult {
  isAvailable: boolean;
  reason?: string;
  suggestedSlots?: { date: string; time: string; branch?: string }[];
}

export async function getConversationHistory(conversationId: string): Promise<Message[]> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    console.warn(`[ACTIONS] Invalid conversationId for getConversationHistory: ${conversationId}`);
    return [];
  }
  const conversation = await ConversationModel.findById(conversationId).populate({
    path: 'messageIds',
    model: MessageModel,
    options: { sort: { timestamp: 1 } } // Bỏ giới hạn - load tất cả tin nhắn
  });
  if (!conversation || !conversation.messageIds || conversation.messageIds.length === 0) {
    return [];
  }
  const messages = (conversation.messageIds as unknown as IMessage[]);
  return messages.map(transformMessageDocToMessage);
}

// Helper function để load tất cả tin nhắn từ tất cả conversation của customer
export async function getAllCustomerMessages(customerId: string, messageLimit?: number): Promise<Message[]> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    console.warn(`[ACTIONS] Invalid customerId for getAllCustomerMessages: ${customerId}`);
    return [];
  }
  
  // Load tất cả conversation của customer
  const customer = await CustomerModel.findById(customerId).populate({
    path: 'conversationIds',
    model: ConversationModel,
    options: { sort: { lastMessageTimestamp: -1 } }, // Sort theo tin nhắn mới nhất
    populate: {
      path: 'messageIds',
      model: MessageModel,
      options: { sort: { timestamp: 1 } }
    }
  });

  if (!customer || !customer.conversationIds || customer.conversationIds.length === 0) {
    return [];
  }

  const allMessages: Message[] = [];
  
  // Gộp tin nhắn từ tất cả conversation
  for (const convDoc of customer.conversationIds as unknown as IConversation[]) {
    if (convDoc && convDoc.messageIds && convDoc.messageIds.length > 0) {
      const conversationMessages = (convDoc.messageIds as unknown as IMessage[])
        .map(transformMessageDocToMessage);
      allMessages.push(...conversationMessages);
    }
  }

  // Sort tất cả tin nhắn theo thời gian và giới hạn số lượng (nếu có)
  const sortedMessages = allMessages
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  // Chỉ áp dụng limit nếu được chỉ định và > 0, không thì trả về tất cả
  return (messageLimit && messageLimit > 0) ? sortedMessages.slice(-messageLimit) : sortedMessages;
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
  await dbConnect();
  const customer = await CustomerModel.findById(userId).populate({
    path: 'conversationIds',
    model: ConversationModel,
    options: { sort: { lastMessageTimestamp: -1 } }
  });
  if (!customer || !customer.conversationIds || customer.conversationIds.length === 0) {
    return [];
  }
  return (customer.conversationIds as unknown as IConversation[]).map(doc => transformConversationDoc(doc)).filter(Boolean) as Conversation[];
}

function formatAppointmentMessage(template: string, details: AppointmentDetails, fallbackMessage: string): string {
  try {
    // Limit template length and sanitize
    let message = String(template || '').substring(0, 1000);
    
    // Sanitize replacement values to prevent infinite loops
    const service = String(details.service || '').substring(0, 100).replace(/[{}]/g, '');
    const time = String(details.time || '').substring(0, 20).replace(/[{}]/g, '');
    const branch = String(details.branch || '').substring(0, 100).replace(/[{}]/g, '');
    
    // Use split/join instead of regex for safety
    message = message.split('{{service}}').join(service);
    
    try {
      const dateObj = dateFnsParseISO(details.date);
      if (isValidDateFns(dateObj)) {
        const formattedDate = dateFnsFormat(dateObj, 'dd/MM/yyyy', { locale: vi });
        message = message.split('{{date}}').join(formattedDate);
      } else {
        const sanitizedDate = String(details.date || '').substring(0, 20).replace(/[{}]/g, '');
        message = message.split('{{date}}').join(sanitizedDate);
      }
    } catch (e) {
      const sanitizedDate = String(details.date || '').substring(0, 20).replace(/[{}]/g, '');
      message = message.split('{{date}}').join(sanitizedDate);
    }
    
    message = message.split('{{time}}').join(time);
    message = message.split('{{branch}}').join(branch);
    
    // Handle conditional branch display - simple approach
    if (!details.branch) {
      // Remove entire conditional block if no branch
      const startPattern = '{{#if branch}}';
      const endPattern = '{{/if}}';
      let startIndex = message.indexOf(startPattern);
      while (startIndex !== -1) {
        const endIndex = message.indexOf(endPattern, startIndex);
        if (endIndex !== -1) {
          message = message.substring(0, startIndex) + message.substring(endIndex + endPattern.length);
        } else {
          break;
        }
        startIndex = message.indexOf(startPattern);
      }
    } else {
      // Remove just the conditional tags
      message = message.split('{{#if branch}}').join('');
      message = message.split('{{/if}}').join('');
    }
    
    return message.trim().substring(0, 1000);
  } catch (error) {
    console.error('Error in formatAppointmentMessage:', error);
    return fallbackMessage;
  }
}

function formatBookingConfirmation(template: string, details: AppointmentDetails): string {
  return formatAppointmentMessage(template, details, 'Lịch hẹn đã được đặt thành công.');
}


export async function processUserMessage(
  userMessageContent: string,
  currentUserSession: UserSession,
  currentConversationId: string,
  currentChatHistory: Message[]
): Promise<{ userMessage: Message, aiMessage: Message; newSuggestedReplies: string[]; updatedAppointment?: AppointmentDetails }> {
  await dbConnect();
  console.log(`[processUserMessage] Called for conversation: ${currentConversationId}, user: ${currentUserSession.id}`);

  const customerId = currentUserSession.id;
  if (!mongoose.Types.ObjectId.isValid(currentConversationId) || !mongoose.Types.ObjectId.isValid(customerId)) {
    console.error("[processUserMessage] Invalid conversation or customer ID.");
    throw new Error("Mã cuộc trò chuyện hoặc khách hàng không hợp lệ.");
  }

  let textForAI = userMessageContent;
  let mediaDataUriForAI: string | undefined = undefined;
  let processedMessageContent = userMessageContent;

  // Check for new Cloudinary URL format first
  const cloudinaryRegex = /^(https:\/\/res\.cloudinary\.com\/[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;
  const cloudinaryMatch = userMessageContent.match(cloudinaryRegex);

  if (cloudinaryMatch) {
    // Keep the Cloudinary URL format for storage
    processedMessageContent = userMessageContent;
    const fileNameEncoded = cloudinaryMatch[2];
    let originalFileName = "attached_file";
    try { originalFileName = decodeURIComponent(fileNameEncoded); } catch (e) { /* ignore */ }
    textForAI = cloudinaryMatch[3]?.trim() || `Tôi đã gửi một tệp: ${originalFileName}. Bạn có thể phân tích hoặc mô tả nó không?`;
    // For AI processing, we'll use the text content
    mediaDataUriForAI = cloudinaryMatch[1];
  } else {
    // Check for legacy data URI format and convert to Cloudinary
    const dataUriRegex = /^(data:[^;]+;base64,[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;
    const dataUriMatch = userMessageContent.match(dataUriRegex);

    if (dataUriMatch) {
      try {
        const fileDataUri = dataUriMatch[1];
        const fileNameEncoded = dataUriMatch[2];
        const textContent = dataUriMatch[3];
        let originalFileName = "attached_file";
        try { originalFileName = decodeURIComponent(fileNameEncoded); } catch (e) { /* ignore */ }

        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(fileDataUri, originalFileName, 'triruto_chat/messages');
        
        // Update message content to use Cloudinary URL
        processedMessageContent = `${uploadResult.secure_url}#filename=${encodeURIComponent(originalFileName)}${textContent ? '\n' + textContent : ''}`;
        
        textForAI = textContent?.trim() || `Tôi đã gửi một tệp: ${originalFileName}. Bạn có thể phân tích hoặc mô tả nó không?`;
        mediaDataUriForAI = uploadResult.secure_url;
      } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        // Fallback to original data URI processing
        mediaDataUriForAI = dataUriMatch[1];
        const fileNameEncoded = dataUriMatch[2];
        let originalFileName = "attached_file";
        try { originalFileName = decodeURIComponent(fileNameEncoded); } catch (e) { /* ignore */ }
        textForAI = dataUriMatch[3]?.trim() || `Tôi đã gửi một tệp: ${originalFileName}. Bạn có thể phân tích hoặc mô tả nó không?`;
        processedMessageContent = userMessageContent; // Keep original on error
      }
    }
  }

  const userMessageData: Partial<IMessage> = {
    sender: 'user',
    content: processedMessageContent, // Use processed content (Cloudinary URL if uploaded)
    timestamp: new Date(),
    //@ts-ignore
    name: currentUserSession.name || `Người dùng ${currentUserSession.phoneNumber}`,
    //@ts-ignore
    customerId: new mongoose.Types.ObjectId(customerId),
    //@ts-ignore
    userId: new mongoose.Types.ObjectId(customerId),
    //@ts-ignore
    conversationId: new mongoose.Types.ObjectId(currentConversationId),
  };
  const savedUserMessageDoc = await new MessageModel(userMessageData).save();
  const userMessage = transformMessageDocToMessage(savedUserMessageDoc);
  console.log("[processUserMessage] User message saved:", userMessage.id);

  // Emit new message notification for user messages
  const customer = await CustomerModel.findById(customerId);
  if (customer) {
    emitNewMessageNotification({
      customerId: customerId,
      customerName: customer.name,
      messageContent: textForAI,
      conversationId: currentConversationId,
      sender: 'user'
    });
  }

  await CustomerModel.findByIdAndUpdate(customerId, {
    lastInteractionAt: new Date(),
    interactionStatus: currentUserSession.role === 'customer' ? 'unread' : 'replied_by_staff',
    lastMessagePreview: textForAI.substring(0, 100),
    lastMessageTimestamp: userMessage.timestamp,
  });

  await ConversationModel.findByIdAndUpdate(currentConversationId, {
    $push: { messageIds: savedUserMessageDoc._id },
    lastMessageTimestamp: userMessage.timestamp,
    lastMessagePreview: textForAI.substring(0, 100),
  });

  let updatedChatHistoryWithUserMsg = [...currentChatHistory, userMessage];
  const formattedHistory = formatChatHistoryForAI(updatedChatHistoryWithUserMsg.slice(-10));

  let aiResponseContent: string = "";
  let finalAiMessage: Message;
  let processedAppointmentDB: IAppointment | null = null;
  let scheduleOutputFromAI: ScheduleAppointmentOutput | null = null;
  const appSettings = await getAppSettings();
  if (!appSettings) {
    console.error("[processUserMessage] AppSettings not loaded.");
    throw new Error("Không thể tải cài đặt ứng dụng. Không thể xử lý tin nhắn.");
  }

  let currentBreakTime = null;
  try {
    console.log("[DEBUG] App settings for break time check:", {
      breakTimeNotificationEnabled: appSettings.breakTimeNotificationEnabled,
      breakTimesCount: appSettings.breakTimes?.length || 0,
      breakTimes: appSettings.breakTimes
    });
    currentBreakTime = getCurrentBreakTime(appSettings);
    console.log("[DEBUG] getCurrentBreakTime result:", currentBreakTime);
  } catch (error) {
    console.error("Error checking break time in processUserMessage:", error);
  }
  
  if (currentBreakTime) {
    const lastAiMessage = currentChatHistory.slice().reverse().find(m => m.sender === 'ai' || m.sender === 'system');
    if (lastAiMessage && lastAiMessage.content === currentBreakTime.message) {
      aiResponseContent = "Chúng tôi vẫn đang trong giờ nghỉ. Xin cảm ơn sự kiên nhẫn của bạn.";
    } else {
      aiResponseContent = currentBreakTime.message;
    }
    console.log("[processUserMessage] In break time. AI response:", aiResponseContent);
  } else if (isOutOfOffice(appSettings) && appSettings.outOfOfficeResponseEnabled && appSettings.outOfOfficeMessage) {
    const lastAiMessage = currentChatHistory.slice().reverse().find(m => m.sender === 'ai' || m.sender === 'system');
    if (lastAiMessage && lastAiMessage.content === appSettings.outOfOfficeMessage) {
      aiResponseContent = "Chúng tôi vẫn đang ngoài giờ làm việc. Xin cảm ơn sự kiên nhẫn của bạn.";
    } else {
      aiResponseContent = appSettings.outOfOfficeMessage;
    }
    console.log("[processUserMessage] Out of office. AI response:", aiResponseContent);
  } else {
    const allProducts = await getAllProducts();
    const activeBranches = await getBranches(true);
    const branchNamesForAI = activeBranches.map(b => b.name);
    const customerAppointmentsDocs = await AppointmentModel.find({
      customerId: new mongoose.Types.ObjectId(customerId) as any,
      status: { $nin: ['cancelled', 'completed'] }
    }).populate('customerId staffId');
    //@ts-ignore
    const customerAppointmentsForAI: AIAppointmentDetails[] = customerAppointmentsDocs.map(doc => ({
      //@ts-ignore
      ...(transformAppointmentDocToDetails(doc) as AIAppointmentDetails),
      userId: (doc.customerId as any)?._id?.toString(),
      createdAt: doc.createdAt?.toISOString(),
      updatedAt: doc.updatedAt?.toISOString(),
    }));

    const appointmentRulesFromDB: LibAppointmentRuleType[] = await getAppointmentRules();
    const appointmentRulesForAI: AIAppointmentRuleType[] = appointmentRulesFromDB.map(
      (rule: LibAppointmentRuleType) => ({
        id: rule.id, name: rule.name, keywords: rule.keywords, conditions: rule.conditions,
        aiPromptInstructions: rule.aiPromptInstructions, createdAt: rule.createdAt?.toISOString(), updatedAt: rule.updatedAt?.toISOString(),
      })
    );

    scheduleOutputFromAI = await scheduleAppointmentAIFlow({
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
    } else {
      aiResponseContent = scheduleOutputFromAI.confirmationMessage;

      if ((scheduleOutputFromAI.intent === 'booked' || scheduleOutputFromAI.intent === 'rescheduled') &&
        scheduleOutputFromAI.appointmentDetails?.date && scheduleOutputFromAI.appointmentDetails?.time &&
        /^\d{4}-\d{2}-\d{2}$/.test(scheduleOutputFromAI.appointmentDetails.date) &&
        /^[0-2][0-9]:[0-5][0-9]$/.test(scheduleOutputFromAI.appointmentDetails.time) &&
        scheduleOutputFromAI.appointmentDetails.service
      ) {
        const targetDate = dateFnsParseISO(scheduleOutputFromAI.appointmentDetails.date);
        const targetTime = scheduleOutputFromAI.appointmentDetails.time;
        const serviceName = scheduleOutputFromAI.appointmentDetails.service;
        const targetBranchId = activeBranches.find(b => b.name === scheduleOutputFromAI?.appointmentDetails?.branch)?.id;
        const productForService = await ProductModel.findOne({ name: serviceName });

        if (!productForService || !productForService.isSchedulable) {
          aiResponseContent = `Xin lỗi, dịch vụ "${serviceName}" hiện không thể đặt lịch hoặc không tồn tại.`;
          scheduleOutputFromAI.intent = 'clarification_needed';
          processedAppointmentDB = null;
        } else if (!isValidDateFns(targetDate)) {
          aiResponseContent = "Ngày bạn cung cấp không hợp lệ. Vui lòng kiểm tra lại (YYYY-MM-DD).";
          scheduleOutputFromAI.intent = 'clarification_needed';
          processedAppointmentDB = null;
        } else {
          const effectiveSchedulingRules: EffectiveSchedulingRules = {
            numberOfStaff: productForService.schedulingRules?.numberOfStaff ?? appSettings.numberOfStaff ?? 1,
            workingHours: productForService.schedulingRules?.workingHours?.length ? productForService.schedulingRules.workingHours : appSettings.workingHours ?? [],
            weeklyOffDays: productForService.schedulingRules?.weeklyOffDays?.length ? productForService.schedulingRules.weeklyOffDays : appSettings.weeklyOffDays ?? [],
            oneTimeOffDates: productForService.schedulingRules?.oneTimeOffDates?.length ? productForService.schedulingRules.oneTimeOffDates : appSettings.oneTimeOffDates ?? [],
            specificDayRules: productForService.schedulingRules?.specificDayRules?.length ? productForService.schedulingRules.specificDayRules : appSettings.specificDayRules ?? [],
          };
          const serviceDuration = productForService.schedulingRules?.serviceDurationMinutes ?? appSettings.defaultServiceDurationMinutes ?? 60;

          const availability = await checkRealAvailabilityAIFlow(targetDate, targetTime, appSettings, serviceName, effectiveSchedulingRules, serviceDuration, targetBranchId);
          console.log("[processUserMessage] Availability check for booking:", availability);

          if (availability.isAvailable) {
            const appointmentDataCommon = {
              customerId: new mongoose.Types.ObjectId(customerId) as any, service: serviceName, productId: productForService._id,
              date: scheduleOutputFromAI.appointmentDetails.date!, time: scheduleOutputFromAI.appointmentDetails.time!,
              branch: scheduleOutputFromAI.appointmentDetails.branch, branchId: targetBranchId ? new mongoose.Types.ObjectId(targetBranchId) as any : undefined,
              notes: scheduleOutputFromAI.appointmentDetails.notes, packageType: scheduleOutputFromAI.appointmentDetails.packageType,
              priority: scheduleOutputFromAI.appointmentDetails.priority,
            };
            if (scheduleOutputFromAI.intent === 'booked') {
              const newAppointmentData = { ...appointmentDataCommon, status: 'booked' as AppointmentDetails['status'] } as any;
              processedAppointmentDB = await new AppointmentModel(newAppointmentData).save();
            } else { // Rescheduled
              if (scheduleOutputFromAI.originalAppointmentIdToModify) {
                processedAppointmentDB = await AppointmentModel.findOneAndUpdate(
                  { _id: new mongoose.Types.ObjectId(scheduleOutputFromAI.originalAppointmentIdToModify) as any, customerId: new mongoose.Types.ObjectId(customerId) as any },
                  { ...appointmentDataCommon, status: 'booked', updatedAt: new Date() }, { new: true }
                );
              }
            }
            if (processedAppointmentDB && processedAppointmentDB._id) {
              await CustomerModel.findByIdAndUpdate(customerId, { $addToSet: { appointmentIds: processedAppointmentDB._id } });
              if (scheduleOutputFromAI.intent === 'rescheduled' && appSettings.rescheduledAppointmentMessageTemplate) {
                const detailsForTemplate = transformAppointmentDocToDetails(await AppointmentModel.findById(processedAppointmentDB._id).populate('customerId staffId'));
                aiResponseContent = formatAppointmentMessage(appSettings.rescheduledAppointmentMessageTemplate, detailsForTemplate, 'Lịch hẹn đã được đổi thành công.');
              } else if (appSettings.successfulBookingMessageTemplate) {
                const detailsForTemplate = transformAppointmentDocToDetails(await AppointmentModel.findById(processedAppointmentDB._id).populate('customerId staffId'));
                aiResponseContent = formatBookingConfirmation(appSettings.successfulBookingMessageTemplate, detailsForTemplate);
              } else {
                aiResponseContent = scheduleOutputFromAI.confirmationMessage; // Use AI's natural confirmation
              }
              console.log("[processUserMessage] Appointment booked/rescheduled. DB ID:", processedAppointmentDB._id);
            } else {
              aiResponseContent = "Đã xảy ra lỗi khi lưu lịch hẹn của bạn. Vui lòng thử lại.";
              console.error("[processUserMessage] Failed to save or find appointment after DB operation.");
            }
          } else {
            aiResponseContent = scheduleOutputFromAI.confirmationMessage; // AI should have handled this via availabilityCheckResult
            processedAppointmentDB = null;
          }
        }
      } else if (scheduleOutputFromAI.intent === 'cancelled') {
        if (scheduleOutputFromAI.originalAppointmentIdToModify) {
          processedAppointmentDB = await AppointmentModel.findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(scheduleOutputFromAI.originalAppointmentIdToModify) as any, customerId: new mongoose.Types.ObjectId(customerId) as any },
            { status: 'cancelled', updatedAt: new Date() }, { new: true }
          );
          console.log("[processUserMessage] Appointment cancelled. DB ID:", processedAppointmentDB?._id);
          
          // Use cancellation message template if available
          console.log('[DEBUG] AI Cancellation - processedAppointmentDB exists:', !!processedAppointmentDB);
          console.log('[DEBUG] AI Cancellation - cancelledAppointmentMessageTemplate exists:', !!appSettings.cancelledAppointmentMessageTemplate);
          
          if (processedAppointmentDB && appSettings.cancelledAppointmentMessageTemplate) {
            const detailsForTemplate = transformAppointmentDocToDetails(processedAppointmentDB);
            console.log('[DEBUG] AI Cancellation - appointment details:', detailsForTemplate);
            
            aiResponseContent = formatAppointmentMessage(appSettings.cancelledAppointmentMessageTemplate, detailsForTemplate, 'Lịch hẹn đã được hủy thành công.');
            console.log('[DEBUG] AI Cancellation - formatted message:', aiResponseContent);
          }
        } else {
          console.warn("[processUserMessage] Attempted to cancel without originalAppointmentIdToModify.");
        }
      } else if (scheduleOutputFromAI.intent === 'no_action_needed' || scheduleOutputFromAI.intent === 'clarification_needed' || scheduleOutputFromAI.intent === 'error') {
        let keywordFound = false;
        if (!mediaDataUriForAI) {
          const keywordMappings = await getKeywordMappings();
          for (const mapping of keywordMappings) {
            if (mapping.keywords.some(kw => textForAI.toLowerCase().includes(kw.toLowerCase()))) {
              aiResponseContent = mapping.response; keywordFound = true; break;
            }
          }
        }
        if (!keywordFound) {
          try {
            const approvedTrainingDocs = await TrainingDataModel.find({ status: 'approved' }).sort({ updatedAt: -1 }).limit(5);
            const relevantTrainingData = approvedTrainingDocs.map(doc => ({ userInput: doc.userInput, idealResponse: doc.idealResponse }));
            const answerResult = await answerUserQuestion({
              question: textForAI, chatHistory: formattedHistory, mediaDataUri: mediaDataUriForAI,
              relevantTrainingData: relevantTrainingData.length > 0 ? relevantTrainingData : undefined,
              //@ts-ignore
              products: allProducts.map(p => ({ name: p.name, description: p.description, price: p.price, category: p.category })),
            });
            //@ts-ignore
            aiResponseContent = answerResult.answer;
          } catch (error) {
            console.error('[processUserMessage] Error answering user question:', error);
            aiResponseContent = "Xin lỗi, tôi đang gặp chút khó khăn để hiểu ý bạn. Bạn có thể hỏi theo cách khác được không?";
          }
        }
      }
    }
  }

  const brandNameForAI = appSettings?.brandName || 'AI Assistant';
  const aiMessageData: Partial<IMessage> = {
    //@ts-ignore
    sender: 'ai', content: aiResponseContent, timestamp: new Date(), name: `${brandNameForAI}`,
    //@ts-ignore
    customerId: new mongoose.Types.ObjectId(customerId), conversationId: new mongoose.Types.ObjectId(currentConversationId),
  };
  const savedAiMessageDoc = await new MessageModel(aiMessageData).save();
  finalAiMessage = transformMessageDocToMessage(savedAiMessageDoc);
  console.log("[processUserMessage] AI message saved:", finalAiMessage.id);

  // Emit chat reply notification for AI messages
  if (customer) {
    emitChatReplyNotification({
      customerId: customerId,
      customerName: customer.name,
      replyContent: aiResponseContent,
      conversationId: currentConversationId,
      staffName: brandNameForAI,
      sender: 'system'
    });
  }

  await CustomerModel.findByIdAndUpdate(customerId, { lastInteractionAt: new Date() });
  await ConversationModel.findByIdAndUpdate(currentConversationId, {
    $push: { messageIds: savedAiMessageDoc._id },
    lastMessageTimestamp: savedAiMessageDoc.timestamp,
    lastMessagePreview: savedAiMessageDoc.content.substring(0, 100),
  });

  const newSuggestedReplies: string[] = [];
  const updatedAppointmentClient = processedAppointmentDB ? transformAppointmentDocToDetails(processedAppointmentDB) : undefined;

  console.log("[processUserMessage] Returning:", { userMessageId: userMessage.id, aiMessageId: finalAiMessage.id, updatedAppointmentId: updatedAppointmentClient?.appointmentId });
  return { userMessage: userMessage, aiMessage: finalAiMessage, newSuggestedReplies, updatedAppointment: updatedAppointmentClient };
}

export async function handleBookAppointmentFromForm(formData: AppointmentBookingFormData): Promise<{
  success: boolean;
  message: string;
  appointment?: AppointmentDetails;
  reason?: string;
  suggestedSlots?: { date: string; time: string; branch?: string }[];
}> {
  await dbConnect();
  const appSettings = await getAppSettings();
  if (!appSettings) {
    return { success: false, message: "Lỗi: Không thể tải cài đặt hệ thống." };
  }

  const productForService = await ProductModel.findById(formData.productId);
  if (!productForService || !productForService.isSchedulable) {
    return { success: false, message: `Dịch vụ "${formData.service}" không thể đặt lịch hoặc không tồn tại.` };
  }

  try {
    const targetDate = dateFnsParseISO(formData.date);
    if (!isValidDateFns(targetDate)) {
      return { success: false, message: "Ngày không hợp lệ." };
    }

    const effectiveSchedulingRules: EffectiveSchedulingRules = {
      numberOfStaff: productForService.schedulingRules?.numberOfStaff ?? appSettings.numberOfStaff ?? 1,
      workingHours: productForService.schedulingRules?.workingHours?.length ? productForService.schedulingRules.workingHours : appSettings.workingHours ?? [],
      weeklyOffDays: productForService.schedulingRules?.weeklyOffDays?.length ? productForService.schedulingRules.weeklyOffDays : appSettings.weeklyOffDays ?? [],
      oneTimeOffDates: productForService.schedulingRules?.oneTimeOffDates?.length ? productForService.schedulingRules.oneTimeOffDates : appSettings.oneTimeOffDates ?? [],
      specificDayRules: productForService.schedulingRules?.specificDayRules?.length ? productForService.schedulingRules.specificDayRules : appSettings.specificDayRules ?? [],
    };
    const serviceDuration = productForService.schedulingRules?.serviceDurationMinutes ?? appSettings.defaultServiceDurationMinutes ?? 60;

    const availability = await checkRealAvailabilityAIFlow(
      targetDate,
      formData.time,
      appSettings,
      formData.service,
      effectiveSchedulingRules,
      serviceDuration,
      formData.branchId
    );

    if (availability.isAvailable) {
      const appointmentDataList: Partial<IAppointment>[] = [];
      const recurrenceCount = formData.recurrenceCount || 1;
      let currentBookingDate = targetDate;

      for (let i = 0; i < recurrenceCount; i++) {
        if (i > 0) {
          if (formData.recurrenceType === 'daily') {
            currentBookingDate = dateFnsAddDays(currentBookingDate, 1);
          } else if (formData.recurrenceType === 'weekly') {
            currentBookingDate = dateFnsAddWeeks(currentBookingDate, 1);
          } else if (formData.recurrenceType === 'monthly') {
            currentBookingDate = dateFnsAddMonths(currentBookingDate, 1);
          } else {
            break;
          }
        }

        const instanceAvailability = await checkRealAvailabilityAIFlow(
          currentBookingDate,
          formData.time,
          appSettings,
          formData.service,
          effectiveSchedulingRules,
          serviceDuration,
          formData.branchId
        );

        if (!instanceAvailability.isAvailable) {
          const failedDateStr = dateFnsFormat(currentBookingDate, 'dd/MM/yyyy');
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

        const appointmentData: Partial<IAppointment> = {
          customerId: new mongoose.Types.ObjectId(formData.customerId) as any,
          service: formData.service,
          productId: new mongoose.Types.ObjectId(formData.productId) as any,
          date: dateFnsFormat(currentBookingDate, 'yyyy-MM-dd'),
          time: formData.time,
          branch: formData.branch,
          branchId: formData.branchId ? new mongoose.Types.ObjectId(formData.branchId) as any : undefined,
          notes: formData.notes,
          status: 'booked',
          recurrenceType: formData.recurrenceType || 'none',
          recurrenceCount: formData.recurrenceCount,
        };
        appointmentDataList.push(appointmentData);
      }
      //@ts-ignore
      const savedAppointments: IAppointment[] = await AppointmentModel.insertMany(appointmentDataList);
      const savedAppointmentIds = savedAppointments.map(appt => appt._id);
      await CustomerModel.findByIdAndUpdate(formData.customerId, { $push: { appointmentIds: { $each: savedAppointmentIds } } });

      // Schedule reminders for each appointment
      for (const appointmentId of savedAppointmentIds) {
        try {
          // Ensure appointmentId is string or ObjectId
          const id = typeof appointmentId === 'object' && appointmentId !== null && 'toString' in appointmentId ? appointmentId.toString() : appointmentId;
          //@ts-ignore
          await AppointmentReminderService.scheduleReminder(id);
        } catch (error) {
          console.error(`Failed to schedule reminder for appointment ${appointmentId}:`, error);
        }
      }

      const firstAppointmentDetails = transformAppointmentDocToDetails(
        await AppointmentModel.findById(savedAppointmentIds[0])
          .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
          .populate<{ staffId: IUser }>('staffId', 'name')
      );

      let successMessage = `Lịch hẹn cho dịch vụ "${formData.service}" vào lúc ${formData.time} ngày ${dateFnsFormat(targetDate, 'dd/MM/yyyy')} ${formData.branch ? `tại ${formData.branch}` : ''} đã được đặt thành công.`;
      if (recurrenceCount > 1) {
        successMessage = `Chuỗi ${recurrenceCount} lịch hẹn (lặp lại ${formData.recurrenceType === 'daily' ? 'hàng ngày' : formData.recurrenceType === 'weekly' ? 'hàng tuần' : 'hàng tháng'}) cho dịch vụ "${formData.service}" bắt đầu từ ${formData.time} ngày ${dateFnsFormat(targetDate, 'dd/MM/yyyy')} ${formData.branch ? `tại ${formData.branch}` : ''} đã được đặt thành công.`;
      } else if (appSettings.successfulBookingMessageTemplate) {
        successMessage = formatBookingConfirmation(appSettings.successfulBookingMessageTemplate, firstAppointmentDetails);
      }


      return {
        success: true,
        message: successMessage,
        appointment: firstAppointmentDetails,
      };
    } else {
      return {
        success: false,
        message: `Rất tiếc, khung giờ bạn chọn (${formData.time} ngày ${dateFnsFormat(targetDate, 'dd/MM/yyyy')}) cho dịch vụ "${formData.service}" không còn trống. ${availability.reason || ''}`,
        reason: availability.reason,
        suggestedSlots: availability.suggestedSlots,
      };
    }
  } catch (error: any) {
    console.error("[handleBookAppointmentFromForm] Error:", error);
    return { success: false, message: error.message || "Đã xảy ra lỗi khi đặt lịch hẹn." };
  }
}


// --- Functions for Admin/Staff ---
export async function getCustomersForStaffView(
  requestingStaffId?: string,
  requestingStaffRole?: UserRole,
  filterTags?: string[]
): Promise<CustomerProfile[]> {
  await dbConnect();
  const query: any = {};

  if (requestingStaffRole === 'staff' && requestingStaffId) {
    const staffSpecificTag = `staff:${requestingStaffId}`;
    query.$or = [
      { assignedStaffId: new mongoose.Types.ObjectId(requestingStaffId) as any },
      { assignedStaffId: { $exists: false } },
      { tags: staffSpecificTag }
    ];
  } else if (requestingStaffRole === 'admin') {
    if (filterTags && filterTags.some(tag => tag.startsWith('admin:'))) {
      query.tags = { $in: filterTags.filter(tag => tag.startsWith('admin:')) };
    }
  }

  if (filterTags && filterTags.length > 0) {
    const generalTagsToFilter = filterTags.filter(tag => !tag.startsWith('staff:') && !tag.startsWith('admin:'));
    if (generalTagsToFilter.length > 0) {
      if (query.$or) {
        query.$or = query.$or.map((condition: any) => ({
          $and: [condition, { tags: { $in: generalTagsToFilter } }]
        }));
      } else {
        if (query.tags && query.tags.$in) {
          query.tags.$in = [...new Set([...query.tags.$in, ...generalTagsToFilter])];
        } else {
          query.tags = { $in: generalTagsToFilter };
        }
      }
    }
  }


  const customerDocs = await CustomerModel.find(query)
    .populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name')
    .sort({ lastMessageTimestamp: -1, lastInteractionAt: -1 })
    .limit(100);

  return customerDocs.map(doc => ({
    id: (doc._id as Types.ObjectId).toString(),
    phoneNumber: doc.phoneNumber,
    name: doc.name || `Người dùng ${doc.phoneNumber}`,
    internalName: doc.internalName,
    conversationIds: (doc.conversationIds || []).map(id => id.toString()),
    appointmentIds: (doc.appointmentIds || []).map(id => id.toString()),
    productIds: (doc.productIds || []).map(id => id.toString()),
    noteIds: (doc.noteIds || []).map(id => id.toString()),
    pinnedMessageIds: (doc.pinnedMessageIds || []).map(id => id.toString()),
    pinnedConversationIds: (doc.pinnedConversationIds || []).map(id => id.toString()),
    messagePinningAllowedConversationIds: (doc.messagePinningAllowedConversationIds || []).map(id => id.toString()),
    tags: doc.tags || [],
    assignedStaffId: doc.assignedStaffId?._id?.toString(),
    assignedStaffName: (doc.assignedStaffId as IUser)?.name,
    lastInteractionAt: new Date(doc.lastInteractionAt),
    createdAt: new Date(doc.createdAt as Date),
    interactionStatus: doc.interactionStatus as CustomerInteractionStatus,
    lastMessagePreview: doc.lastMessagePreview,
    lastMessageTimestamp: doc.lastMessageTimestamp ? new Date(doc.lastMessageTimestamp) : undefined,
  }));
}

export async function markCustomerInteractionAsReadByStaff(customerId: string, staffId: string): Promise<void> {
  await dbConnect();
  const customer = await CustomerModel.findById(customerId);
  if (customer && customer.interactionStatus === 'unread') {
    await CustomerModel.findByIdAndUpdate(customerId, { interactionStatus: 'read' });
  }
}


export async function getCustomerDetails(customerId: string): Promise<{ customer: CustomerProfile | null, messages: Message[], appointments: AppointmentDetails[], notes: Note[], conversations: Conversation[] }> {
  await dbConnect();
  const customerDoc = await CustomerModel.findById(customerId)
    .populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name')
    .populate({
      path: 'conversationIds',
      model: ConversationModel,
      options: { sort: { lastMessageTimestamp: -1 } },
      populate: {
        path: 'messageIds',
        model: MessageModel,
        options: { sort: { timestamp: 1 } } // Bỏ giới hạn - load tất cả tin nhắn
      }
    });

  if (!customerDoc) {
    return { customer: null, messages: [], appointments: [], notes: [], conversations: [] };
  }

  const transformedConversations = (customerDoc.conversationIds || [])
    .map(convDoc => transformConversationDoc(convDoc as unknown as IConversation))
    .filter(Boolean) as Conversation[];

  // Load tất cả tin nhắn từ tất cả conversation của customer (thay vì chỉ conversation đầu tiên)
  let messagesForActiveConversation: Message[] = [];
  try {
    messagesForActiveConversation = await getAllCustomerMessages(customerId); // Load tất cả tin nhắn - không giới hạn
    console.log(`[getCustomerDetails] Loaded ${messagesForActiveConversation.length} messages from all conversations for customer ${customerId}`);
  } catch (error) {
    console.error(`[getCustomerDetails] Error loading all customer messages:`, error);
    // Fallback to old logic if new function fails
    if (transformedConversations.length > 0 && customerDoc.conversationIds && customerDoc.conversationIds[0]) {
      const activeConvDoc = customerDoc.conversationIds[0] as unknown as IConversation;
      if (activeConvDoc && activeConvDoc.messageIds) {
        messagesForActiveConversation = (activeConvDoc.messageIds as unknown as IMessage[]).map(transformMessageDocToMessage);
      }
    }
  }


  const appointmentDocs = await AppointmentModel.find({ customerId: customerDoc._id })
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber internalName')
    .populate<{ staffId: IUser }>('staffId', 'name')
    .sort({ date: -1, time: -1 });

  const noteDocs = await NoteModel.find({ customerId: customerDoc._id })
    .populate<{ staffId: IUser }>('staffId', 'name')
    .sort({ createdAt: -1 });

  //@ts-ignore
  const customerProfile: CustomerProfile = {
    id: (customerDoc._id as Types.ObjectId).toString(),
    phoneNumber: customerDoc.phoneNumber,
    name: customerDoc.name || `Người dùng ${customerDoc.phoneNumber}`,
    internalName: customerDoc.internalName,
    conversationIds: transformedConversations.map(c => c.id),
    appointmentIds: (customerDoc.appointmentIds || []).map(id => id.toString()),
    productIds: (customerDoc.productIds || []).map(id => id.toString()),
    noteIds: (customerDoc.noteIds || []).map(id => id.toString()),
    pinnedConversationIds: (customerDoc.pinnedConversationIds || []).map(id => id.toString()),
    tags: customerDoc.tags || [],
    assignedStaffId: customerDoc.assignedStaffId?._id?.toString(),
    assignedStaffName: (customerDoc.assignedStaffId as IUser)?.name,
    lastInteractionAt: new Date(customerDoc.lastInteractionAt),
    createdAt: new Date(customerDoc.createdAt as Date),
    interactionStatus: customerDoc.interactionStatus as CustomerInteractionStatus,
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

export async function getAllUsers(roles: UserRole[] = ['staff', 'admin']): Promise<UserSession[]> {
  await dbConnect();
  const userDocs = await UserModel.find({ role: { $in: roles } });
  return userDocs.map(transformUserToSession);
}

export async function getStaffList(): Promise<{ id: string, name: string }[]> {
  await dbConnect();
  const staffUsers = await UserModel.find({ role: { $in: ['staff', 'admin'] } }, 'name');
  return staffUsers.map(user => ({
    id: (user._id as Types.ObjectId).toString(),
    name: user.name || `User ${(user._id as Types.ObjectId).toString().slice(-4)}`
  }));
}


export async function createStaffOrAdminUser(
  name: string,
  phoneNumber: string,
  role: 'staff' | 'admin',
  password?: string
): Promise<UserSession | null> {
  await dbConnect();
  if (await UserModel.findOne({ phoneNumber })) {
    throw new Error('Người dùng với số điện thoại này đã tồn tại.');
  }
  const newUser = new UserModel({
    name,
    phoneNumber,
    role,
    password: password,
  });
  await newUser.save();
  return transformUserToSession(newUser);
}

export async function updateUser(userId: string, data: Partial<Pick<IUser, 'name' | 'role' | 'password'>>): Promise<UserSession | null> {
  await dbConnect();
  const user = await UserModel.findById(userId);
  if (!user) throw new Error("Không tìm thấy người dùng.");

  if (data.name) user.name = data.name;
  if (data.role) user.role = data.role;
  if (data.password) {
    user.password = data.password;
  }

  await user.save();
  return transformUserToSession(user);
}

export async function deleteUser(userId: string): Promise<{ success: boolean, message?: string }> {
  await dbConnect();
  const result = await UserModel.findByIdAndDelete(userId);
  if (!result) throw new Error("Không tìm thấy người dùng để xóa.");

  await CustomerModel.updateMany({ assignedStaffId: userId as any }, { $unset: { assignedStaffId: "" } });
  await AppointmentModel.updateMany({ staffId: userId as any }, { $unset: { staffId: "" } });
  return { success: true, message: "Người dùng đã được xóa." };
}


export async function assignStaffToCustomer(customerId: string, staffId: string): Promise<CustomerProfile | null> {
  await dbConnect();
  const updatedCustomerDoc = await CustomerModel.findByIdAndUpdate(
    customerId,
    {
      assignedStaffId: new mongoose.Types.ObjectId(staffId) as any,
      lastInteractionAt: new Date(),
      interactionStatus: 'read',
    },
    { new: true }
  ).populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');
  if (!updatedCustomerDoc) throw new Error("Không tìm thấy khách hàng.");

  //@ts-ignore
  return {
    id: (updatedCustomerDoc._id as Types.ObjectId).toString(),
    phoneNumber: updatedCustomerDoc.phoneNumber,
    name: updatedCustomerDoc.name || `Người dùng ${updatedCustomerDoc.phoneNumber}`,
    internalName: updatedCustomerDoc.internalName,
    conversationIds: (updatedCustomerDoc.conversationIds || []).map(id => id.toString()),
    appointmentIds: (updatedCustomerDoc.appointmentIds || []).map(id => id.toString()),
    productIds: (updatedCustomerDoc.productIds || []).map(id => id.toString()),
    noteIds: (updatedCustomerDoc.noteIds || []).map(id => id.toString()),
    pinnedConversationIds: (updatedCustomerDoc.pinnedConversationIds || []).map(id => id.toString()),
    tags: updatedCustomerDoc.tags || [],
    assignedStaffId: updatedCustomerDoc.assignedStaffId?._id?.toString(),
    assignedStaffName: (updatedCustomerDoc.assignedStaffId as IUser)?.name,
    lastInteractionAt: new Date(updatedCustomerDoc.lastInteractionAt),
    createdAt: new Date(updatedCustomerDoc.createdAt as Date),
    interactionStatus: updatedCustomerDoc.interactionStatus as CustomerInteractionStatus,
    lastMessagePreview: updatedCustomerDoc.lastMessagePreview,
    lastMessageTimestamp: updatedCustomerDoc.lastMessageTimestamp ? new Date(updatedCustomerDoc.lastMessageTimestamp) : undefined,
  };
}

export async function unassignStaffFromCustomer(customerId: string): Promise<CustomerProfile | null> {
  await dbConnect();
  const updatedCustomerDoc = await CustomerModel.findByIdAndUpdate(
    customerId,
    {
      $unset: { assignedStaffId: "" },
      lastInteractionAt: new Date(),
      interactionStatus: 'unread',
    },
    { new: true }
  );
  if (!updatedCustomerDoc) throw new Error("Không tìm thấy khách hàng.");
  //@ts-ignore
  return {
    id: (updatedCustomerDoc._id as Types.ObjectId).toString(),
    phoneNumber: updatedCustomerDoc.phoneNumber,
    name: updatedCustomerDoc.name || `Người dùng ${updatedCustomerDoc.phoneNumber}`,
    internalName: updatedCustomerDoc.internalName,
    conversationIds: (updatedCustomerDoc.conversationIds || []).map(id => id.toString()),
    appointmentIds: (updatedCustomerDoc.appointmentIds || []).map(id => id.toString()),
    productIds: (updatedCustomerDoc.productIds || []).map(id => id.toString()),
    noteIds: (updatedCustomerDoc.noteIds || []).map(id => id.toString()),
    pinnedConversationIds: (updatedCustomerDoc.pinnedConversationIds || []).map(id => id.toString()),
    tags: updatedCustomerDoc.tags || [],
    assignedStaffId: updatedCustomerDoc.assignedStaffId ? (updatedCustomerDoc.assignedStaffId as any)._id?.toString() : undefined,
    assignedStaffName: undefined,
    lastInteractionAt: new Date(updatedCustomerDoc.lastInteractionAt),
    createdAt: new Date(updatedCustomerDoc.createdAt as Date),
    interactionStatus: updatedCustomerDoc.interactionStatus as CustomerInteractionStatus,
    lastMessagePreview: updatedCustomerDoc.lastMessagePreview,
    lastMessageTimestamp: updatedCustomerDoc.lastMessageTimestamp ? new Date(updatedCustomerDoc.lastMessageTimestamp) : undefined,
  };
}

export async function addTagToCustomer(customerId: string, tag: string): Promise<CustomerProfile | null> {
  await dbConnect();
  const customer = await CustomerModel.findById(customerId).populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');
  if (!customer) throw new Error("Không tìm thấy khách hàng.");

  if (!customer.tags) {
    customer.tags = [];
  }

  if (!customer.tags.includes(tag)) {
    customer.tags.push(tag);
    customer.lastInteractionAt = new Date();
    await customer.save();
  }
  //@ts-ignore
  return {
    id: (customer._id as Types.ObjectId).toString(),
    phoneNumber: customer.phoneNumber,
    name: customer.name || `Người dùng ${customer.phoneNumber}`,
    internalName: customer.internalName,
    conversationIds: (customer.conversationIds || []).map(id => id.toString()),
    appointmentIds: (customer.appointmentIds || []).map(id => id.toString()),
    productIds: (customer.productIds || []).map(id => id.toString()),
    noteIds: (customer.noteIds || []).map(id => id.toString()),
    pinnedConversationIds: (customer.pinnedConversationIds || []).map(id => id.toString()),
    tags: customer.tags || [],
    assignedStaffId: customer.assignedStaffId?._id?.toString(),
    assignedStaffName: (customer.assignedStaffId as IUser)?.name,
    lastInteractionAt: new Date(customer.lastInteractionAt),
    createdAt: new Date(customer.createdAt as Date),
    interactionStatus: customer.interactionStatus as CustomerInteractionStatus,
    lastMessagePreview: customer.lastMessagePreview,
    lastMessageTimestamp: customer.lastMessageTimestamp ? new Date(customer.lastMessageTimestamp) : undefined,
  };
}

export async function removeTagFromCustomer(customerId: string, tagToRemove: string): Promise<CustomerProfile | null> {
  await dbConnect();
  const customer = await CustomerModel.findByIdAndUpdate(
    customerId,
    { $pull: { tags: tagToRemove }, lastInteractionAt: new Date() },
    { new: true }
  ).populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');
  if (!customer) throw new Error("Không tìm thấy khách hàng.");
  return {
    id: (customer._id as Types.ObjectId).toString(),
    phoneNumber: customer.phoneNumber,
    name: customer.name || `Người dùng ${customer.phoneNumber}`,
    internalName: customer.internalName,
    conversationIds: (customer.conversationIds || []).map(id => id.toString()),
    appointmentIds: (customer.appointmentIds || []).map(id => id.toString()),
    productIds: (customer.productIds || []).map(id => id.toString()),
    noteIds: (customer.noteIds || []).map(id => id.toString()),
    pinnedMessageIds: (customer.pinnedMessageIds || []).map(id => id.toString()),
    pinnedConversationIds: (customer.pinnedConversationIds || []).map(id => id.toString()),
    messagePinningAllowedConversationIds: (customer.messagePinningAllowedConversationIds || []).map(id => id.toString()),
    tags: customer.tags || [],
    assignedStaffId: customer.assignedStaffId?._id?.toString(),
    assignedStaffName: (customer.assignedStaffId as IUser)?.name,
    lastInteractionAt: new Date(customer.lastInteractionAt),
    createdAt: new Date(customer.createdAt as Date),
    interactionStatus: customer.interactionStatus as CustomerInteractionStatus,
    lastMessagePreview: customer.lastMessagePreview,
    lastMessageTimestamp: customer.lastMessageTimestamp ? new Date(customer.lastMessageTimestamp) : undefined,
    isAppointmentDisabled: customer.isAppointmentDisabled,
  };
}

export async function updateCustomerAppointmentStatus(customerId: string, isAppointmentDisabled: boolean): Promise<CustomerProfile | null> {
  await dbConnect();
  const customer = await CustomerModel.findByIdAndUpdate(
    customerId,
    { isAppointmentDisabled, lastInteractionAt: new Date() },
    { new: true }
  ).populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');
  if (!customer) throw new Error("Không tìm thấy khách hàng.");
  
  return {
    id: (customer._id as Types.ObjectId).toString(),
    phoneNumber: customer.phoneNumber,
    name: customer.name || `Người dùng ${customer.phoneNumber}`,
    internalName: customer.internalName,
    conversationIds: (customer.conversationIds || []).map(id => id.toString()),
    appointmentIds: (customer.appointmentIds || []).map(id => id.toString()),
    productIds: (customer.productIds || []).map(id => id.toString()),
    noteIds: (customer.noteIds || []).map(id => id.toString()),
    pinnedMessageIds: (customer.pinnedMessageIds || []).map(id => id.toString()),
    pinnedConversationIds: (customer.pinnedConversationIds || []).map(id => id.toString()),
    messagePinningAllowedConversationIds: (customer.messagePinningAllowedConversationIds || []).map(id => id.toString()),
    tags: customer.tags || [],
    assignedStaffId: customer.assignedStaffId?._id?.toString(),
    assignedStaffName: (customer.assignedStaffId as IUser)?.name,
    lastInteractionAt: new Date(customer.lastInteractionAt),
    createdAt: new Date(customer.createdAt as Date),
    interactionStatus: customer.interactionStatus as CustomerInteractionStatus,
    lastMessagePreview: customer.lastMessagePreview,
    lastMessageTimestamp: customer.lastMessageTimestamp ? new Date(customer.lastMessageTimestamp) : undefined,
    isAppointmentDisabled: customer.isAppointmentDisabled,
  };
}

export async function getCurrentCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
  await dbConnect();
  const customer = await CustomerModel.findById(customerId)
    .populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');
  if (!customer) return null;
  
  return {
    id: (customer._id as Types.ObjectId).toString(),
    phoneNumber: customer.phoneNumber,
    name: customer.name || `Người dùng ${customer.phoneNumber}`,
    internalName: customer.internalName,
    email: customer.email,
    address: customer.address,
    dateOfBirth: customer.dateOfBirth,
    gender: customer.gender,
    notes: customer.notes,
    conversationIds: (customer.conversationIds || []).map(id => id.toString()),
    appointmentIds: (customer.appointmentIds || []).map(id => id.toString()),
    productIds: (customer.productIds || []).map(id => id.toString()),
    noteIds: (customer.noteIds || []).map(id => id.toString()),
    pinnedMessageIds: (customer.pinnedMessageIds || []).map(id => id.toString()),
    pinnedConversationIds: (customer.pinnedConversationIds || []).map(id => id.toString()),
    messagePinningAllowedConversationIds: (customer.messagePinningAllowedConversationIds || []).map(id => id.toString()),
    tags: customer.tags || [],
    assignedStaffId: customer.assignedStaffId?._id?.toString(),
    assignedStaffName: (customer.assignedStaffId as IUser)?.name,
    lastInteractionAt: new Date(customer.lastInteractionAt),
    createdAt: new Date(customer.createdAt as Date),
    interactionStatus: customer.interactionStatus as CustomerInteractionStatus,
    lastMessagePreview: customer.lastMessagePreview,
    lastMessageTimestamp: customer.lastMessageTimestamp ? new Date(customer.lastMessageTimestamp) : undefined,
    isAppointmentDisabled: customer.isAppointmentDisabled,
  };
}

export async function sendStaffMessage(
  staffSession: UserSession,
  customerId: string,
  conversationId: string,
  messageContent: string
): Promise<Message> {
  console.log("Action: sendStaffMessage received:", { staffSessionId: staffSession.id, customerId, conversationId, messageContent: messageContent.substring(0, 50) + "..." });
  await dbConnect();
  if (staffSession.role !== 'staff' && staffSession.role !== 'admin') {
    throw new Error("Không được phép gửi tin nhắn.");
  }
  const customer = await CustomerModel.findById(customerId);
  if (!customer) {
    throw new Error("Không tìm thấy khách hàng.");
  }
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Mã cuộc trò chuyện không hợp lệ.");
  }
  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) {
    throw new Error("Không tìm thấy cuộc trò chuyện.");
  }
  if (conversation.customerId.toString() !== customerId) {
    throw new Error("Cuộc trò chuyện không thuộc về khách hàng này.");
  }


  const staffMessageData: Partial<IMessage> = {
    sender: 'ai',
    content: messageContent,
    timestamp: new Date(),
    //@ts-ignore
    name: staffSession.name || (staffSession.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'),
    //@ts-ignore
    customerId: (customer._id as Types.ObjectId),
    userId: new mongoose.Types.ObjectId(staffSession.id) as any,
    //@ts-ignore
    conversationId: new mongoose.Types.ObjectId(conversationId),
  };
  console.log("Action: staffMessageData to be saved:", JSON.stringify(staffMessageData));
  const savedStaffMessageDoc = await new MessageModel(staffMessageData).save();
  console.log("Action: savedStaffMessageDoc from DB:", JSON.stringify(savedStaffMessageDoc));
  const savedMessageWithConvId = { ...transformMessageDocToMessage(savedStaffMessageDoc), conversationId };
  console.log("Action: savedMessageWithConvId to be returned:", JSON.stringify(savedMessageWithConvId));


  await CustomerModel.findByIdAndUpdate(customerId, {
    lastInteractionAt: new Date(),
    interactionStatus: 'replied_by_staff',
    lastMessagePreview: messageContent.substring(0, 100),
    lastMessageTimestamp: new Date(),
  });

  await ConversationModel.findByIdAndUpdate(conversationId, {
    $push: { messageIds: savedStaffMessageDoc._id },
    lastMessageTimestamp: savedStaffMessageDoc.timestamp,
    lastMessagePreview: savedStaffMessageDoc.content.substring(0, 100),
    $addToSet: { participants: { userId: staffSession.id, role: staffSession.role, name: staffSession.name, phoneNumber: staffSession.phoneNumber } }
  });

  // Emit chat reply notification for staff messages
  emitChatReplyNotification({
    customerId: customerId,
    customerName: customer.name,
    replyContent: messageContent,
    conversationId: conversationId,
    staffName: staffSession.name,
    sender: 'staff'
  });

  return savedMessageWithConvId;
}


export async function editStaffMessage(
  messageId: string,
  newContent: string,
  staffSession: UserSession
): Promise<Message | null> {
  await dbConnect();
  const message = await MessageModel.findById(messageId);

  if (!message) {
    throw new Error("Không tìm thấy tin nhắn.");
  }

  // Kiểm tra quyền sửa tin nhắn
  let hasPermission = false;

  // Admin luôn có quyền
  if (staffSession.role === 'admin') {
    hasPermission = true;
  }
  // Staff có quyền nếu là người gửi tin nhắn hoặc tin nhắn là của AI
  else if (staffSession.role === 'staff') {
    hasPermission = message.sender === 'ai' || message.userId?.toString() === staffSession.id;
  }

  if (!hasPermission) {
    throw new Error("Bạn không có quyền chỉnh sửa tin nhắn này.");
  }

  message.content = newContent;
  message.updatedAt = new Date();
  await message.save();

  let conversationIdString: string | undefined = message.conversationId?.toString();

  if (conversationIdString) {
    const conversation = await ConversationModel.findById(conversationIdString);
    if (conversation && conversation.lastMessageTimestamp && conversation.lastMessageTimestamp.getTime() <= message.timestamp.getTime()) {
      const lastMessageInConv = await MessageModel.findOne({ conversationId: conversation._id }).sort({ timestamp: -1 });
      if (lastMessageInConv) {
        await ConversationModel.findByIdAndUpdate(conversation._id, {
          lastMessagePreview: lastMessageInConv.content.substring(0, 100),
          lastMessageTimestamp: lastMessageInConv.timestamp,
        });
      }
    }
  }
  //@ts-ignore
  if (message.customerId) {
    //@ts-ignore
    const customer = await CustomerModel.findById(message.customerId);
    if (customer && customer.lastMessageTimestamp && message.updatedAt && customer.lastMessageTimestamp.getTime() <= message.timestamp.getTime()) {
      const lastMessageForCustomer = await MessageModel.findOne({ customerId: customer._id, conversationId: conversationIdString ? new Types.ObjectId(conversationIdString) : undefined }).sort({ timestamp: -1 });
      if (lastMessageForCustomer) {
        await CustomerModel.findByIdAndUpdate(customer._id, {
          lastMessagePreview: lastMessageForCustomer.content.substring(0, 100),
          lastMessageTimestamp: lastMessageForCustomer.timestamp,
        });
      }
    }
  }

  return { ...transformMessageDocToMessage(message), conversationId: conversationIdString };
}

export async function deleteStaffMessage(
  messageId: string,
  staffSession: UserSession
): Promise<{ success: boolean; customerId?: string, conversationId?: string }> {
  await dbConnect();
  const message = await MessageModel.findById(messageId);

  if (!message) {
    throw new Error("Không tìm thấy tin nhắn.");
  }

  // Kiểm tra quyền xóa tin nhắn
  let hasPermission = false;

  // Admin luôn có quyền
  if (staffSession.role === 'admin') {
    hasPermission = true;
  }
  // Staff có quyền nếu là người gửi tin nhắn hoặc tin nhắn là của AI
  else if (staffSession.role === 'staff') {
    hasPermission = message.sender === 'ai' || message.userId?.toString() === staffSession.id;
  }

  if (!hasPermission) {
    throw new Error("Bạn không có quyền xóa tin nhắn này.");
  }

  //@ts-ignore
  const customerIdString = message.customerId?.toString();
  let conversationIdString: string | undefined = message.conversationId?.toString();

  if (conversationIdString) {
    const conversation = await ConversationModel.findById(conversationIdString);
    if (conversation) {
      conversation.messageIds = conversation.messageIds.filter(id => !id.equals(new mongoose.Types.ObjectId(messageId)));
      conversation.pinnedMessageIds = (conversation.pinnedMessageIds || []).filter(id => !id.equals(new mongoose.Types.ObjectId(messageId)));

      const lastMessageInConv = await MessageModel.findOne({
        conversationId: conversation._id,
        _id: { $ne: new mongoose.Types.ObjectId(messageId) }
      }).sort({ timestamp: -1 });

      if (lastMessageInConv) {
        conversation.lastMessagePreview = lastMessageInConv.content.substring(0, 100);
        conversation.lastMessageTimestamp = lastMessageInConv.timestamp;
      } else {
        conversation.lastMessagePreview = '';
        conversation.lastMessageTimestamp = conversation.createdAt;
      }
      await conversation.save();
    }
  }

  await MessageModel.findByIdAndDelete(messageId);

  if (customerIdString) {
    const customer = await CustomerModel.findById(customerIdString);
    if (customer) {
      const conversationsOfCustomer = await ConversationModel.find({ customerId: customer._id }).sort({ lastMessageTimestamp: -1 }).limit(1);
      if (conversationsOfCustomer.length > 0) {
        const latestConversation = conversationsOfCustomer[0];
        await CustomerModel.findByIdAndUpdate(customerIdString, {
          lastMessagePreview: latestConversation.lastMessagePreview,
          lastMessageTimestamp: latestConversation.lastMessageTimestamp,
        });
      } else {
        await CustomerModel.findByIdAndUpdate(customerIdString, {
          lastMessagePreview: '',
          lastMessageTimestamp: customer.createdAt,
        });
      }
    }
  }
  return { success: true, customerId: customerIdString, conversationId: conversationIdString };
}

// --- Q&A Management Actions ---
export async function getKeywordMappings(): Promise<KeywordMapping[]> {
  await dbConnect();
  const docs = await KeywordMappingModel.find({}).sort({ createdAt: -1 });
  return docs.map(transformKeywordMappingDoc);
}

export async function createKeywordMapping(data: Omit<KeywordMapping, 'id' | 'createdAt' | 'updatedAt'>): Promise<KeywordMapping> {
  await dbConnect();
  const newDoc = new KeywordMappingModel(data);
  await newDoc.save();
  return transformKeywordMappingDoc(newDoc);
}

export async function updateKeywordMapping(id: string, data: Partial<Omit<KeywordMapping, 'id' | 'createdAt' | 'updatedAt'>>): Promise<KeywordMapping | null> {
  await dbConnect();
  const updatedDoc = await KeywordMappingModel.findByIdAndUpdate(id, data, { new: true });
  return updatedDoc ? transformKeywordMappingDoc(updatedDoc) : null;
}

export async function deleteKeywordMapping(id: string): Promise<{ success: boolean }> {
  await dbConnect();
  await KeywordMappingModel.findByIdAndDelete(id);
  return { success: true };
}

export async function getTrainingDataItems(): Promise<TrainingData[]> {
  await dbConnect();
  const docs = await TrainingDataModel.find({}).sort({ createdAt: -1 });
  return docs.map(transformTrainingDataDoc);
}

export async function createTrainingData(data: Omit<TrainingData, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: TrainingDataStatus }): Promise<TrainingData> {
  await dbConnect();
  const newDoc = new TrainingDataModel({ ...data, status: data.status || 'pending_review' });
  await newDoc.save();
  return transformTrainingDataDoc(newDoc);
}

export async function updateTrainingDataItem(id: string, data: Partial<Omit<TrainingData, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TrainingData | null> {
  await dbConnect();
  const updatedDoc = await TrainingDataModel.findByIdAndUpdate(id, data, { new: true });
  return updatedDoc ? transformTrainingDataDoc(updatedDoc) : null;
}

export async function deleteTrainingDataItem(id: string): Promise<{ success: boolean }> {
  await dbConnect();
  await TrainingDataModel.findByIdAndDelete(id);
  return { success: true };
}

// --- Appointment Rule Management Actions ---
export async function getAppointmentRules(): Promise<LibAppointmentRuleType[]> {
  await dbConnect();
  const docs = await AppointmentRuleModel.find({}).sort({ name: 1 });
  return docs.map(transformAppointmentRuleDoc);
}

export async function createAppointmentRule(data: Omit<LibAppointmentRuleType, 'id' | 'createdAt' | 'updatedAt'>): Promise<LibAppointmentRuleType> {
  await dbConnect();
  const newDoc = new AppointmentRuleModel(data);
  await newDoc.save();
  return transformAppointmentRuleDoc(newDoc);
}

export async function updateAppointmentRule(id: string, data: Partial<Omit<LibAppointmentRuleType, 'id' | 'createdAt' | 'updatedAt'>>): Promise<LibAppointmentRuleType | null> {
  await dbConnect();
  const updatedDoc = await AppointmentRuleModel.findByIdAndUpdate(id, data, { new: true });
  return updatedDoc ? transformAppointmentRuleDoc(updatedDoc) : null;
}

export async function deleteAppointmentRule(id: string): Promise<{ success: boolean }> {
  await dbConnect();
  await AppointmentRuleModel.findByIdAndDelete(id);
  return { success: true };
}

// --- Staff: Update Customer Internal Name ---
export async function updateCustomerInternalName(customerId: string, internalName: string): Promise<CustomerProfile | null> {
  await dbConnect();
  const customer = await CustomerModel.findByIdAndUpdate(
    customerId,
    { internalName: internalName, lastInteractionAt: new Date() },
    { new: true }
  ).populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');
  if (!customer) throw new Error("Không tìm thấy khách hàng.");
  //@ts-ignore
  return {
    id: (customer._id as Types.ObjectId).toString(),
    phoneNumber: customer.phoneNumber,
    name: customer.name || `Người dùng ${customer.phoneNumber}`,
    internalName: customer.internalName,
    conversationIds: (customer.conversationIds || []).map(id => id.toString()),
    appointmentIds: (customer.appointmentIds || []).map(id => id.toString()),
    productIds: (customer.productIds || []).map(id => id.toString()),
    noteIds: (customer.noteIds || []).map(id => id.toString()),
    pinnedConversationIds: (customer.pinnedConversationIds || []).map(id => id.toString()),
    tags: customer.tags || [],
    assignedStaffId: customer.assignedStaffId?._id?.toString(),
    assignedStaffName: (customer.assignedStaffId as IUser)?.name,
    lastInteractionAt: new Date(customer.lastInteractionAt),
    createdAt: new Date(customer.createdAt as Date),
    interactionStatus: customer.interactionStatus as CustomerInteractionStatus,
    lastMessagePreview: customer.lastMessagePreview,
    lastMessageTimestamp: customer.lastMessageTimestamp ? new Date(customer.lastMessageTimestamp) : undefined,
  };
}

// --- Appointment Management Actions ---

const NO_STAFF_MODAL_VALUE = "__NO_STAFF_ASSIGNED__";

export async function getAppointments(filters: {
  customerId?: string;
  date?: string;
  dates?: string[];
  staffId?: string;
} = {}): Promise<AppointmentDetails[]> {
  await dbConnect();
  try {
    const query: any = {
      status: { $in: ['booked', 'pending_confirmation', 'rescheduled'] }
    };

    if (filters.customerId) {
      query.customerId = new mongoose.Types.ObjectId(filters.customerId);
    }

    if (filters.date) {
      query.date = filters.date;
    } else if (filters.dates && filters.dates.length > 0) {
      query.date = { $in: filters.dates };
    }

    if (filters.staffId) {
      query.staffId = new mongoose.Types.ObjectId(filters.staffId);
    }

    const appointments = await AppointmentModel.find(query)
      .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber internalName')
      .populate<{ staffId: IUser }>('staffId', 'name')
      .sort({ date: 1, time: 1 })
      .lean();

    return appointments.map(appointment => ({
      appointmentId: appointment._id.toString(),
      userId: (appointment.customerId as any)?._id?.toString(),
      service: appointment.service,
      date: appointment.date,
      time: appointment.time,
      branch: appointment.branch || '',
      status: appointment.status,
      notes: appointment.notes || '',
      staffId: (appointment.staffId as any)?._id?.toString(),
      customerName: (appointment.customerId as any)?.name || appointment.customerPhoneNumber || '',
      customerPhoneNumber: (appointment.customerId as any)?.phoneNumber || '',
      internalName: (appointment.customerId as any)?.internalName || '',
      staffName: (appointment.staffId as any)?.name || '',
      recurrenceType: appointment.recurrenceType,
      recurrenceCount: appointment.recurrenceCount,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      productId: appointment.productId?.toString(),
      branchId: appointment.branchId?.toString(),
    }));
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }
}

export async function deleteExistingAppointment(appointmentId: string): Promise<void> {
  await dbConnect();
  try {
    const appointment = await AppointmentModel.findById(appointmentId).populate('customerId');
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Update appointment status to cancelled
    appointment.status = 'cancelled';
    await appointment.save();

    // Remove appointment ID from customer's appointmentIds array
    await CustomerModel.findByIdAndUpdate(
      appointment.customerId,
      { $pull: { appointmentIds: appointment._id } }
    );

    // Send cancellation message to chat
    console.log('[DEBUG] deleteExistingAppointment - Sending cancellation message for appointment:', appointmentId);
    const appSettings = await getAppSettings();
    console.log('[DEBUG] deleteExistingAppointment - cancelledAppointmentMessageTemplate exists:', !!appSettings?.cancelledAppointmentMessageTemplate);
    
    if (appSettings?.cancelledAppointmentMessageTemplate) {
      const appointmentDetails = transformAppointmentDocToDetails(appointment);
      console.log('[DEBUG] deleteExistingAppointment - appointment details:', appointmentDetails);
      
      const cancellationMessage = formatAppointmentMessage(
        appSettings.cancelledAppointmentMessageTemplate,
        appointmentDetails,
        'Lịch hẹn đã được hủy thành công.'
      );
      console.log('[DEBUG] deleteExistingAppointment - formatted message:', cancellationMessage);

      // Find the latest conversation for this customer
      const latestConversation = await ConversationModel.findOne({
        customerId: appointment.customerId
      }).sort({ updatedAt: -1 });
      console.log('[DEBUG] deleteExistingAppointment - conversation found:', !!latestConversation, latestConversation?._id);

      if (latestConversation) {
        const systemMessage = await createSystemMessage({
          conversationId: (latestConversation._id as mongoose.Types.ObjectId).toString(),
          content: cancellationMessage
        });
        console.log('[DEBUG] deleteExistingAppointment - system message created:', systemMessage);
      }
    } else {
      console.log('[DEBUG] deleteExistingAppointment - No cancellation template found');
    }
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    throw error;
  }
}

export async function createNewAppointment(
  data: Omit<AppointmentDetails, 'appointmentId' | 'createdAt' | 'updatedAt' | 'customerName' | 'customerPhoneNumber' | 'staffName' | 'userId'> & { customerId: string }
): Promise<AppointmentDetails> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(data.customerId)) {
    throw new Error("Mã khách hàng không hợp lệ.");
  }

  const customer = await CustomerModel.findById(data.customerId);
  if (!customer) {
    throw new Error("Không tìm thấy khách hàng.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    throw new Error("Định dạng ngày không hợp lệ. Phải là YYYY-MM-DD.");
  }


  const appointmentData: Partial<IAppointment> = {
    customerId: new mongoose.Types.ObjectId(data.customerId) as any,
    service: data.service,
    productId: data.productId ? new mongoose.Types.ObjectId(data.productId) as any : undefined,
    date: data.date,
    time: data.time,
    branch: data.branch,
    branchId: data.branchId ? new mongoose.Types.ObjectId(data.branchId) as any : undefined,
    status: data.status || 'booked',
    notes: data.notes,
    packageType: data.packageType,
    priority: data.priority,
    recurrenceType: data.recurrenceType || 'none',
    recurrenceCount: data.recurrenceCount || 1,
  };
  if (data.staffId && mongoose.Types.ObjectId.isValid(data.staffId) && data.staffId !== NO_STAFF_MODAL_VALUE) {
    (appointmentData as any).staffId = new mongoose.Types.ObjectId(data.staffId) as any;
  } else {
    delete appointmentData.staffId;
  }


  const newAppointmentDoc = new AppointmentModel(appointmentData);
  await newAppointmentDoc.save();
  console.log("[ACTIONS] Manually created new appointment:", JSON.stringify(newAppointmentDoc));

  await CustomerModel.findByIdAndUpdate(data.customerId, {
    $addToSet: { appointmentIds: newAppointmentDoc._id }
  });

  // Schedule reminder for the new appointment
  try {
    //@ts-ignore
    await AppointmentReminderService.scheduleReminder(newAppointmentDoc._id);
  } catch (error) {
    console.error(`Failed to schedule reminder for appointment ${newAppointmentDoc._id}:`, error);
  }

  const populatedAppointment = await AppointmentModel.findById(newAppointmentDoc._id)
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate<{ staffId: IUser }>('staffId', 'name');

  if (!populatedAppointment) throw new Error("Không thể tạo hoặc tìm lại lịch hẹn.");

  return transformAppointmentDocToDetails(populatedAppointment);
}

export async function updateExistingAppointment(
  appointmentId: string,
  data: Partial<Omit<AppointmentDetails, 'appointmentId' | 'createdAt' | 'updatedAt' | 'customerName' | 'customerPhoneNumber' | 'staffName' | 'userId'>>
): Promise<AppointmentDetails | null> {
  await dbConnect();
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    throw new Error("Định dạng ngày không hợp lệ khi cập nhật. Phải là YYYY-MM-DD.");
  }

  // Get original appointment for comparison
  const originalAppointment = await AppointmentModel.findById(appointmentId);

  const updateData: any = { ...data, updatedAt: new Date() };
  delete updateData.customerId;
  delete updateData.userId;

  if (data.staffId && mongoose.Types.ObjectId.isValid(data.staffId) && data.staffId !== NO_STAFF_MODAL_VALUE) {
    (updateData as any).staffId = new mongoose.Types.ObjectId(data.staffId) as any;
  } else if (data.staffId === null || data.staffId === '' || data.staffId === undefined || data.staffId === NO_STAFF_MODAL_VALUE) {
    if (!updateData.$unset) updateData.$unset = {};
    updateData.$unset.staffId = "";
    delete updateData.staffId;
  }

  if (data.recurrenceType) updateData.recurrenceType = data.recurrenceType;
  if (data.recurrenceCount) updateData.recurrenceCount = data.recurrenceCount;


  const updatedAppointmentDoc = await AppointmentModel.findByIdAndUpdate(
    appointmentId,
    updateData,
    { new: true }
  )
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate<{ staffId: IUser }>('staffId', 'name');
  console.log("[ACTIONS] Manually updated appointment:", appointmentId, "with data:", JSON.stringify(updateData), "Result:", JSON.stringify(updatedAppointmentDoc));

  // Check if this is a reschedule (date or time changed)
  const isReschedule = originalAppointment && updatedAppointmentDoc && (
    (data.date && data.date !== originalAppointment.date) ||
    (data.time && data.time !== originalAppointment.time)
  );

  // Send reschedule message to chat if date/time changed
  if (isReschedule && updatedAppointmentDoc) {
    const appSettings = await getAppSettings();
    if (appSettings?.rescheduledAppointmentMessageTemplate) {
      const appointmentDetails = transformAppointmentDocToDetails(updatedAppointmentDoc);
      const rescheduleMessage = formatAppointmentMessage(
        appSettings.rescheduledAppointmentMessageTemplate,
        appointmentDetails,
        'Lịch hẹn đã được đổi thành công.'
      );

      // Find the latest conversation for this customer
      const latestConversation = await ConversationModel.findOne({
        customerId: updatedAppointmentDoc.customerId
      }).sort({ updatedAt: -1 });

      if (latestConversation) {
        await createSystemMessage({
          conversationId: (latestConversation._id as mongoose.Types.ObjectId).toString(),
          content: rescheduleMessage
        });
      }
    }
  }

  return updatedAppointmentDoc ? transformAppointmentDocToDetails(updatedAppointmentDoc) : null;
}

export async function getCustomerListForSelect(): Promise<{ id: string; name: string; phoneNumber: string }[]> {
  await dbConnect();
  const customers = await CustomerModel.find({}, 'name phoneNumber').sort({ name: 1 });
  return customers.map(c => ({
    id: (c._id as Types.ObjectId).toString(),
    name: c.name || `Người dùng ${c.phoneNumber}`,
    phoneNumber: c.phoneNumber
  }));
}

// --- Dashboard Actions ---
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  await dbConnect();
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const sevenDaysAgo = subDays(new Date(), 7);

  const activeUserCount = await CustomerModel.countDocuments({ lastInteractionAt: { $gte: sevenDaysAgo } });
  const chatsTodayCount = await MessageModel.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd } });
  const openIssuesCount = await CustomerModel.countDocuments({ tags: "Cần hỗ trợ" });

  const recentAppointmentsDocs = await AppointmentModel.find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate<{ staffId: IUser }>('staffId', 'name');

  const recentCustomersDocs = await CustomerModel.find({}).sort({ createdAt: -1 }).limit(5);

  return {
    activeUserCount,
    chatsTodayCount,
    openIssuesCount,
    recentAppointments: recentAppointmentsDocs.map(transformAppointmentDocToDetails),
    recentCustomers: recentCustomersDocs.map(doc => ({
      id: (doc._id as Types.ObjectId).toString(),
      name: doc.name || `Người dùng ${doc.phoneNumber}`,
      phoneNumber: doc.phoneNumber,
      createdAt: new Date(doc.createdAt as Date),
    })),
    systemStatus: 'Optimal',
  };
}

export async function getStaffDashboardStats(staffId: string): Promise<StaffDashboardStats> {
  await dbConnect();
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const todayDateString = formatISO(todayStart, { representation: 'date' });

  const activeChatsAssignedToMeCount = await CustomerModel.countDocuments({
    assignedStaffId: new mongoose.Types.ObjectId(staffId) as any,
    lastInteractionAt: { $gte: todayStart, $lt: todayEnd },
  });

  const myAppointmentsTodayCount = await AppointmentModel.countDocuments({
    staffId: new mongoose.Types.ObjectId(staffId) as any,
    date: todayDateString,
    status: { $nin: ['cancelled', 'completed'] }
  });

  const totalAssignedToMeCount = await CustomerModel.countDocuments({ assignedStaffId: new mongoose.Types.ObjectId(staffId) as any });

  return {
    activeChatsAssignedToMeCount,
    myAppointmentsTodayCount,
    totalAssignedToMeCount,
  };
}

// --- Note CRUD Actions ---
export async function addNoteToCustomer(
  customerId: string,
  staffId: string,
  content: string,
  imageDataUri?: string,
  imageFileName?: string
): Promise<Note> {
  await dbConnect();
  console.log("[addNoteToCustomer] Called with:", { customerId, staffId, contentPresent: !!content, imagePresent: !!imageDataUri });

  if (!mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(staffId)) {
    console.error("[addNoteToCustomer] Invalid customer or staff ID.");
    throw new Error("Invalid customer or staff ID.");
  }

  if (!content?.trim() && !imageDataUri) {
    console.error("[addNoteToCustomer] Note must have content or image.");
    throw new Error("Ghi chú phải có nội dung văn bản hoặc hình ảnh.");
  }

  try {
    let imageUrl: string | undefined;
    let imagePublicId: string | undefined;

    // Upload image to Cloudinary if provided
    if (imageDataUri && imageFileName) {
      const uploadResult = await uploadToCloudinary(imageDataUri, imageFileName, 'triruto_chat/notes');
      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    }

    const noteDoc = new NoteModel({
      customerId: new mongoose.Types.ObjectId(customerId) as any,
      staffId: new mongoose.Types.ObjectId(staffId) as any,
      content: content?.trim(),
      imageUrl,
      imagePublicId,
      imageFileName,
    });
    await noteDoc.save();
    console.log("[addNoteToCustomer] Note saved, ID:", noteDoc._id);

    await CustomerModel.findByIdAndUpdate(customerId, { $push: { noteIds: noteDoc._id } });
    console.log("[addNoteToCustomer] Customer updated with new note ID.");

    const populatedNote = await NoteModel.findById(noteDoc._id).populate<{ staffId: IUser }>('staffId', 'name');
    if (!populatedNote) {
      console.error("[addNoteToCustomer] Failed to retrieve populated note after saving.");
      throw new Error("Failed to create or retrieve note.");
    }
    return transformNoteDocToNote(populatedNote);
  } catch (error: any) {
    console.error("[addNoteToCustomer] Error during note creation or update:", error);
    // Throw a more generic error or re-throw, depending on desired client feedback
    throw new Error(`Không thể thêm ghi chú: ${error.message || 'Lỗi không xác định từ server.'}`);
  }
}

export async function getNotesForCustomer(customerId: string): Promise<Note[]> {
  await dbConnect();
  const noteDocs = await NoteModel.find({ customerId: new mongoose.Types.ObjectId(customerId) as any })
    .populate<{ staffId: IUser }>('staffId', 'name')
    .sort({ createdAt: -1 });
  return noteDocs.map(transformNoteDocToNote);
}

export async function updateCustomerNote(noteId: string, staffId: string, content: string, imageDataUri?: string | null, imageFileName?: string | null): Promise<Note | null> {
  await dbConnect();
  const note = await NoteModel.findById(noteId);
  if (!note) throw new Error("Note not found.");
  const staffUser = await UserModel.findById(staffId);
  if (!staffUser) throw new Error("Staff user not found.");

  if (staffUser.role !== 'admin' && note.staffId.toString() !== staffId) {
    throw new Error("You are not authorized to edit this note.");
  }

  const trimmedContent = content?.trim();
  if (!trimmedContent && imageDataUri === null && !note.imageUrl) { // If trying to remove image and no text is left
    throw new Error("Ghi chú phải có nội dung văn bản hoặc hình ảnh.");
  }
  if (!trimmedContent && !imageDataUri && !note.imageUrl) { // If all content is empty
    throw new Error("Ghi chú phải có nội dung văn bản hoặc hình ảnh.");
  }


  note.content = trimmedContent;
  if (imageDataUri === null) {
    // Delete old image from Cloudinary if exists
    if (note.imagePublicId) {
      await deleteFromCloudinary(note.imagePublicId);
    }
    note.imageUrl = undefined;
    note.imagePublicId = undefined;
    note.imageFileName = undefined;
  } else if (imageDataUri && imageFileName) {
    // Delete old image from Cloudinary if exists
    if (note.imagePublicId) {
      await deleteFromCloudinary(note.imagePublicId);
    }
    // Upload new image to Cloudinary
    const uploadResult = await uploadToCloudinary(imageDataUri, imageFileName, 'triruto_chat/notes');
    note.imageUrl = uploadResult.secure_url;
    note.imagePublicId = uploadResult.public_id;
    //@ts-ignore
    note.imageFileName = imageFileName;
  }
  await note.save();
  const populatedNote = await NoteModel.findById(note._id).populate<{ staffId: IUser }>('staffId', 'name');
  return populatedNote ? transformNoteDocToNote(populatedNote) : null;
}

export async function deleteCustomerNote(noteId: string, staffId: string): Promise<{ success: boolean }> {
  await dbConnect();
  const note = await NoteModel.findById(noteId);
  if (!note) throw new Error("Note not found.");

  const staffUser = await UserModel.findById(staffId);
  if (!staffUser) throw new Error("Staff user not found.");

  if (staffUser.role !== 'admin' && note.staffId.toString() !== staffId) {
    throw new Error("You are not authorized to delete this note.");
  }
  await NoteModel.findByIdAndDelete(noteId);
  await CustomerModel.findByIdAndUpdate(note.customerId, { $pull: { noteIds: noteId as any } });
  return { success: true };
}

function transformProductDocToProduct(doc: IProduct): ProductItem {
  return {
    id: (doc._id as Types.ObjectId).toString(),
    name: doc.name,
    description: doc.description,
    price: doc.price,
    category: doc.category,
    imageUrl: doc.imageUrl,
    isActive: doc.isActive,
    isSchedulable: doc.isSchedulable,
    schedulingRules: doc.schedulingRules as ProductSchedulingRules, // Assuming direct mapping is okay, adjust if needed
    defaultSessions: doc.defaultSessions,
    expiryDays: doc.expiryDays,
    expiryReminderTemplate: doc.expiryReminderTemplate,
    expiryReminderDaysBefore: doc.expiryReminderDaysBefore,
    type: doc.type as 'product' | 'service', // Cast to the new type
    expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null, // Include expiryDate and handle null
    createdAt: new Date(doc.createdAt as Date),
    updatedAt: new Date(doc.updatedAt as Date),
  };
}

function transformReminderDocToReminder(doc: any): Reminder {
  const staffName = doc.staffId && typeof doc.staffId === 'object' && 'name' in doc.staffId
    ? doc.staffId.name
    : undefined;

  const customerName = doc.customerId && typeof doc.customerId === 'object' && 'name' in doc.customerId
    ? doc.customerId.name || `Người dùng ${(doc.customerId as ICustomer).phoneNumber}`
    : undefined;

  return {
    id: doc._id.toString(),
    customerId: typeof doc.customerId === 'string' ? doc.customerId : (doc.customerId && doc.customerId._id ? doc.customerId._id.toString() : ''),
    staffId: typeof doc.staffId === 'string' ? doc.staffId : (doc.staffId && doc.staffId._id ? doc.staffId._id.toString() : ''),
    customerName,
    staffName,
    title: doc.title,
    description: doc.description,
    dueDate: new Date(doc.dueDate),
    status: doc.status as ReminderStatus,
    priority: doc.priority as ReminderPriority,
    completedAt: doc.completedAt ? new Date(doc.completedAt) : undefined,
    createdAt: new Date(doc.createdAt as Date),
    updatedAt: new Date(doc.updatedAt as Date),
    reminderType: doc.reminderType as 'one_time' | 'recurring', // Include reminderType
    interval: doc.interval, // Include interval
  } as Reminder; // Explicitly cast to Reminder
}

export async function getAllProducts(): Promise<ProductItem[]> {
  await dbConnect();
  try {
    const products = await ProductModel.find({}).lean();
    return products.map(transformProductDocToProduct);
  } catch (error) {
    console.error("Error fetching all products:", error);
    throw new Error("Failed to fetch products.");
  }
}

export async function getProductById(productId: string): Promise<ProductItem | null> {
  await dbConnect();
  const product = await ProductModel.findById(productId).lean(); // Add .lean()
  return product ? transformProductDocToProduct(product as IProduct) : null;
}

export async function createProduct(data: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductItem> {
  await dbConnect();
  try {
    const newProduct = new ProductModel({
      ...data,
      // Ensure new fields are included
      type: data.type,
      expiryDate: data.expiryDate || null, // Store expiryDate, default to null if not provided
    });
    const savedProduct = await newProduct.save();
    return transformProductDocToProduct(savedProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    throw new Error("Failed to create product.");
  }
}

export async function updateProduct(
  productId: string,
  data: Partial<
    Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'> &
    { type?: 'product' | 'service'; expiryDate?: Date | null }
  >
): Promise<ProductItem | null> {
  await dbConnect();
  try {
    const updatePayload: any = {
      ...data,
      updatedAt: new Date(), // Always update timestamp
    };

    // Explicitly set type if it exists in data to handle potential undefined from Partial
    if (data.type !== undefined) {
      updatePayload.type = data.type;
    }
    // Explicitly set expiryDate if it exists in data (can be null)
    if (data.expiryDate !== undefined) {
      updatePayload.expiryDate = data.expiryDate;
    }

    const updatedProduct = await ProductModel.findByIdAndUpdate(
      productId,
      updatePayload,
      { new: true }
    ).lean();

    if (!updatedProduct) {
      return null;
    }
    return transformProductDocToProduct(updatedProduct);
  } catch (error) {
    console.error(`Error updating product ${productId}:`, error);
    throw new Error("Failed to update product.");
  }
}

export async function deleteProduct(productId: string): Promise<{ success: boolean }> {
  await dbConnect();
  const result = await ProductModel.findByIdAndDelete(productId);
  return { success: !!result };
}

export async function getAllReminders(filters: {
  staffId?: string;
  customerId?: string;
  status?: ReminderStatus;
  dueBefore?: Date;
  dueAfter?: Date;
} = {}): Promise<Reminder[]> {
  await dbConnect();

  const query: any = {};

  if (filters.staffId) query.staffId = filters.staffId;
  if (filters.customerId) query.customerId = filters.customerId;
  if (filters.status) query.status = filters.status;

  if (filters.dueBefore || filters.dueAfter) {
    query.dueDate = {};
    if (filters.dueBefore) query.dueDate.$lte = filters.dueBefore;
    if (filters.dueAfter) query.dueDate.$gte = filters.dueAfter;
  }

  const reminders = await ReminderModel.find(query)
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate('staffId', 'name')
    .sort({ dueDate: 1 });

  return reminders.map(transformReminderDocToReminder);
}

export async function getReminderById(reminderId: string): Promise<Reminder | null> {
  await dbConnect();
  const reminder = await ReminderModel.findById(reminderId)
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate('staffId', 'name');

  return reminder ? transformReminderDocToReminder(reminder) : null;
}

export async function createReminder(data: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'customerName' | 'staffName'>): Promise<Reminder> {
  await dbConnect();
  const newReminder = new ReminderModel(data);
  const savedReminder = await newReminder.save();

  const populatedReminder = await ReminderModel.findById(savedReminder._id)
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate('staffId', 'name');

  if (!populatedReminder) throw new Error("Failed to populate created reminder");
  return transformReminderDocToReminder(populatedReminder);
}

export async function updateReminder(
  reminderId: string,
  data: Partial<Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'customerName' | 'staffName'>>
): Promise<Reminder | null> {
  await dbConnect();

  if (data.status === 'completed' && !data.completedAt) {
    data.completedAt = new Date();
  }

  const updatedReminderDoc = await ReminderModel.findByIdAndUpdate(
    reminderId,
    { $set: data },
    { new: true }
  )
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate('staffId', 'name');

  return updatedReminderDoc ? transformReminderDocToReminder(updatedReminderDoc) : null;
}

export async function deleteReminder(reminderId: string): Promise<{ success: boolean }> {
  await dbConnect();
  const result = await ReminderModel.findByIdAndDelete(reminderId);
  return { success: !!result };
}

export async function getUpcomingRemindersForStaff(staffId: string): Promise<Reminder[]> {
  await dbConnect();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endOfNextWeek = new Date(today);
  endOfNextWeek.setDate(today.getDate() + 7);
  endOfNextWeek.setHours(23, 59, 59, 999);

  const reminders = await ReminderModel.find({
    staffId,
    status: 'pending',
    dueDate: { $gte: today, $lte: endOfNextWeek }
  })
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate('staffId', 'name')
    .sort({ dueDate: 1 });

  return reminders.map(transformReminderDocToReminder);
}

export async function getOverdueRemindersForStaff(staffId: string): Promise<Reminder[]> {
  await dbConnect();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reminders = await ReminderModel.find({
    staffId,
    status: 'pending',
    dueDate: { $lt: today }
  })
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate('staffId', 'name')
    .sort({ dueDate: 1 });

  return reminders.map(transformReminderDocToReminder);
}

export async function getCustomersWithProductsAndReminders(staffId?: string): Promise<any[]> {
  await dbConnect();

  const query: any = {};
  if (staffId) {
    query.$or = [
      { assignedStaffId: new mongoose.Types.ObjectId(staffId) as any },
      { assignedStaffId: { $exists: false } }
    ];
  }

  const customers = await CustomerModel.find(query)
    .populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name')
    .sort({ lastInteractionAt: -1 });

  const result = [];

  for (const customer of customers) {
    const pendingRemindersCount = await ReminderModel.countDocuments({
      customerId: customer._id,
      status: 'pending'
    });

    result.push({
      id: (customer._id as Types.ObjectId).toString(),
      name: customer.name || `Người dùng ${customer.phoneNumber}`,
      phoneNumber: customer.phoneNumber,
      internalName: customer.internalName,
      lastInteractionAt: customer.lastInteractionAt,
      tags: customer.tags || [],
      assignedStaffId: customer.assignedStaffId?._id?.toString(),
      assignedStaffName: customer.assignedStaffId?.name,
      pendingRemindersCount,
      interactionStatus: customer.interactionStatus as CustomerInteractionStatus,
      lastMessagePreview: customer.lastMessagePreview,
      lastMessageTimestamp: customer.lastMessageTimestamp ? new Date(customer.lastMessageTimestamp) : undefined,
    });
  }

  return result;
}

export async function getAllCustomerTags(): Promise<string[]> {
  await dbConnect();
  try {
    const tags = await CustomerModel.distinct('tags');
    return tags.filter(tag => typeof tag === 'string' && tag.trim() !== '');
  } catch (error) {
    console.error("Error fetching all customer tags:", error);
    return [];
  }
}

export async function pinMessageToConversation(conversationId: string, messageId: string, userSession: UserSession): Promise<Conversation | null> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Mã cuộc trò chuyện hoặc tin nhắn không hợp lệ.");
  }
  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) throw new Error("Không tìm thấy cuộc trò chuyện.");

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
    hasPermission = conversation.participants?.some(p => p.userId?.toString() === userSession.id) || false;
  }
  // Customer có quyền nếu là chủ cuộc trò chuyện
  else if (userSession.role === 'customer') {
    hasPermission = conversation.customerId.toString() === userSession.id;
  }

  if (!hasPermission) {
    throw new Error("Bạn không có quyền ghim tin nhắn trong cuộc trò chuyện này.");
  }

  const messageObjectId = new mongoose.Types.ObjectId(messageId);
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
  return {
    ...conversation.toObject(),
    //@ts-ignore
    id: conversation._id.toString(),
    customerId: conversation.customerId.toString(),
    //@ts-ignore
    staffId: conversation.staffId?.toString(),
    messageIds: conversation.messageIds.map(id => id.toString()),
    pinnedMessageIds: conversation.pinnedMessageIds.map(id => id.toString()),
    //@ts-ignore
    participants: (conversation.participants || []).map(p => ({
      ...p,
      userId: p.userId?.toString() || ''
    })),
    createdAt: new Date(conversation.createdAt),
    updatedAt: new Date(conversation.updatedAt),
    lastMessageTimestamp: conversation.lastMessageTimestamp ? new Date(conversation.lastMessageTimestamp) : undefined
  };
}

export async function unpinMessageFromConversation(conversationId: string, messageId: string, userSession: UserSession): Promise<Conversation | null> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Mã cuộc trò chuyện hoặc tin nhắn không hợp lệ.");
  }
  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) throw new Error("Không tìm thấy cuộc trò chuyện.");

  // Kiểm tra quyền bỏ ghim tin nhắn
  let hasPermission = false;

  // Admin luôn có quyền
  if (userSession.role === 'admin') {
    hasPermission = true;
  }
  // Staff có quyền nếu là người tham gia cuộc trò chuyện
  else if (userSession.role === 'staff') {
    //@ts-ignore
    hasPermission = conversation.participants?.some(p => p.userId?.toString() === userSession.id) || false;
  }
  // Customer có quyền nếu là chủ cuộc trò chuyện
  else if (userSession.role === 'customer') {
    hasPermission = conversation.customerId.toString() === userSession.id;
  }

  if (!hasPermission) {
    throw new Error("Bạn không có quyền bỏ ghim tin nhắn trong cuộc trò chuyện này.");
  }

  const messageObjectId = new mongoose.Types.ObjectId(messageId);
  conversation.pinnedMessageIds = (conversation.pinnedMessageIds || []).filter(id => !id.equals(messageObjectId));
  await conversation.save();

  // Return the updated conversation with populated messages
  const updatedConversation = await ConversationModel.findById(conversationId)
    .populate({
      path: 'messageIds',
      model: MessageModel,
      options: { sort: { timestamp: 1 } }
    })
    .populate({
      path: 'pinnedMessageIds',
      model: MessageModel
    });

  return transformConversationDoc(updatedConversation);
}


export async function getMessagesByIds(messageIds: string[]): Promise<Message[]> {
  await dbConnect();
  const objectIds = messageIds.map(id => {
    try {
      return new mongoose.Types.ObjectId(id);
    } catch (e) {
      console.warn(`Invalid ObjectId string for message: ${id}`);
      return null;
    }
  }).filter(id => id !== null) as mongoose.Types.ObjectId[];

  if (objectIds.length === 0) return [];
  const messageDocs = await MessageModel.find({ _id: { $in: objectIds } });
  const messagesMap = new Map(messageDocs.map(doc => [(doc._id as mongoose.Types.ObjectId).toString(), transformMessageDocToMessage(doc)]));
  return messageIds.map(id => messagesMap.get(id)).filter(Boolean) as Message[];
}


// --- Media History Actions ---
export async function getCustomerMediaMessages(customerId: string): Promise<Message[]> {
  await dbConnect();
  const messages = await MessageModel.find({
    customerId: new mongoose.Types.ObjectId(customerId) as any,
    $or: [
      // New Cloudinary URL format
      { content: { $regex: /^https:\/\/res\.cloudinary\.com\// } },
      // Legacy data URI format
      { content: { $regex: /^data:(image\/(jpeg|png|gif|webp|svg\+xml)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|plain|rtf|zip|x-rar-compressed|octet-stream))/ } }
    ]
  }).sort({ timestamp: -1 }); // KHÔNG có .limit()
  console.log(`[getCustomerMediaMessages] Found ${messages.length} media messages for customerId ${customerId}`);
  return messages.map(transformMessageDocToMessage);
}

export async function getStaffMediaMessages(): Promise<Message[]> {
  await dbConnect();
  
  console.log('[DEBUG] Starting getStaffMediaMessages...');
  
  // Get ALL messages with Cloudinary URLs or data URIs
  const allMediaMessages = await MessageModel.find({
    $or: [
      // New Cloudinary URL format
      { content: { $regex: /^https:\/\/res\.cloudinary\.com\// } },
      // Legacy data URI format
      { content: { $regex: /data:/ } }
    ]
  }).lean().sort({ timestamp: -1 }); // Bỏ giới hạn - load tất cả media messages
  
  console.log(`[DEBUG] Found ${allMediaMessages.length} total media messages`);
  
  if (allMediaMessages.length > 0) {
    console.log('[DEBUG] Sample media messages:', allMediaMessages.slice(0, 3).map(m => ({
      id: m._id.toString(),
      sender: m.sender,
      staffId: m.staffId?.toString() || 'null',
      contentStart: m.content.substring(0, 50),
      isCloudinary: m.content.startsWith('https://res.cloudinary.com/')
    })));
  }
  
  return allMediaMessages.map(transformMessageDocToMessage);
}

export async function updateConversationTitle(conversationId: string, newTitle: string, userId: string): Promise<Conversation | null> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Mã cuộc trò chuyện hoặc người dùng không hợp lệ.");
  }
  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) {
    throw new Error("Không tìm thấy cuộc trò chuyện.");
  }
  //@ts-ignore
  const isParticipant = conversation.participants.some(p => p.userId?.toString() === userId);
  let userIsAdmin = false;
  if (!isParticipant) {
    const user = await UserModel.findById(userId);
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

export async function pinConversationForUser(userId: string, conversationId: string): Promise<CustomerProfile | null> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Mã người dùng hoặc cuộc trò chuyện không hợp lệ.");
  }
  const customer = await CustomerModel.findById(userId);
  if (!customer) throw new Error("Không tìm thấy khách hàng.");

  let newPinnedConversationIds = [...(customer.pinnedConversationIds || [])];
  const conversationObjectId = new mongoose.Types.ObjectId(conversationId);

  if (!newPinnedConversationIds.some(id => id.equals(conversationObjectId))) {
    if (newPinnedConversationIds.length >= 3) {
      newPinnedConversationIds.shift();
    }
    newPinnedConversationIds.push(conversationObjectId);
  }

  customer.pinnedConversationIds = newPinnedConversationIds;
  await customer.save();

  const updatedCustomer = await CustomerModel.findById(userId).populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');

  if (!updatedCustomer) return null;
  //@ts-ignore
  return {
    id: (updatedCustomer._id as Types.ObjectId).toString(),
    phoneNumber: updatedCustomer.phoneNumber,
    name: updatedCustomer.name || `Người dùng ${updatedCustomer.phoneNumber}`,
    internalName: updatedCustomer.internalName,
    conversationIds: (updatedCustomer.conversationIds || []).map(id => id.toString()),
    appointmentIds: (updatedCustomer.appointmentIds || []).map(id => id.toString()),
    productIds: (updatedCustomer.productIds || []).map(id => id.toString()),
    noteIds: (updatedCustomer.noteIds || []).map(id => id.toString()),
    pinnedConversationIds: (updatedCustomer.pinnedConversationIds || []).map(id => id.toString()),
    tags: updatedCustomer.tags || [],
    assignedStaffId: updatedCustomer.assignedStaffId?._id?.toString(),
    assignedStaffName: (updatedCustomer.assignedStaffId as IUser)?.name,
    lastInteractionAt: new Date(updatedCustomer.lastInteractionAt),
    createdAt: new Date(updatedCustomer.createdAt as Date),
    interactionStatus: updatedCustomer.interactionStatus as CustomerInteractionStatus,
    lastMessagePreview: updatedCustomer.lastMessagePreview,
    lastMessageTimestamp: updatedCustomer.lastMessageTimestamp ? new Date(updatedCustomer.lastMessageTimestamp) : undefined,
  };
}

export async function unpinConversationForUser(userId: string, conversationId: string): Promise<CustomerProfile | null> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Mã người dùng hoặc cuộc trò chuyện không hợp lệ.");
  }
  const conversationObjectId = new mongoose.Types.ObjectId(conversationId);
  const updatedCustomer = await CustomerModel.findByIdAndUpdate(
    userId,
    { $pull: { pinnedConversationIds: conversationObjectId } },
    { new: true }
  ).populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');

  if (!updatedCustomer) return null;
  //@ts-ignore
  return {
    id: (updatedCustomer._id as Types.ObjectId).toString(),
    phoneNumber: updatedCustomer.phoneNumber,
    name: updatedCustomer.name || `Người dùng ${updatedCustomer.phoneNumber}`,
    internalName: updatedCustomer.internalName,
    conversationIds: (updatedCustomer.conversationIds || []).map(id => id.toString()),
    appointmentIds: (updatedCustomer.appointmentIds || []).map(id => id.toString()),
    productIds: (updatedCustomer.productIds || []).map(id => id.toString()),
    noteIds: (updatedCustomer.noteIds || []).map(id => id.toString()),
    pinnedConversationIds: (updatedCustomer.pinnedConversationIds || []).map(id => id.toString()),
    tags: updatedCustomer.tags || [],
    assignedStaffId: updatedCustomer.assignedStaffId?._id?.toString(),
    assignedStaffName: (updatedCustomer.assignedStaffId as IUser)?.name,
    lastInteractionAt: new Date(updatedCustomer.lastInteractionAt),
    createdAt: new Date(updatedCustomer.createdAt as Date),
    interactionStatus: updatedCustomer.interactionStatus as CustomerInteractionStatus,
    lastMessagePreview: updatedCustomer.lastMessagePreview,
    lastMessageTimestamp: updatedCustomer.lastMessageTimestamp ? new Date(updatedCustomer.lastMessageTimestamp) : undefined,
  };
}

// Branch Management Actions
function transformBranchDoc(doc: IBranch | null): Branch | null {
  if (!doc) return null;
  return {
    id: (doc._id as Types.ObjectId).toString(),
    name: doc.name,
    address: doc.address,
    contactInfo: doc.contactInfo,
    isActive: doc.isActive,
    workingHours: doc.workingHours,
    offDays: doc.offDays,
    numberOfStaff: doc.numberOfStaff,
    specificDayOverrides: (doc.specificDayOverrides || []).map(r => ({
      id: (r as any)._id?.toString() || new mongoose.Types.ObjectId().toString(),
      date: r.date,
      isOff: r.isOff,
      workingHours: r.workingHours,
      numberOfStaff: r.numberOfStaff,
    })),
    //@ts-ignore
    createdAt: new Date(doc.createdAt as Date),
    //@ts-ignore
    updatedAt: new Date(doc.updatedAt as Date),
  };
}

export async function createBranch(data: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Promise<Branch> {
  await dbConnect();
  const newBranch = new BranchModel(data);
  const savedBranch = await newBranch.save();
  const transformed = transformBranchDoc(savedBranch);
  if (!transformed) throw new Error("Could not transform created branch.");
  return transformed;
}

export async function getBranches(activeOnly: boolean = false): Promise<Branch[]> {
  await dbConnect();
  const query = activeOnly ? { isActive: true } : {};
  const branchDocs = await BranchModel.find(query).sort({ name: 1 });
  return branchDocs.map(transformBranchDoc).filter(Boolean) as Branch[];
}

export async function updateBranch(id: string, data: Partial<Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Branch | null> {
  await dbConnect();
  const processedData = { ...data };
  if (processedData.specificDayOverrides) {
    processedData.specificDayOverrides = processedData.specificDayOverrides.map(rule => {
      const { id: ruleId, ...restOfRule } = rule;
      return restOfRule as Omit<BranchSpecificDayRule, 'id'>;
    });
  }
  const updatedBranch = await BranchModel.findByIdAndUpdate(id, { $set: processedData }, { new: true, runValidators: true });
  return transformBranchDoc(updatedBranch);
}

export async function deleteBranch(id: string): Promise<{ success: boolean }> {
  await dbConnect();
  const appointmentUsingBranch = await AppointmentModel.findOne({ branchId: id });
  if (appointmentUsingBranch) {
    throw new Error("Không thể xóa chi nhánh vì đang được sử dụng trong lịch hẹn.");
  }
  const result = await BranchModel.findByIdAndDelete(id);
  return { success: !!result };
}

// --- Quick Reply Actions ---
function transformQuickReplyDoc(doc: IQuickReply): QuickReplyType {
  return {
    id: (doc._id as Types.ObjectId).toString(),
    title: doc.title,
    content: doc.content,
    createdAt: new Date(doc.createdAt as Date),
    updatedAt: new Date(doc.updatedAt as Date),
  };
}

export async function getQuickReplies(): Promise<QuickReplyType[]> {
  await dbConnect();
  const quickReplies = await QuickReplyModel.find({}).sort({ title: 1 });
  return quickReplies.map(transformQuickReplyDoc);
}

export async function createQuickReply(data: { title: string; content: string }): Promise<QuickReplyType> {
  await dbConnect();
  const newQuickReply = new QuickReplyModel(data);
  const savedQuickReply = await newQuickReply.save();
  return transformQuickReplyDoc(savedQuickReply);
}

export async function updateQuickReply(id: string, data: Partial<{ title: string; content: string }>): Promise<QuickReplyType | null> {
  await dbConnect();
  const updatedQuickReply = await QuickReplyModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  return updatedQuickReply ? transformQuickReplyDoc(updatedQuickReply) : null;
}

export async function deleteQuickReply(id: string): Promise<{ success: boolean }> {
  await dbConnect();
  const result = await QuickReplyModel.findByIdAndDelete(id);
  return { success: !!result };
}

export async function createSystemMessage({ conversationId, content }: { conversationId: string, content: string }) {
  await dbConnect();
  // Lấy conversation để lấy customerId
  const conversation = await ConversationModel.findById(conversationId).populate('customerId', 'name phoneNumber');
  if (!conversation) throw new Error('Conversation not found');
  
  const message = await MessageModel.create({
    conversationId,
    content,
    type: 'system',
    sender: 'system',
    timestamp: new Date(),
    isRead: false,
    customerId: conversation.customerId // BẮT BUỘC PHẢI TRUYỀN customerId
  });

  // Update conversation with new message
  await ConversationModel.findByIdAndUpdate(conversationId, {
    $push: { messageIds: message._id },
    lastMessageTimestamp: message.timestamp,
    lastMessagePreview: message.content.substring(0, 100)
  });

  // Emit socket events for real-time update
  const customer = conversation.customerId as any;
  if (customer) {
    // Create message object for socket
    const messageForSocket = {
      id: (message._id as mongoose.Types.ObjectId).toString(),
      sender: 'system',
      content: content,
      timestamp: message.timestamp,
      name: 'Hệ thống',
      conversationId: conversationId,
      customerId: customer._id?.toString() || conversation.customerId.toString(),
      customerName: customer.name || `Người dùng ${customer.phoneNumber}`,
      staffName: 'Hệ thống'
    };

    // Emit newMessage event for real-time chat update
    const io = getSocketInstance();
    if (io) {
      io.to(conversationId).emit('newMessage', messageForSocket);
      console.log('[createSystemMessage] Emitted newMessage event for real-time update');
    }

    // Emit notification
    emitChatReplyNotification({
      customerId: customer._id?.toString() || conversation.customerId.toString(),
      customerName: customer.name || `Người dùng ${customer.phoneNumber}`,
      replyContent: content,
      conversationId: conversationId,
      staffName: 'Hệ thống',
      sender: 'system'
    });
  }

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

export async function cancelAppointment(appointmentId: string, userSession: UserSession): Promise<boolean> {
  await dbConnect();

  const appointment = await AppointmentModel.findById(appointmentId).populate('customerId');
  if (!appointment) {
    throw new Error("Không tìm thấy lịch hẹn.");
  }

  // Cancel any pending reminders
  await AppointmentReminderService.cancelReminder(appointmentId);

  appointment.status = 'cancelled';
  await appointment.save();

  // Send cancellation message to chat
  console.log('[DEBUG] Sending cancellation message to chat for appointment:', appointmentId);
  const appSettings = await getAppSettings();
  console.log('[DEBUG] App settings loaded, cancelledAppointmentMessageTemplate exists:', !!appSettings?.cancelledAppointmentMessageTemplate);
  
  if (appSettings?.cancelledAppointmentMessageTemplate) {
    const appointmentDetails = transformAppointmentDocToDetails(appointment);
    console.log('[DEBUG] Appointment details:', appointmentDetails);
    
    const cancellationMessage = formatAppointmentMessage(
      appSettings.cancelledAppointmentMessageTemplate,
      appointmentDetails,
      'Lịch hẹn đã được hủy thành công.'
    );
    console.log('[DEBUG] Formatted cancellation message:', cancellationMessage);

    // Find the latest conversation for this customer
    const latestConversation = await ConversationModel.findOne({
      customerId: appointment.customerId
    }).sort({ updatedAt: -1 });
    console.log('[DEBUG] Latest conversation found:', !!latestConversation, latestConversation?._id);

    if (latestConversation) {
      const systemMessage = await createSystemMessage({
        conversationId: (latestConversation._id as mongoose.Types.ObjectId).toString(),
        content: cancellationMessage
      });
      console.log('[DEBUG] System message created:', systemMessage);
    }
  } else {
    console.log('[DEBUG] No cancellation template found in settings');
  }

  return true;
}

export async function getPinnedMessagesForConversation(conversationId: string): Promise<Message[]> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Mã cuộc trò chuyện không hợp lệ.");
  }

  const conversation = await ConversationModel.findById(conversationId)
    .populate({
      path: 'pinnedMessageIds',
      model: MessageModel,
      options: { sort: { timestamp: -1 } }
    });

  if (!conversation) {
    throw new Error("Không tìm thấy cuộc trò chuyện.");
  }

  return (conversation.pinnedMessageIds as unknown as IMessage[]).map(transformMessageDocToMessage);
}
