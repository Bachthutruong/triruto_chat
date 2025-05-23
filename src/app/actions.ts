
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


interface IMessageWithConversation extends IMessage {
  conversationId?: Types.ObjectId;
}

function transformConversationDoc(doc: IConversation | null): Conversation | null {
  if (!doc) return null;
  return {
    id: (doc._id as Types.ObjectId).toString(),
    customerId: (doc.customerId as Types.ObjectId).toString(),
    staffId: doc.staffId ? (doc.staffId as Types.ObjectId).toString() : undefined,
    title: doc.title,
    participants: (doc.participants || []).map((p: any) => ({
      userId: p.userId?.toString(),
      role: p.role,
      name: p.name,
      phoneNumber: p.phoneNumber,
    })).filter(p => p.userId),
    messageIds: (doc.messageIds as Types.ObjectId[] || []).map(id => id.toString()),
    pinnedMessageIds: (doc.pinnedMessageIds || []).map(id => id.toString()),
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
        continue;
      }

      if (questionKey) {
        seenQuestions.add(questionKey);
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
    imageDataUri: noteDoc.imageDataUri,
    imageFileName: noteDoc.imageFileName,
    createdAt: new Date(noteDoc.createdAt as Date),
    updatedAt: new Date(noteDoc.updatedAt as Date),
  };
}


function transformAppSettingsDoc(doc: IAppSettings | null): AppSettings | null {
  if (!doc) return null;
  const defaultBrandName = 'AetherChat';
  const initialDefaultSettings: AppSettings = {
    id: '',
    brandName: defaultBrandName,
    greetingMessage: 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay?',
    greetingMessageNewCustomer: 'Chào mừng bạn lần đầu đến với chúng tôi! Bạn cần hỗ trợ gì ạ?',
    greetingMessageReturningCustomer: 'Chào mừng bạn quay trở lại! Rất vui được gặp lại bạn.',
    suggestedQuestions: ['Các dịch vụ của bạn?', 'Đặt lịch hẹn', 'Địa chỉ của bạn ở đâu?'],
    successfulBookingMessageTemplate: "Lịch hẹn của bạn cho {{service}} vào lúc {{time}} ngày {{date}}{{#if branch}} tại {{branch}}{{/if}} đã được đặt thành công! Chúng tôi sẽ gửi tin nhắn xác nhận chi tiết cho bạn.",
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
    officeDays: [1, 2, 3, 4, 5], // Mon-Fri
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


  return {
    id: (doc._id as Types.ObjectId).toString(),
    greetingMessage: doc.greetingMessage || initialDefaultSettings.greetingMessage,
    greetingMessageNewCustomer: doc.greetingMessageNewCustomer || initialDefaultSettings.greetingMessageNewCustomer,
    greetingMessageReturningCustomer: doc.greetingMessageReturningCustomer || initialDefaultSettings.greetingMessageReturningCustomer,
    suggestedQuestions: doc.suggestedQuestions && doc.suggestedQuestions.length > 0 ? doc.suggestedQuestions : initialDefaultSettings.suggestedQuestions!,
    successfulBookingMessageTemplate: doc.successfulBookingMessageTemplate || initialDefaultSettings.successfulBookingMessageTemplate,
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
  const settingsDoc = await AppSettingsModel.findOne<IAppSettings>({});
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


  if (user) { // Ensure user is not null
      user.conversationIds = user.conversationIds || []; // Initialize if undefined
      user.conversationIds.push(savedConversation._id);
      await user.save();
      console.log("[ACTIONS] createNewConversationForUser: Updated customer with new conversation ID.");
  } else {
      // This case should ideally not happen if findById was successful
      console.warn(`User ${userId} is not a CustomerModel instance, conversation not linked directly to user document's conversationIds array.`);
  }


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
      conversationIds: [], // Initialize as empty array
      appointmentIds: [],
      productIds: [],
      noteIds: [],
      pinnedConversationIds: [],
      tags: [],
    });
    await customer.save();
    isNewCustomer = true;
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
          options: { sort: { timestamp: 1 }, limit: 50 } 
      });
    if (activeConversation) console.log("Found existing active conversation:", activeConversation.id);
  }
  
  if (!activeConversation) {
    console.log("No active conversation found, creating new one for customer:", customer.id);
    const newConvDocFromAction = await createNewConversationForUser(customer._id!.toString(), `Trò chuyện chính với ${customer.name || customer.phoneNumber}`);
    if (!newConvDocFromAction || !newConvDocFromAction.id) throw new Error("Không thể tạo cuộc trò chuyện mới.");
    activeConversation = await ConversationModel.findById(newConvDocFromAction.id).populate({
        path: 'messageIds',
        options: { sort: { timestamp: 1 }, limit: 50 }
    });
    if (activeConversation) {
      console.log("New conversation created and fetched:", activeConversation.id);
      // Add to customer if not already present (though createNewConversationForUser should handle it)
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
    if (appSettings.outOfOfficeResponseEnabled && isOutOfOffice(appSettings)) {
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
  // Fallback if no greeting was determined
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
     // Check if messageIds are populated or just ObjectIds
     const firstMessageId = activeConversation.messageIds[0];
     if (typeof firstMessageId === 'object' && firstMessageId !== null && '_id' in firstMessageId) {
        // Already populated (likely due to .populate() in the ConversationModel query)
        const populatedMessages = (activeConversation.messageIds as unknown as IMessage[]).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        finalInitialMessages.push(...populatedMessages.map(transformMessageDocToMessage));
     } else {
        // Not populated, fetch them
        const conversationMessageDocs = await MessageModel.find({ _id: { $in: activeConversation.messageIds as Types.ObjectId[] } }).sort({ timestamp: 1 }).limit(50);
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
    conversations: [transformConversationDoc(activeConversation)].filter(Boolean) as Conversation[], // For one-convo model
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
    password, // Password will be hashed by pre-save hook
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
  const user = await UserModel.findOne({ phoneNumber }).select('+password'); // Explicitly select password

  if (!user || user.role === 'customer') {
    // Deny login if user is a customer or not found
    throw new Error('Người dùng không tồn tại hoặc không được phép đăng nhập bằng mật khẩu.');
  }

  if (!user.password) {
    // This case should ideally not happen for staff/admin if password is required at creation
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
      model: MessageModel, // Explicitly specify the model for population
      options: { sort: { timestamp: 1 } } // Sort messages by timestamp
  });
  if (!conversation || !conversation.messageIds || conversation.messageIds.length === 0) {
    return [];
  }
  // Assuming messageIds are now populated documents
  const messages = (conversation.messageIds as unknown as IMessage[]);
  return messages.map(transformMessageDocToMessage);
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
    await dbConnect();
    const customer = await CustomerModel.findById(userId).populate({
        path: 'conversationIds',
        model: ConversationModel, // Explicitly specify the model
        options: { sort: { lastMessageTimestamp: -1 } } // Sort conversations by last message time
    });
    if (!customer || !customer.conversationIds || customer.conversationIds.length === 0) {
        return [];
    }
    // Assuming conversationIds are now populated documents
    return (customer.conversationIds as unknown as IConversation[]).map(doc => transformConversationDoc(doc)).filter(Boolean) as Conversation[];
}

function formatBookingConfirmation(template: string, details: AppointmentDetails): string {
    let message = template;
    message = message.replace(/{{service}}/g, details.service);
    // Ensure date is valid before formatting
    try {
        const dateObj = dateFnsParseISO(details.date); // Assuming details.date is YYYY-MM-DD
        if (isValidDateFns(dateObj)) {
            message = message.replace(/{{date}}/g, dateFnsFormat(dateObj, 'dd/MM/yyyy', { locale: vi }));
        } else {
            message = message.replace(/{{date}}/g, details.date); // Fallback to original string if not valid
        }
    } catch (e) {
        message = message.replace(/{{date}}/g, details.date); // Fallback on parsing error
    }
    message = message.replace(/{{time}}/g, details.time);
    message = message.replace(/{{branch}}/g, details.branch || '');
    // Remove conditional block if branch is not present
    if (!details.branch) {
        message = message.replace(/{{#if branch}}.*?{{\/if}}/g, '');
    } else {
        message = message.replace(/{{#if branch}}/g, '').replace(/{{\/if}}/g, '');
    }
    return message.trim();
}


export async function processUserMessage(
  userMessageContent: string,
  currentUserSession: UserSession,
  currentConversationId: string,
  currentChatHistory: Message[]
): Promise<{ userMessage: Message, aiMessage: Message; newSuggestedReplies: string[]; updatedAppointment?: AppointmentDetails }> {
  await dbConnect();

  const customerId = currentUserSession.id;
  if (!mongoose.Types.ObjectId.isValid(currentConversationId) || !mongoose.Types.ObjectId.isValid(customerId)) {
    throw new Error("Mã cuộc trò chuyện hoặc khách hàng không hợp lệ.");
  }

  let textForAI = userMessageContent;
  let mediaDataUriForAI: string | undefined = undefined;

  const dataUriRegex = /^(data:[^;]+;base64,[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;
  const match = userMessageContent.match(dataUriRegex);

  if (match) {
    mediaDataUriForAI = match[1];
    const fileNameEncoded = match[2];
    let originalFileName = "attached_file";
    try {
      originalFileName = decodeURIComponent(fileNameEncoded);
    } catch (e) { /* ignore */ }

    const textAfterFile = match[3]?.trim();

    if (textAfterFile) {
      textForAI = textAfterFile;
    } else {
      textForAI = `Tôi đã gửi một tệp: ${originalFileName}. Bạn có thể phân tích hoặc mô tả nó không?`;
    }
  }

  const userMessageData: Partial<IMessage> = {
    sender: 'user',
    content: userMessageContent, // Save the original content with data URI if present
    timestamp: new Date(),
    name: currentUserSession.name || `Người dùng ${currentUserSession.phoneNumber}`,
    customerId: new mongoose.Types.ObjectId(customerId),
    userId: new mongoose.Types.ObjectId(customerId), // For user messages, userId is customerId
    conversationId: new mongoose.Types.ObjectId(currentConversationId),
  };
  const savedUserMessageDoc = await new MessageModel(userMessageData).save();
  const userMessage = transformMessageDocToMessage(savedUserMessageDoc);

  await CustomerModel.findByIdAndUpdate(customerId, {
    lastInteractionAt: new Date(),
    interactionStatus: currentUserSession.role === 'customer' ? 'unread' : 'replied_by_staff', // If staff replies, it's replied_by_staff
    lastMessagePreview: textForAI.substring(0, 100), // Use textForAI for preview
    lastMessageTimestamp: userMessage.timestamp,
  });

  await ConversationModel.findByIdAndUpdate(currentConversationId, {
    $push: { messageIds: savedUserMessageDoc._id },
    lastMessageTimestamp: userMessage.timestamp,
    lastMessagePreview: textForAI.substring(0, 100), // Use textForAI for preview
  });

  let updatedChatHistoryWithUserMsg = [...currentChatHistory, userMessage];
  const formattedHistory = formatChatHistoryForAI(updatedChatHistoryWithUserMsg.slice(-10)); // Pass only the last 10 messages for brevity

  let aiResponseContent: string = "";
  let finalAiMessage: Message;
  let processedAppointmentDB: IAppointment | null = null;
  let scheduleOutputFromAI: ScheduleAppointmentOutput | null = null;
  const appSettings = await getAppSettings();
  if (!appSettings) {
    throw new Error("Không thể tải cài đặt ứng dụng. Không thể xử lý tin nhắn.");
  }

  // Check if out of office and if the last message was already the OOO message
  if (isOutOfOffice(appSettings) && appSettings.outOfOfficeResponseEnabled && appSettings.outOfOfficeMessage) {
    const lastAiMessage = currentChatHistory.slice().reverse().find(m => m.sender === 'ai' || m.sender === 'system');
    if (lastAiMessage && lastAiMessage.content === appSettings.outOfOfficeMessage) {
      // If last AI message was already OOO, give a shorter follow-up
      aiResponseContent = "Chúng tôi vẫn đang ngoài giờ làm việc. Xin cảm ơn sự kiên nhẫn của bạn.";
    } else {
       aiResponseContent = appSettings.outOfOfficeMessage; // Send OOO again if it wasn't the last message.
    }
    // Do not proceed with further AI processing if out of office
    const aiMessageData: Partial<IMessage> = {
      sender: 'ai', content: aiResponseContent, timestamp: new Date(),
      name: `${appSettings.brandName || 'AI Assistant'}`, // Brand name for AI
      customerId: new mongoose.Types.ObjectId(customerId),
      conversationId: new mongoose.Types.ObjectId(currentConversationId),
    };
    const savedAiMessageDoc = await new MessageModel(aiMessageData).save();
    finalAiMessage = transformMessageDocToMessage(savedAiMessageDoc);
    await ConversationModel.findByIdAndUpdate(currentConversationId, {
      $push: { messageIds: savedAiMessageDoc._id },
      lastMessageTimestamp: savedAiMessageDoc.timestamp,
      lastMessagePreview: savedAiMessageDoc.content.substring(0, 100),
    });
    return { userMessage: userMessage, aiMessage: finalAiMessage, newSuggestedReplies: [] };
  }


  const allProducts = await getAllProducts();
  const activeBranches = await getBranches(true);
  const branchNamesForAI = activeBranches.map(b => b.name);


  const customerAppointmentsDocs = await AppointmentModel.find({
    customerId: new mongoose.Types.ObjectId(customerId) as any,
    status: { $nin: ['cancelled', 'completed'] }
  }).populate('customerId staffId'); // Populate to get customer/staff names if needed for AppointmentDetails

  const customerAppointmentsForAI: AIAppointmentDetails[] = customerAppointmentsDocs.map(doc => ({
    ...(transformAppointmentDocToDetails(doc) as AIAppointmentDetails), // Cast to ensure all fields expected by AI schema are there
    userId: (doc.customerId as any)?._id?.toString(), // Ensure userId is present in AI schema
    createdAt: doc.createdAt?.toISOString(), // Convert Date to string for AI schema
    updatedAt: doc.updatedAt?.toISOString(), // Convert Date to string for AI schema
  }));


  const appointmentRulesFromDB: LibAppointmentRuleType[] = await getAppointmentRules();
  const appointmentRulesForAI: AIAppointmentRuleType[] = appointmentRulesFromDB.map(
    (rule: LibAppointmentRuleType) => ({
      id: rule.id,
      name: rule.name,
      keywords: rule.keywords,
      conditions: rule.conditions,
      aiPromptInstructions: rule.aiPromptInstructions,
      createdAt: rule.createdAt?.toISOString(), // Convert Date to string
      updatedAt: rule.updatedAt?.toISOString(), // Convert Date to string
    })
  );

  scheduleOutputFromAI = await scheduleAppointmentAIFlow({
    userInput: textForAI, // Use the text part of the message for AI processing
    phoneNumber: currentUserSession.phoneNumber,
    userId: customerId,
    existingAppointments: customerAppointmentsForAI.length > 0 ? customerAppointmentsForAI : undefined,
    currentDateTime: new Date().toISOString(),
    chatHistory: formattedHistory,
    appointmentRules: appointmentRulesForAI.length > 0 ? appointmentRulesForAI : undefined,
    availableBranches: branchNamesForAI.length > 0 ? branchNamesForAI : undefined,
  });

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
      // If NLU somehow produces an invalid date format despite prompt instructions
      const promptInputForClarification: ScheduleAppointmentInput = {
        ...( { userInput: textForAI, phoneNumber: currentUserSession.phoneNumber, userId: customerId, currentDateTime: new Date().toISOString() } as any), // Cast to satisfy schema, some fields are optional
        userInput: `Ngày ${scheduleOutputFromAI.appointmentDetails.date} không hợp lệ. Yêu cầu người dùng cung cấp lại ngày.`,
        availabilityCheckResult: { status: "NEEDS_CLARIFICATION", reason: "Ngày không hợp lệ.", isStatusUnavailable: true }
      };
      const { output: clarificationOutput } = await scheduleAppointmentPrompt(promptInputForClarification);
      aiResponseContent = clarificationOutput?.confirmationMessage || "Ngày bạn cung cấp không hợp lệ. Vui lòng kiểm tra lại (YYYY-MM-DD).";
      scheduleOutputFromAI.intent = 'clarification_needed';
      processedAppointmentDB = null;
    } else {
      // Determine effective scheduling rules (Product specific or Global fallback)
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
        targetTime,
        appSettings, // Pass global settings for overall context
        serviceName,
        effectiveSchedulingRules, // Pass merged rules for THIS service
        serviceDuration, // Pass duration for THIS service
        targetBranchId
      );

      if (availability.isAvailable) {
        // Slot is available, let AI generate final confirmation using template if possible
        const promptInputForFinalConfirmation: ScheduleAppointmentInput = {
          ...( { userInput: textForAI, phoneNumber: currentUserSession.phoneNumber, userId: customerId, currentDateTime: new Date().toISOString() } as any),
          userInput: "Hệ thống đã xác nhận lịch hẹn. Hãy tạo tin nhắn xác nhận cuối cùng cho người dùng.",
          availabilityCheckResult: {
            status: "AVAILABLE",
            confirmedSlot: {
              date: scheduleOutputFromAI.appointmentDetails.date,
              time: scheduleOutputFromAI.appointmentDetails.time,
              service: scheduleOutputFromAI.appointmentDetails.service,
              branch: scheduleOutputFromAI.appointmentDetails.branch,
              durationMinutes: serviceDuration,
            },
            isStatusUnavailable: false,
          },
        };
        const { output: finalConfirmationOutput } = await scheduleAppointmentPrompt(promptInputForFinalConfirmation);
        aiResponseContent = finalConfirmationOutput?.confirmationMessage || "Lịch hẹn của bạn đã được xác nhận!"; // Fallback AI confirmation

        const appointmentDataCommon = {
          customerId: new mongoose.Types.ObjectId(customerId) as any,
          service: serviceName,
          productId: productForService._id, // Store product ID
          date: scheduleOutputFromAI.appointmentDetails.date!,
          time: scheduleOutputFromAI.appointmentDetails.time!,
          branch: scheduleOutputFromAI.appointmentDetails.branch,
          branchId: targetBranchId ? new mongoose.Types.ObjectId(targetBranchId) as any : undefined,
          notes: scheduleOutputFromAI.appointmentDetails.notes,
          packageType: scheduleOutputFromAI.appointmentDetails.packageType,
          priority: scheduleOutputFromAI.appointmentDetails.priority,
        };

        if (scheduleOutputFromAI.intent === 'booked') {
          const newAppointmentData = { ...appointmentDataCommon, status: 'booked' as AppointmentDetails['status'] } as any;
          try {
            const savedAppt = await new AppointmentModel(newAppointmentData).save();
            processedAppointmentDB = await AppointmentModel.findById(savedAppt._id).populate('customerId staffId'); // Populate for returning full details
            if (processedAppointmentDB && processedAppointmentDB._id) {
              await CustomerModel.findByIdAndUpdate(customerId, { $push: { appointmentIds: processedAppointmentDB._id } });
            } else {
              // This should not happen if save was successful
              aiResponseContent = "Đã xảy ra lỗi khi lưu lịch hẹn của bạn. Vui lòng thử lại.";
              processedAppointmentDB = null; // Ensure it's null if save failed
            }
          } catch (dbError: any) {
            console.error("[ACTIONS] DATABASE ERROR while saving new appointment:", dbError.message, dbError.stack);
            aiResponseContent = "Đã xảy ra lỗi nghiêm trọng khi lưu lịch hẹn. Vui lòng thử lại sau.";
            processedAppointmentDB = null;
          }
        } else { // Rescheduled
          if (!scheduleOutputFromAI.originalAppointmentIdToModify) {
            aiResponseContent = "Không xác định được lịch hẹn gốc để đổi. Vui lòng thử lại.";
            processedAppointmentDB = null;
          } else {
            try {
              processedAppointmentDB = await AppointmentModel.findOneAndUpdate(
                { _id: new mongoose.Types.ObjectId(scheduleOutputFromAI.originalAppointmentIdToModify) as any, customerId: new mongoose.Types.ObjectId(customerId) as any },
                { ...appointmentDataCommon, status: 'booked', updatedAt: new Date() }, // Mark as booked again after reschedule
                { new: true }
              ).populate('customerId staffId');
              if (!processedAppointmentDB) {
                aiResponseContent = `Không tìm thấy lịch hẹn gốc để đổi, hoặc bạn không phải chủ sở hữu. Vui lòng thử lại.`;
                processedAppointmentDB = null;
              }
            } catch (dbError: any) {
              aiResponseContent = "Đã xảy ra lỗi khi đổi lịch hẹn. Vui lòng thử lại sau.";
              processedAppointmentDB = null;
            }
          }
        }
        // After successful booking/rescheduling and DB save
        if (processedAppointmentDB && appSettings.successfulBookingMessageTemplate) {
            const detailsForTemplate = transformAppointmentDocToDetails(processedAppointmentDB);
            aiResponseContent = formatBookingConfirmation(appSettings.successfulBookingMessageTemplate, detailsForTemplate);
        } else if (!processedAppointmentDB) {
            // If DB operation failed, use the AI's original error/clarification message
            aiResponseContent = scheduleOutputFromAI.confirmationMessage;
        }
        // If template is not set, aiResponseContent already holds the AI's natural confirmation

      } else { // Slot is NOT available
        const promptInputForAlternatives: ScheduleAppointmentInput = {
          ...( { userInput: textForAI, phoneNumber: currentUserSession.phoneNumber, userId: customerId, currentDateTime: new Date().toISOString() } as any),
          userInput: "Lịch yêu cầu không trống. Hãy thông báo cho người dùng và đề xuất các khung giờ sau từ suggestedSlots.",
          availabilityCheckResult: {
            status: "UNAVAILABLE",
            reason: availability.reason,
            suggestedSlots: availability.suggestedSlots,
            isStatusUnavailable: true,
          }
        };
        const { output: alternativeOutput } = await scheduleAppointmentPrompt(promptInputForAlternatives);
        aiResponseContent = alternativeOutput?.confirmationMessage || "Rất tiếc, lịch bạn chọn đã đầy.";
        if (scheduleOutputFromAI.intent === 'booked') scheduleOutputFromAI.intent = 'pending_alternatives'; // Change intent
        processedAppointmentDB = null; // No appointment was actually booked
      }
    }
  } else if (scheduleOutputFromAI.intent === 'cancelled') {
    if (!scheduleOutputFromAI.originalAppointmentIdToModify) {
      aiResponseContent = "Không xác định được lịch hẹn nào bạn muốn hủy. Vui lòng cung cấp thêm chi tiết.";
      processedAppointmentDB = null;
    } else {
      try {
        processedAppointmentDB = await AppointmentModel.findOneAndUpdate(
          { _id: new mongoose.Types.ObjectId(scheduleOutputFromAI.originalAppointmentIdToModify) as any, customerId: new mongoose.Types.ObjectId(customerId) as any },
          { status: 'cancelled', updatedAt: new Date() },
          { new: true }
        ).populate('customerId staffId');

        if (processedAppointmentDB) {
          aiResponseContent = scheduleOutputFromAI.confirmationMessage; // Use AI's confirmation for cancellation
        } else {
          aiResponseContent = "Không tìm thấy lịch hẹn bạn muốn hủy hoặc bạn không phải chủ sở hữu.";
          processedAppointmentDB = null;
        }
      } catch (dbError: any) {
        aiResponseContent = "Đã xảy ra lỗi khi hủy lịch hẹn của bạn. Vui lòng thử lại sau.";
        processedAppointmentDB = null;
      }
    }
  } else if (scheduleOutputFromAI.intent === 'no_action_needed' || scheduleOutputFromAI.intent === 'clarification_needed' || scheduleOutputFromAI.intent === 'error') {
    // This branch handles cases where AI decided no booking action was taken (e.g., general question, needs more info, or error)
    // First, check keyword mappings (only if no media was sent, as keywords are for text)
    let keywordFound = false;
    if (!mediaDataUriForAI) { // Only check keywords if no media was attached
      const keywordMappings = await getKeywordMappings();
      for (const mapping of keywordMappings) {
        if (mapping.keywords.some(kw => textForAI.toLowerCase().includes(kw.toLowerCase()))) {
          aiResponseContent = mapping.response;
          keywordFound = true;
          break;
        }
      }
    }

    // If no keyword matched AND the AI's intent was 'no_action_needed' or 'error' (not clarification for booking), then use general AI
    if (!keywordFound && (scheduleOutputFromAI.intent === 'no_action_needed' || scheduleOutputFromAI.intent === 'error')) {
      try {
        const approvedTrainingDocs = await TrainingDataModel.find({ status: 'approved' }).sort({ updatedAt: -1 }).limit(5);
        const relevantTrainingData = approvedTrainingDocs.map(doc => ({
          userInput: doc.userInput,
          idealResponse: doc.idealResponse
        }));

        const answerResult = await answerUserQuestion({
          question: textForAI,
          chatHistory: formattedHistory,
          mediaDataUri: mediaDataUriForAI, // Pass media URI if present
          relevantTrainingData: relevantTrainingData.length > 0 ? relevantTrainingData : undefined,
          products: allProducts.map(p => ({ name: p.name, description: p.description, price: p.price, category: p.category })),
        });
        aiResponseContent = answerResult.answer;
      } catch (error) {
        console.error('Error answering user question:', error);
        aiResponseContent = "Xin lỗi, tôi đang gặp chút khó khăn để hiểu ý bạn. Bạn có thể hỏi theo cách khác được không?";
      }
    } else if (!keywordFound && scheduleOutputFromAI.intent === 'clarification_needed') {
      // If no keyword, and AI needs clarification for booking, use AI's clarification message
      aiResponseContent = scheduleOutputFromAI.confirmationMessage;
    } else if (!keywordFound && scheduleOutputFromAI.intent !== 'clarification_needed' && scheduleOutputFromAI.confirmationMessage) {
      // Fallback to AI's message if no keyword match and it's not for clarification (might be error from AI)
      aiResponseContent = scheduleOutputFromAI.confirmationMessage;
    }
    // If keywordFound is true, aiResponseContent is already set from keyword mapping.
  } else {
    // Fallback if AI NLU output intent is unexpected or crucial details are missing for any known intent path
    const promptInputForClarification: ScheduleAppointmentInput = {
      ...( { userInput: textForAI, phoneNumber: currentUserSession.phoneNumber, userId: customerId, currentDateTime: new Date().toISOString() } as any),
      userInput: `Người dùng nhập: "${textForAI}". Yêu cầu này chưa rõ ràng. Hãy hỏi thêm thông tin để đặt lịch.`,
      availabilityCheckResult: { status: "NEEDS_CLARIFICATION", reason: "Yêu cầu chưa rõ ràng.", isStatusUnavailable: true }
    };
    const { output: clarificationOutput } = await scheduleAppointmentPrompt(promptInputForClarification);
    aiResponseContent = clarificationOutput?.confirmationMessage || "Tôi chưa hiểu rõ yêu cầu đặt lịch của bạn. Bạn muốn đặt dịch vụ nào, vào ngày giờ nào?";
    scheduleOutputFromAI.intent = 'clarification_needed';
  }

  const brandNameForAI = appSettings?.brandName || 'AI Assistant';

  const aiMessageData: Partial<IMessage> = {
    sender: 'ai',
    content: aiResponseContent,
    timestamp: new Date(),
    name: `${brandNameForAI}`, // Brand name for AI
    customerId: new mongoose.Types.ObjectId(customerId),
    conversationId: new mongoose.Types.ObjectId(currentConversationId),
  };
  const savedAiMessageDoc = await new MessageModel(aiMessageData).save();
  finalAiMessage = transformMessageDocToMessage(savedAiMessageDoc);

  // Update customer's last interaction time
  await CustomerModel.findByIdAndUpdate(customerId, {
    lastInteractionAt: new Date(),
    // interactionStatus might be updated elsewhere based on staff replies
  });

  // Update conversation's last message details
  await ConversationModel.findByIdAndUpdate(currentConversationId, {
    $push: { messageIds: savedAiMessageDoc._id },
    lastMessageTimestamp: savedAiMessageDoc.timestamp,
    lastMessagePreview: savedAiMessageDoc.content.substring(0, 100),
  });

  const newSuggestedReplies: string[] = []; // No more suggested replies after initial greeting for now
  const updatedAppointmentClient = processedAppointmentDB ? transformAppointmentDocToDetails(processedAppointmentDB) : undefined;

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
        if (i > 0) { // Calculate next date for recurring appointments
          if (formData.recurrenceType === 'daily') {
            currentBookingDate = dateFnsAddDays(currentBookingDate, 1);
          } else if (formData.recurrenceType === 'weekly') {
            currentBookingDate = dateFnsAddWeeks(currentBookingDate, 1);
          } else if (formData.recurrenceType === 'monthly') {
            currentBookingDate = dateFnsAddMonths(currentBookingDate, 1);
          } else {
            break; // Should not happen if recurrenceCount > 1 and type is 'none'
          }
        }

        // Re-check availability for each instance in the series
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
            if (i > 0) { // Some previous instances might have been successful
                failureMessage = `Đã đặt được ${i} lịch hẹn. ${failureMessage} Các lịch hẹn sau đó trong chuỗi cũng không được đặt.`;
            }
             // If even the first one fails, it's caught by the outer availability check.
             // This handles failures within a series.
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

      const savedAppointments: IAppointment[] = await AppointmentModel.insertMany(appointmentDataList);
      const savedAppointmentIds = savedAppointments.map(appt => appt._id);
      await CustomerModel.findByIdAndUpdate(formData.customerId, { $push: { appointmentIds: { $each: savedAppointmentIds } } });

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
        appointment: firstAppointmentDetails, // Return details of the first appointment in the series
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
    // Admins see all customers by default, unless filtered by admin-specific tags
    if (filterTags && filterTags.some(tag => tag.startsWith('admin:'))) {
      // If an admin tag is present, filter by it.
      query.tags = { $in: filterTags.filter(tag => tag.startsWith('admin:')) };
    }
    // If no admin tag filter, admins see all (no specific query addition needed here for all)
  }

  // Apply general tags if present, in conjunction with role-based filters
  if (filterTags && filterTags.length > 0) {
    const generalTagsToFilter = filterTags.filter(tag => !tag.startsWith('staff:') && !tag.startsWith('admin:'));
    if (generalTagsToFilter.length > 0) {
      if (query.$or) {
        // If $or already exists (from staff filter), each condition in $or must also match general tags
        query.$or = query.$or.map((condition: any) => ({
          $and: [condition, { tags: { $in: generalTagsToFilter } }]
        }));
      } else {
        // If no $or, and query.tags exists (from admin filter), combine with $in
        if (query.tags && query.tags.$in) {
          query.tags.$in = [...new Set([...query.tags.$in, ...generalTagsToFilter])];
        } else {
          query.tags = { $in: generalTagsToFilter };
        }
      }
    }
  }


  // Fetch customers based on the constructed query
  const customerDocs = await CustomerModel.find(query)
    .populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name')
    .sort({ lastMessageTimestamp: -1, lastInteractionAt: -1 }) // Sort by last message first, then general interaction
    .limit(100); // Limit results for performance

  return customerDocs.map(doc => ({
    id: (doc._id as Types.ObjectId).toString(),
    phoneNumber: doc.phoneNumber,
    name: doc.name || `Người dùng ${doc.phoneNumber}`,
    internalName: doc.internalName,
    conversationIds: (doc.conversationIds || []).map(id => id.toString()),
    appointmentIds: (doc.appointmentIds || []).map(id => id.toString()),
    productIds: (doc.productIds || []).map(id => id.toString()),
    noteIds: (doc.noteIds || []).map(id => id.toString()),
    pinnedConversationIds: (doc.pinnedConversationIds || []).map(id => id.toString()),
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
  // Only mark as 'read' if current status is 'unread'. 
  // If it's 'replied_by_staff', it means staff already handled it.
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
          model: ConversationModel, // Explicitly specify the model
          options: { sort: { lastMessageTimestamp: -1 } }, // Get the most recent conversation first
          populate: {
            path: 'messageIds',
            model: MessageModel, // Explicitly specify the model
            options: { sort: { timestamp: 1 }, limit: 50 } // Get latest 50 messages for the active convo
          }
      });

  if (!customerDoc) {
    return { customer: null, messages: [], appointments: [], notes: [], conversations: [] };
  }

  const transformedConversations = (customerDoc.conversationIds || [])
    .map(convDoc => transformConversationDoc(convDoc as unknown as IConversation))
    .filter(Boolean) as Conversation[];

  // Assuming the first conversation in the sorted list is the "active" one for initial display
  let messagesForActiveConversation: Message[] = [];
  if (transformedConversations.length > 0 && customerDoc.conversationIds && customerDoc.conversationIds[0]) {
    const activeConvDoc = customerDoc.conversationIds[0] as unknown as IConversation; // Already populated
    if (activeConvDoc && activeConvDoc.messageIds) {
      messagesForActiveConversation = (activeConvDoc.messageIds as unknown as IMessage[]).map(transformMessageDocToMessage);
    }
  }


  const appointmentDocs = await AppointmentModel.find({ customerId: customerDoc._id })
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate<{ staffId: IUser }>('staffId', 'name')
    .sort({ date: -1, time: -1 });

  const noteDocs = await NoteModel.find({ customerId: customerDoc._id })
    .populate<{ staffId: IUser }>('staffId', 'name') // Populate staff name for notes
    .sort({ createdAt: -1 });

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
  const staffUsers = await UserModel.find({ role: { $in: ['staff', 'admin'] } }, 'name'); // Select only name and _id
  return staffUsers.map(user => ({
    id: (user._id as Types.ObjectId).toString(),
    name: user.name || `User ${(user._id as Types.ObjectId).toString().slice(-4)}` // Fallback name
  }));
}


export async function createStaffOrAdminUser(
  name: string,
  phoneNumber: string,
  role: 'staff' | 'admin',
  password?: string // Password can be optional if set later
): Promise<UserSession | null> {
  await dbConnect();
  if (await UserModel.findOne({ phoneNumber })) {
    throw new Error('Người dùng với số điện thoại này đã tồn tại.');
  }
  const newUser = new UserModel({
    name,
    phoneNumber,
    role,
    password: password, // Hashing will be handled by pre-save hook
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
  if (data.password) { // If a new password is provided
    user.password = data.password; // The pre-save hook will hash it
  }

  await user.save();
  return transformUserToSession(user);
}

export async function deleteUser(userId: string): Promise<{ success: boolean, message?: string }> {
  await dbConnect();
  const result = await UserModel.findByIdAndDelete(userId);
  if (!result) throw new Error("Không tìm thấy người dùng để xóa.");

  // Optional: Unassign this user from any customers or appointments
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
      lastInteractionAt: new Date(), // Update interaction time
      interactionStatus: 'read', // Staff has interacted by assigning
    },
    { new: true }
  ).populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');
  if (!updatedCustomerDoc) throw new Error("Không tìm thấy khách hàng.");

  // Use the consolidated transformation function
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
      interactionStatus: 'unread', // Back to unread as no one is assigned
    },
    { new: true }
  );
  if (!updatedCustomerDoc) throw new Error("Không tìm thấy khách hàng.");
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
    assignedStaffId: updatedCustomerDoc.assignedStaffId ? (updatedCustomerDoc.assignedStaffId as any)._id?.toString() : undefined, // Should be undefined
    assignedStaffName: undefined, // Should be undefined
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
    customer.lastInteractionAt = new Date(); // Update interaction time
    await customer.save();
  }
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
    { $pull: { tags: tagToRemove }, lastInteractionAt: new Date() }, // Update interaction time
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


export async function sendStaffMessage(
  staffSession: UserSession,
  customerId: string,
  conversationId: string,
  messageContent: string
): Promise<Message> {
  console.log("Action: sendStaffMessage received:", { staffSessionId: staffSession.id, customerId, conversationId, messageContent: messageContent.substring(0,50) + "..."});
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
  // Ensure the conversation belongs to this customer
  if (conversation.customerId.toString() !== customerId) {
    throw new Error("Cuộc trò chuyện không thuộc về khách hàng này.");
  }


  const staffMessageData: Partial<IMessage> = {
    sender: 'ai', // Messages from staff/admin are marked as 'ai' for the customer's view
    content: messageContent,
    timestamp: new Date(),
    name: staffSession.name || (staffSession.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'), // Staff's name
    customerId: (customer._id as Types.ObjectId), // Link to customer
    userId: new mongoose.Types.ObjectId(staffSession.id) as any, // Staff's user ID
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
    lastMessageTimestamp: new Date(), // Use current time for last message by staff
  });

  await ConversationModel.findByIdAndUpdate(conversationId, {
    $push: { messageIds: savedStaffMessageDoc._id },
    lastMessageTimestamp: savedStaffMessageDoc.timestamp,
    lastMessagePreview: savedStaffMessageDoc.content.substring(0, 100),
    // Ensure staff member is listed as a participant if not already
    $addToSet: { participants: { userId: staffSession.id, role: staffSession.role, name: staffSession.name, phoneNumber: staffSession.phoneNumber } }
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
  // Staff can only edit their own messages (which are sender 'ai' and userId matches their session)
  if (message.sender !== 'ai' || message.userId?.toString() !== staffSession.id) {
    throw new Error("Bạn không có quyền chỉnh sửa tin nhắn này.");
  }

  message.content = newContent;
  message.updatedAt = new Date(); // Mongoose `timestamps: true` will handle this, but explicit for clarity
  await message.save();

  // Update lastMessagePreview in Conversation and Customer if this was the last message
  let conversationIdString: string | undefined = message.conversationId?.toString();

  if (conversationIdString) {
      const conversation = await ConversationModel.findById(conversationIdString);
      if(conversation && conversation.lastMessageTimestamp && conversation.lastMessageTimestamp.getTime() <= message.timestamp.getTime()){
         // To be absolutely sure, fetch the actual last message in conversation
         const lastMessageInConv = await MessageModel.findOne({ conversationId: conversation._id }).sort({ timestamp: -1 });
         if (lastMessageInConv) {
             await ConversationModel.findByIdAndUpdate(conversation._id, {
                lastMessagePreview: lastMessageInConv.content.substring(0, 100),
                lastMessageTimestamp: lastMessageInConv.timestamp,
            });
         }
      }
  }

  if (message.customerId) {
      const customer = await CustomerModel.findById(message.customerId);
      // Check if this edited message is still effectively the last message for the customer's overall interaction
      if (customer && customer.lastMessageTimestamp && message.updatedAt && customer.lastMessageTimestamp.getTime() <= message.timestamp.getTime()) {
         // To be safe, find the absolute last message for this customer across their conversations
         const lastMessageForCustomer = await MessageModel.findOne({ customerId: customer._id, conversationId: conversationIdString ? new Types.ObjectId(conversationIdString) : undefined }).sort({ timestamp: -1 });
         if (lastMessageForCustomer) {
             await CustomerModel.findByIdAndUpdate(customer._id, {
                lastMessagePreview: lastMessageForCustomer.content.substring(0, 100),
                lastMessageTimestamp: lastMessageForCustomer.timestamp,
            });
         }
      }
  }

  return {...transformMessageDocToMessage(message), conversationId: conversationIdString};
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
  // Staff can only delete their own messages
  if (message.sender !== 'ai' || message.userId?.toString() !== staffSession.id) {
    throw new Error("Bạn không có quyền xóa tin nhắn này.");
  }

  const customerIdString = message.customerId?.toString();
  let conversationIdString: string | undefined = message.conversationId?.toString();

  // Remove messageId from Conversation.messageIds and Conversation.pinnedMessageIds
  if (conversationIdString) {
      const conversation = await ConversationModel.findById(conversationIdString);
      if (conversation) {
        conversation.messageIds = conversation.messageIds.filter(id => !id.equals(new mongoose.Types.ObjectId(messageId)));
        conversation.pinnedMessageIds = (conversation.pinnedMessageIds || []).filter(id => !id.equals(new mongoose.Types.ObjectId(messageId)));

        // Update last message preview and timestamp for the conversation
        const lastMessageInConv = await MessageModel.findOne({
            conversationId: conversation._id,
            _id: { $ne: new mongoose.Types.ObjectId(messageId) } // Exclude the deleted message
        }).sort({ timestamp: -1 });

        if (lastMessageInConv) {
            conversation.lastMessagePreview = lastMessageInConv.content.substring(0, 100);
            conversation.lastMessageTimestamp = lastMessageInConv.timestamp;
        } else {
            // No messages left in conversation, clear preview, set timestamp to conversation creation
            conversation.lastMessagePreview = '';
            conversation.lastMessageTimestamp = conversation.createdAt;
        }
        await conversation.save();
      }
  }

  await MessageModel.findByIdAndDelete(messageId);


  // Update Customer's last message preview if this was their overall last message
  if (customerIdString) {
    const customer = await CustomerModel.findById(customerIdString);
    if (customer) {
      // Find the new last message for this customer across all their conversations
      const conversationsOfCustomer = await ConversationModel.find({ customerId: customer._id }).sort({ lastMessageTimestamp: -1 }).limit(1);
      if (conversationsOfCustomer.length > 0) {
        const latestConversation = conversationsOfCustomer[0];
        await CustomerModel.findByIdAndUpdate(customerIdString, {
          lastMessagePreview: latestConversation.lastMessagePreview,
          lastMessageTimestamp: latestConversation.lastMessageTimestamp,
        });
      } else {
        // No conversations left for customer
        await CustomerModel.findByIdAndUpdate(customerIdString, {
          lastMessagePreview: '',
          lastMessageTimestamp: customer.createdAt, // Or some other default
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
    { internalName: internalName, lastInteractionAt: new Date() }, // Update interaction time
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

export async function getAppointments(filters: GetAppointmentsFilters): Promise<AppointmentDetails[]> {
  await dbConnect();
  const query: any = {};

  if (filters.date) {
    const parsedDate = parse(filters.date, 'yyyy-MM-dd', new Date());
    if (isValidDateFns(parsedDate)) {
      query.date = filters.date;
    } else {
      console.warn(`[ACTIONS] Invalid date format received in getAppointments: ${filters.date}`);
    }
  } else if (filters.dates && Array.isArray(filters.dates) && filters.dates.length > 0) {
    const validDates = filters.dates.filter(d => {
      const pd = parse(d, 'yyyy-MM-dd', new Date());
      return isValidDateFns(pd);
    });
    if (validDates.length > 0) {
      query.date = { $in: validDates };
    } else {
      console.warn(`[ACTIONS] No valid dates found in dates array: ${filters.dates}`);
    }
  }


  if (filters.customerId) {
    query.customerId = new mongoose.Types.ObjectId(filters.customerId) as any;
  }
  if (filters.staffId && filters.staffId !== NO_STAFF_MODAL_VALUE) {
    query.staffId = new mongoose.Types.ObjectId(filters.staffId) as any;
  }
  if (filters.status && filters.status.length > 0) {
    query.status = { $in: filters.status };
  }
  if (filters.serviceName) {
    query.service = filters.serviceName;
  }

  console.log("[ACTIONS] getAppointments query:", JSON.stringify(query));
  const appointmentDocs = await AppointmentModel.find(query)
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate<{ staffId: IUser }>('staffId', 'name');

  console.log(`[ACTIONS] Found ${appointmentDocs.length} appointments with query.`);
  return appointmentDocs.map(transformAppointmentDocToDetails);
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

  const updateData: any = { ...data, updatedAt: new Date() };
  delete updateData.customerId; // Cannot change customerId of an existing appointment
  delete updateData.userId;

  if (data.staffId && mongoose.Types.ObjectId.isValid(data.staffId) && data.staffId !== NO_STAFF_MODAL_VALUE) {
    (updateData as any).staffId = new mongoose.Types.ObjectId(data.staffId) as any;
  } else if (data.staffId === null || data.staffId === '' || data.staffId === undefined || data.staffId === NO_STAFF_MODAL_VALUE) {
    // If staffId is explicitly set to be removed or is one of the "no staff" indicators
    if (!updateData.$unset) updateData.$unset = {};
    updateData.$unset.staffId = ""; // Tell Mongoose to remove the field
    delete updateData.staffId; // Don't try to set it to null
  }

  // Handle recurrence fields
  if (data.recurrenceType) updateData.recurrenceType = data.recurrenceType;
  if (data.recurrenceCount) updateData.recurrenceCount = data.recurrenceCount;


  const updatedAppointmentDoc = await AppointmentModel.findByIdAndUpdate(
    appointmentId,
    updateData, // Use $set if you only want to update provided fields, direct object for full replacement
    { new: true }
  )
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate<{ staffId: IUser }>('staffId', 'name');
  console.log("[ACTIONS] Manually updated appointment:", appointmentId, "with data:", JSON.stringify(updateData), "Result:", JSON.stringify(updatedAppointmentDoc));

  return updatedAppointmentDoc ? transformAppointmentDocToDetails(updatedAppointmentDoc) : null;
}

export async function deleteExistingAppointment(appointmentId: string): Promise<{ success: boolean }> {
  await dbConnect();
  const appointment = await AppointmentModel.findById(appointmentId);
  if (!appointment) {
    console.warn(`[ACTIONS] Attempted to delete non-existent appointment with ID: ${appointmentId}`);
    return { success: false }; // Or throw error
  }
  await AppointmentModel.findByIdAndDelete(appointmentId);
  console.log(`[ACTIONS] Deleted appointment with ID: ${appointmentId}`);
  if (appointment.customerId) {
    await CustomerModel.findByIdAndUpdate(appointment.customerId, {
      $pull: { appointmentIds: appointment._id }
    });
  }
  return { success: true };
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
  const chatsTodayCount = await MessageModel.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd } }); // Assuming MessageModel has createdAt
  const openIssuesCount = await CustomerModel.countDocuments({ tags: "Cần hỗ trợ" }); // Example tag

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
    systemStatus: 'Optimal', // Placeholder
  };
}

export async function getStaffDashboardStats(staffId: string): Promise<StaffDashboardStats> {
  await dbConnect();
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const todayDateString = formatISO(todayStart, { representation: 'date' }); // Format to YYYY-MM-DD

  const activeChatsAssignedToMeCount = await CustomerModel.countDocuments({
    assignedStaffId: new mongoose.Types.ObjectId(staffId) as any,
    lastInteractionAt: { $gte: todayStart, $lt: todayEnd },
  });

  const myAppointmentsTodayCount = await AppointmentModel.countDocuments({
    staffId: new mongoose.Types.ObjectId(staffId) as any,
    date: todayDateString, // Match YYYY-MM-DD format stored in DB
    status: { $nin: ['cancelled', 'completed'] } // Exclude cancelled or completed
  });

  const totalAssignedToMeCount = await CustomerModel.countDocuments({ assignedStaffId: new mongoose.Types.ObjectId(staffId) as any });

  return {
    activeChatsAssignedToMeCount,
    myAppointmentsTodayCount,
    totalAssignedToMeCount,
  };
}

// --- Note CRUD Actions ---
export async function addNoteToCustomer(customerId: string, staffId: string, content: string, imageDataUri?: string, imageFileName?: string): Promise<Note> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(staffId)) {
    throw new Error("Invalid customer or staff ID.");
  }

  const noteDoc = new NoteModel({
    customerId: new mongoose.Types.ObjectId(customerId) as any,
    staffId: new mongoose.Types.ObjectId(staffId) as any,
    content,
    imageDataUri,
    imageFileName,
  });
  await noteDoc.save();

  await CustomerModel.findByIdAndUpdate(customerId, { $push: { noteIds: noteDoc._id } });

  const populatedNote = await NoteModel.findById(noteDoc._id).populate<{ staffId: IUser }>('staffId', 'name');
  if (!populatedNote) throw new Error("Failed to create or retrieve note.");

  return transformNoteDocToNote(populatedNote);
}

export async function getNotesForCustomer(customerId: string): Promise<Note[]> {
  await dbConnect();
  const noteDocs = await NoteModel.find({ customerId: new mongoose.Types.ObjectId(customerId) as any })
    .populate<{ staffId: IUser }>('staffId', 'name') // Ensure staff name is populated
    .sort({ createdAt: -1 });
  return noteDocs.map(transformNoteDocToNote);
}

export async function updateCustomerNote(noteId: string, staffId: string, content: string, imageDataUri?: string | null, imageFileName?: string | null): Promise<Note | null> {
  await dbConnect();
  const note = await NoteModel.findById(noteId);
  if (!note) throw new Error("Note not found.");
  const staffUser = await UserModel.findById(staffId);
  if (!staffUser) throw new Error("Staff user not found.");

  // Allow admin to edit any note, or staff to edit their own note
  if (staffUser.role !== 'admin' && note.staffId.toString() !== staffId) {
    throw new Error("You are not authorized to edit this note.");
  }
  note.content = content;
  if (imageDataUri === null) { // Explicitly remove image
    note.imageDataUri = undefined;
    note.imageFileName = undefined;
  } else if (imageDataUri) { // If a new imageDataUri is provided (or existing one is kept by not passing null)
    note.imageDataUri = imageDataUri;
    note.imageFileName = imageFileName; // Always update filename if URI is present
  }
  // If imageDataUri is undefined (not null), it means no change to image.
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

  // Allow admin to delete any note, or staff to delete their own note
  if (staffUser.role !== 'admin' && note.staffId.toString() !== staffId) {
    throw new Error("You are not authorized to delete this note.");
  }
  await NoteModel.findByIdAndDelete(noteId);
  await CustomerModel.findByIdAndUpdate(note.customerId, { $pull: { noteIds: noteId as any } });
  return { success: true };
}

function transformProductDocToProduct(doc: IProduct): ProductItem {
  const schedulingRulesDoc = doc.schedulingRules;
  let transformedSchedulingRules: ProductSchedulingRules | undefined = undefined;

  if (schedulingRulesDoc) {
    transformedSchedulingRules = {
      numberOfStaff: schedulingRulesDoc.numberOfStaff,
      serviceDurationMinutes: schedulingRulesDoc.serviceDurationMinutes,
      workingHours: schedulingRulesDoc.workingHours ? [...schedulingRulesDoc.workingHours] : undefined,
      weeklyOffDays: schedulingRulesDoc.weeklyOffDays ? [...schedulingRulesDoc.weeklyOffDays] : undefined,
      oneTimeOffDates: schedulingRulesDoc.oneTimeOffDates ? [...schedulingRulesDoc.oneTimeOffDates] : undefined,
      specificDayRules: schedulingRulesDoc.specificDayRules ? schedulingRulesDoc.specificDayRules.map(r => ({
        id: (r as any)._id?.toString() || new mongoose.Types.ObjectId().toString(), // Ensure ID is present
        date: r.date,
        isOff: r.isOff,
        workingHours: r.workingHours ? [...r.workingHours] : undefined,
        numberOfStaff: r.numberOfStaff,
        serviceDurationMinutes: r.serviceDurationMinutes,
      })) : undefined,
    };
  }

  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    price: doc.price,
    category: doc.category,
    imageUrl: doc.imageUrl,
    isActive: doc.isActive,
    isSchedulable: doc.isSchedulable,
    schedulingRules: transformedSchedulingRules,
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
    customerId: typeof doc.customerId === 'string' ? doc.customerId : doc.customerId._id.toString(),
    staffId: typeof doc.staffId === 'string' ? doc.staffId : doc.staffId._id.toString(),
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
  };
}

export async function getAllProducts(): Promise<ProductItem[]> {
  await dbConnect();
  const products = await ProductModel.find({}).sort({ createdAt: -1 });
  return products.map(transformProductDocToProduct);
}

export async function getProductById(productId: string): Promise<ProductItem | null> {
  await dbConnect();
  const product = await ProductModel.findById(productId);
  return product ? transformProductDocToProduct(product) : null;
}

export async function createProduct(data: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductItem> {
  await dbConnect();

  const productData: Partial<IProduct> = {
    name: data.name,
    description: data.description,
    price: data.price,
    category: data.category,
    imageUrl: data.imageUrl,
    isActive: data.isActive,
    isSchedulable: data.isSchedulable,
  };

  if (data.isSchedulable && data.schedulingRules) {
    productData.schedulingRules = {
      ...data.schedulingRules,
      specificDayRules: data.schedulingRules.specificDayRules?.map(r => {
        const { id, ...rest } = r; // remove client-side ID
        return rest;
      }) || [],
    } as ProductSchedulingRules; // Cast to ensure type compatibility
  } else {
    productData.schedulingRules = undefined; // Explicitly set to undefined if not schedulable or no rules
  }

  const newProduct = new ProductModel(productData);
  const savedProduct = await newProduct.save();
  return transformProductDocToProduct(savedProduct);
}

export async function updateProduct(
  productId: string,
  data: Partial<Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<ProductItem | null> {
  await dbConnect();

  const updateData: Partial<IProduct> = {
    name: data.name,
    description: data.description,
    price: data.price,
    category: data.category,
    imageUrl: data.imageUrl,
    isActive: data.isActive,
    isSchedulable: data.isSchedulable,
  };

  if (data.isSchedulable && data.schedulingRules) {
     updateData.schedulingRules = {
      ...data.schedulingRules,
      specificDayRules: data.schedulingRules.specificDayRules?.map(r => {
        const { id, ...rest } = r; // remove client-side ID
        return rest;
      }) || [],
    } as ProductSchedulingRules; // Cast to ensure type compatibility
  } else {
    // If not schedulable, ensure schedulingRules are removed or set to undefined
    updateData.schedulingRules = undefined;
  }

  const updatedProduct = await ProductModel.findByIdAndUpdate(
    productId,
    { $set: updateData }, // Use $set to update only provided fields
    { new: true, runValidators: true }
  );
  return updatedProduct ? transformProductDocToProduct(updatedProduct) : null;
}

export async function deleteProduct(productId: string): Promise<{ success: boolean }> {
  await dbConnect();
  // Optional: Add check if product is used in appointments before deleting
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
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber') // Populate customer details
    .populate('staffId', 'name') // Populate staff name
    .sort({ dueDate: 1 }); // Sort by due date

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

  // Repopulate to get customerName and staffName
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
  today.setHours(0, 0, 0, 0); // Start of today

  const endOfNextWeek = new Date(today);
  endOfNextWeek.setDate(today.getDate() + 7);
  endOfNextWeek.setHours(23, 59, 59, 999); // End of 7 days from today

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
  today.setHours(0, 0, 0, 0); // Start of today

  const reminders = await ReminderModel.find({
    staffId,
    status: 'pending',
    dueDate: { $lt: today } // Due date is before the start of today
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
    // Staff see customers assigned to them OR unassigned customers
    query.$or = [
      { assignedStaffId: new mongoose.Types.ObjectId(staffId) as any },
      { assignedStaffId: { $exists: false } } // Or unassigned
    ];
  }
  // Admins (no staffId passed) see all customers

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
    // Ensure tags are strings and not empty before returning
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

  // Permission check: Only participants of the conversation can pin/unpin
  // For staff/admin, their userId should be in conversation.participants if they've sent a message.
  // For customers, their userId (which is customerId) should match conversation.customerId.
  const isParticipant = conversation.participants.some(p => p.userId?.toString() === userSession.id) ||
                        (userSession.role === 'customer' && conversation.customerId.toString() === userSession.id);
  
  if (!isParticipant && userSession.role !== 'admin') { // Admins can always pin
    throw new Error("Bạn không có quyền ghim tin nhắn trong cuộc trò chuyện này.");
  }

  const messageObjectId = new mongoose.Types.ObjectId(messageId);
  let newPinnedMessageIds = [...(conversation.pinnedMessageIds || [])];

  // Check if message is already pinned
  const isAlreadyPinned = newPinnedMessageIds.some(id => id.equals(messageObjectId));

  if (!isAlreadyPinned) {
    if (newPinnedMessageIds.length >= 3) {
      newPinnedMessageIds.shift(); // Remove the oldest pinned message
    }
    newPinnedMessageIds.push(messageObjectId);
    conversation.pinnedMessageIds = newPinnedMessageIds;
    await conversation.save();
  }

  // Populate necessary fields for the client to update UI
  const updatedConversation = await ConversationModel.findById(conversationId).populate({ path: 'messageIds', model: MessageModel, options: { sort: { timestamp: 1 }}}).populate('pinnedMessageIds');
  return transformConversationDoc(updatedConversation);
}

export async function unpinMessageFromConversation(conversationId: string, messageId: string, userSession: UserSession): Promise<Conversation | null> {
  await dbConnect();

  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Mã cuộc trò chuyện hoặc tin nhắn không hợp lệ.");
  }

  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) throw new Error("Không tìm thấy cuộc trò chuyện.");

  const isParticipant = conversation.participants.some(p => p.userId?.toString() === userSession.id) ||
                        (userSession.role === 'customer' && conversation.customerId.toString() === userSession.id);
  
  if (!isParticipant && userSession.role !== 'admin') {
    throw new Error("Bạn không có quyền bỏ ghim tin nhắn trong cuộc trò chuyện này.");
  }

  const messageObjectId = new mongoose.Types.ObjectId(messageId);
  conversation.pinnedMessageIds = (conversation.pinnedMessageIds || []).filter(id => !id.equals(messageObjectId));
  await conversation.save();

  const updatedConversation = await ConversationModel.findById(conversationId).populate({ path: 'messageIds', model: MessageModel, options: { sort: { timestamp: 1 }}}).populate('pinnedMessageIds');
  return transformConversationDoc(updatedConversation);
}


export async function getMessagesByIds(messageIds: string[]): Promise<Message[]> {
  await dbConnect();
  const objectIds = messageIds.map(id => {
    try {
      return new mongoose.Types.ObjectId(id);
    } catch (e) {
      console.warn(`Invalid ObjectId string for message: ${id}`);
      return null; // Skip invalid IDs
    }
  }).filter(id => id !== null) as mongoose.Types.ObjectId[]; // Ensure only valid ObjectIds proceed

  if (objectIds.length === 0) return [];
  const messageDocs = await MessageModel.find({ _id: { $in: objectIds } });

  // To maintain the order of messageIds provided, we map results back
  const messagesMap = new Map(messageDocs.map(doc => [(doc._id as mongoose.Types.ObjectId).toString(), transformMessageDocToMessage(doc)]));

  return messageIds.map(id => messagesMap.get(id)).filter(Boolean) as Message[]; // Filter out any not found
}


// --- Media History Actions ---
export async function getCustomerMediaMessages(customerId: string): Promise<Message[]> {
  await dbConnect();
  // Regex to find data URIs for common image and application types
  const messages = await MessageModel.find({
    customerId: new mongoose.Types.ObjectId(customerId) as any,
    content: { $regex: /^data:(image\/(jpeg|png|gif|webp|svg\+xml)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|plain|rtf|zip|x-rar-compressed|octet-stream))/ }
  }).sort({ timestamp: -1 });

  return messages.map(transformMessageDocToMessage);
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

  // Check if the user is a participant or an admin
  const isParticipant = conversation.participants.some(p => p.userId?.toString() === userId);
  let userIsAdmin = false;
  if (!isParticipant) { // If not directly a participant, check if they are an admin user
    const user = await UserModel.findById(userId);
    if (user && user.role === 'admin') {
      userIsAdmin = true;
    }
  }

  if (!isParticipant && !userIsAdmin) {
      throw new Error("Bạn không có quyền chỉnh sửa tiêu đề cuộc trò chuyện này.");
  }

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

  // Add if not already pinned
  if (!newPinnedConversationIds.some(id => id.equals(conversationObjectId))) {
    if (newPinnedConversationIds.length >= 3) {
      newPinnedConversationIds.shift(); // Remove the oldest if limit is reached
    }
    newPinnedConversationIds.push(conversationObjectId);
  }

  customer.pinnedConversationIds = newPinnedConversationIds;
  await customer.save();

  const updatedCustomer = await CustomerModel.findById(userId).populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');

  if (!updatedCustomer) return null;
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
    workingHours: doc.workingHours, // Assumes these are arrays of strings
    offDays: doc.offDays,           // Assumes these are arrays of numbers
    numberOfStaff: doc.numberOfStaff,
    specificDayOverrides: (doc.specificDayOverrides || []).map(r => ({
      id: (r as any)._id?.toString() || new mongoose.Types.ObjectId().toString(), // Ensure ID is present
      date: r.date,
      isOff: r.isOff,
      workingHours: r.workingHours,
      numberOfStaff: r.numberOfStaff,
    })),
    createdAt: new Date(doc.createdAt as Date),
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
  // Remove client-side IDs from specificDayOverrides before saving
  if (processedData.specificDayOverrides) {
    processedData.specificDayOverrides = processedData.specificDayOverrides.map(rule => {
      const { id: ruleId, ...restOfRule } = rule; // Destructure to remove 'id'
      return restOfRule as Omit<BranchSpecificDayRule, 'id'>; // Cast to the type without id
    });
  }
  const updatedBranch = await BranchModel.findByIdAndUpdate(id, { $set: processedData }, { new: true, runValidators: true });
  return transformBranchDoc(updatedBranch);
}

export async function deleteBranch(id: string): Promise<{ success: boolean }> {
  await dbConnect();
  // Check if any appointments are linked to this branch
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
