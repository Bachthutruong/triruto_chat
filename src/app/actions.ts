
// src/app/actions.ts
'use server';

import type { Message, UserSession, AppointmentDetails, Product, Note, CustomerProfile, UserRole, KeywordMapping, TrainingData, TrainingDataStatus, AppSettings, GetAppointmentsFilters, AdminDashboardStats, StaffDashboardStats, ProductItem, Reminder, ReminderStatus, ReminderPriority, SpecificDayRule, CustomerInteractionStatus, Conversation, AppointmentBookingFormData, Branch, BranchSpecificDayRule, QuickReplyType } from '@/lib/types';
import type { AppointmentRule as LibAppointmentRuleType, Conversation as LibConversationType } from '@/lib/types'; // Aliased for clarity
import { answerUserQuestion } from '@/ai/flows/answer-user-question';
// import { generateSuggestedReplies } from '@/ai/flows/generate-suggested-replies'; // Not used currently
import { scheduleAppointment as scheduleAppointmentAIFlow, checkRealAvailability, scheduleAppointmentPrompt } from '@/ai/flows/schedule-appointment';
import type { ScheduleAppointmentOutput, AppointmentRule as AIAppointmentRuleType, AppointmentDetailsSchema as AIAppointmentDetails, ScheduleAppointmentInput } from '@/ai/schemas/schedule-appointment-schemas';
import { randomUUID } from 'crypto';
import mongoose, { Types, Document } from 'mongoose';
import dotenv from 'dotenv';
import { startOfDay, endOfDay, subDays, formatISO, parse, isValid, parseISO as dateFnsParseISO, setHours, setMinutes, setSeconds, setMilliseconds, getDay, addMinutes, isBefore, isEqual, format as dateFnsFormat, getHours, getMinutes } from 'date-fns';
import { validatePhoneNumber } from '@/lib/validator';
import bcrypt from 'bcryptjs';


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
      userId: p.userId?.toString(), // Handle case where userId might be null/undefined in old data
      role: p.role,
      name: p.name,
      phoneNumber: p.phoneNumber,
    })).filter(p => p.userId), // Ensure participants always have a userId
    messageIds: (doc.messageIds as Types.ObjectId[] || []).map(id => id.toString()),
    pinnedMessageIds: (doc.pinnedMessageIds as Types.ObjectId[] || []).map(id => id.toString()),
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
    messagePinningAllowedConversationIds: (customerDoc.messagePinningAllowedConversationIds || []).map(id => id.toString()),
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
    isPinned: msgDoc.isPinned || false, // Ensure isPinned always has a boolean value
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
    customerName: customerIdObj?.name || `Người dùng ${customerIdObj?.phoneNumber}`,
    customerPhoneNumber: customerIdObj?.phoneNumber,
    staffName: staffIdObj?.name,
    packageType: apptDoc.packageType,
    priority: apptDoc.priority,
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
    createdAt: new Date(noteDoc.createdAt as Date),
    updatedAt: new Date(noteDoc.updatedAt as Date),
  };
}


function transformAppSettingsDoc(doc: IAppSettings | null): AppSettings | null {
  if (!doc) return null;
  const defaultBrandName = 'AetherChat';
  const initialDefaultSettings: AppSettings = { // Changed to AppSettings to match type
    id: '', // will be overridden
    greetingMessage: 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay?',
    greetingMessageNewCustomer: 'Chào mừng bạn lần đầu đến với chúng tôi! Bạn cần hỗ trợ gì ạ?',
    greetingMessageReturningCustomer: 'Chào mừng bạn quay trở lại! Rất vui được gặp lại bạn.',
    suggestedQuestions: ['Các dịch vụ của bạn?', 'Đặt lịch hẹn', 'Địa chỉ của bạn ở đâu?'],
    brandName: defaultBrandName,
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
    officeDays: [1, 2, 3, 4, 5],
  };

  const specificDayRulesPlain = doc.specificDayRules?.map(rule => {
    const plainRule: SpecificDayRule = {
      id: (rule as any)._id ? (rule as any)._id.toString() : rule.id || new mongoose.Types.ObjectId().toString(),
      date: rule.date,
      isOff: rule.isOff || false, // Ensure boolean
      workingHours: rule.workingHours || [],
      numberOfStaff: rule.numberOfStaff,
      serviceDurationMinutes: rule.serviceDurationMinutes,
    };
    return plainRule;
  }) || initialDefaultSettings.specificDayRules!;


  return {
    id: (doc._id as Types.ObjectId).toString(),
    greetingMessage: doc.greetingMessage || initialDefaultSettings.greetingMessage,
    greetingMessageNewCustomer: doc.greetingMessageNewCustomer || initialDefaultSettings.greetingMessageNewCustomer,
    greetingMessageReturningCustomer: doc.greetingMessageReturningCustomer || initialDefaultSettings.greetingMessageReturningCustomer,
    suggestedQuestions: doc.suggestedQuestions && doc.suggestedQuestions.length > 0 ? doc.suggestedQuestions : initialDefaultSettings.suggestedQuestions!,
    brandName: doc.brandName || initialDefaultSettings.brandName,
    logoUrl: doc.logoUrl,
    logoDataUri: doc.logoDataUri,
    footerText: doc.footerText || initialDefaultSettings.footerText,
    metaTitle: doc.metaTitle || initialDefaultSettings.metaTitle,
    metaDescription: doc.metaDescription || initialDefaultSettings.metaDescription,
    metaKeywords: doc.metaKeywords || initialDefaultSettings.metaKeywords!,
    openGraphImageUrl: doc.openGraphImageUrl,
    robotsTxtContent: doc.robotsTxtContent,
    sitemapXmlContent: doc.sitemapXmlContent,
    numberOfStaff: doc.numberOfStaff ?? initialDefaultSettings.numberOfStaff,
    defaultServiceDurationMinutes: doc.defaultServiceDurationMinutes ?? initialDefaultSettings.defaultServiceDurationMinutes,
    workingHours: doc.workingHours && doc.workingHours.length > 0 ? doc.workingHours : initialDefaultSettings.workingHours!,
    weeklyOffDays: doc.weeklyOffDays || initialDefaultSettings.weeklyOffDays!,
    oneTimeOffDates: doc.oneTimeOffDates || initialDefaultSettings.oneTimeOffDates!,
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
      const { id, ...restOfRule } = rule; // Remove client-side id before saving to DB
      return restOfRule as Omit<SpecificDayRule, 'id'>; // Cast to ensure type safety
    });
  }

  // Ensure arrays are not undefined
  processedSettings.suggestedQuestions = processedSettings.suggestedQuestions || [];
  processedSettings.metaKeywords = processedSettings.metaKeywords || [];
  processedSettings.workingHours = processedSettings.workingHours || [];
  processedSettings.weeklyOffDays = processedSettings.weeklyOffDays || [];
  processedSettings.oneTimeOffDates = processedSettings.oneTimeOffDates || [];
  processedSettings.officeDays = processedSettings.officeDays || [];


  const updatedSettingsDoc = await AppSettingsModel.findOneAndUpdate({}, { $set: processedSettings }, { new: true, upsert: true, runValidators: true });
  return transformAppSettingsDoc(updatedSettingsDoc);
}


export async function createNewConversationForUser(userId: string, title?: string): Promise<Conversation | null> {
  await dbConnect();
  const user = await CustomerModel.findById(userId);
  if (!user) {
    console.error(`createNewConversationForUser: Customer not found with ID: ${userId}`);
    return null;
  }

  const newConversation = new ConversationModel({
    customerId: user._id,
    title: title || `Cuộc trò chuyện với ${user.name || user.phoneNumber} lúc ${new Date().toLocaleString('vi-VN')}`,
    participants: [{
      userId: user._id,
      role: 'customer',
      name: user.name || `Người dùng ${user.phoneNumber}`,
      phoneNumber: user.phoneNumber,
    }],
    messageIds: [],
    lastMessageTimestamp: new Date(),
  });
  const savedConversation = await newConversation.save();

  if (user instanceof CustomerModel) { // Type guard
      if (!user.conversationIds) {
        user.conversationIds = [];
      }
      user.conversationIds.push(savedConversation._id);
      await user.save();
  } else {
      console.warn(`User ${userId} is not a CustomerModel instance, conversation not linked directly to user document's conversationIds array.`);
  }


  return transformConversationDoc(savedConversation);
}

function isOutOfOffice(appSettings: AppSettings): boolean {
  if (!appSettings.outOfOfficeResponseEnabled || !appSettings.officeHoursStart || !appSettings.officeHoursEnd || !appSettings.officeDays || appSettings.officeDays.length === 0) {
    return false;
  }

  const now = new Date();
  const currentDay = now.getDay(); // Sunday is 0, Saturday is 6
  const currentHour = getHours(now);
  const currentMinute = getMinutes(now);

  if (!appSettings.officeDays.includes(currentDay)) {
    return true; // Not an office day
  }

  const [startHour, startMinute] = appSettings.officeHoursStart.split(':').map(Number);
  const [endHour, endMinute] = appSettings.officeHoursEnd.split(':').map(Number);

  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const officeStartTimeInMinutes = startHour * 60 + startMinute;
  const officeEndTimeInMinutes = endHour * 60 + endMinute;

  if (currentTimeInMinutes < officeStartTimeInMinutes || currentTimeInMinutes >= officeEndTimeInMinutes) {
    return true; // Outside office hours
  }

  return false;
}


export async function handleCustomerAccess(phoneNumber: string): Promise<{
  userSession: UserSession;
  initialMessages: Message[];
  initialSuggestedReplies: string[];
  activeConversationId: string;
  conversations: Conversation[];
}> {
  await dbConnect();
  if (!validatePhoneNumber(phoneNumber)) {
    throw new Error("Số điện thoại không hợp lệ.");
  }
  let customer = await CustomerModel.findOne({ phoneNumber });
  let isNewCustomer = false;
  if (!customer) {
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
      pinnedMessageIds: [],
      messagePinningAllowedConversationIds: [],
      pinnedConversationIds: [],
      tags: [],
    });
    await customer.save();
    isNewCustomer = true;
  } else {
    customer.conversationIds = customer.conversationIds || [];
    customer.appointmentIds = customer.appointmentIds || [];
    customer.productIds = customer.productIds || [];
    customer.noteIds = customer.noteIds || [];
    customer.pinnedMessageIds = customer.pinnedMessageIds || [];
    customer.messagePinningAllowedConversationIds = customer.messagePinningAllowedConversationIds || [];
    customer.pinnedConversationIds = customer.pinnedConversationIds || [];
    customer.tags = customer.tags || [];
  }

  let activeConversation: IConversation | null = null;
  if (customer.conversationIds && customer.conversationIds.length > 0) {
    activeConversation = await ConversationModel.findById(customer.conversationIds[0])
      .populate('messageIds') // Populate messageIds to get message documents
      .sort({ 'messageIds.timestamp': -1 }); // Sort by message timestamp if needed, though usually sort by conversation last update
  }

  if (!activeConversation) {
    const newConvDocFromAction = await createNewConversationForUser(customer._id!.toString(), `Trò chuyện với ${customer.name || customer.phoneNumber}`);
    if (!newConvDocFromAction || !newConvDocFromAction.id) throw new Error("Không thể tạo cuộc trò chuyện mới.");
    activeConversation = await ConversationModel.findById(newConvDocFromAction.id).populate('messageIds');
     if (activeConversation) {
      const updatedCustomer = await CustomerModel.findByIdAndUpdate(
        customer._id,
        { $addToSet: { conversationIds: activeConversation._id } },
        { new: true }
      );
      if (updatedCustomer) customer = updatedCustomer;
    }
  }

  if (!activeConversation) {
    throw new Error("Không thể tìm hoặc tạo cuộc trò chuyện cho khách hàng.");
  }

  const userSession = transformCustomerToSession(customer, (activeConversation._id as Types.ObjectId).toString());
  const appSettings = await getAppSettings();

  let initialSystemMessageContent = appSettings?.greetingMessage || 'Tôi có thể giúp gì cho bạn?';
  if (appSettings && isOutOfOffice(appSettings)) {
    initialSystemMessageContent = appSettings.outOfOfficeMessage || 'Chúng tôi hiện ngoài giờ làm việc. Vui lòng để lại lời nhắn.';
  } else if (isNewCustomer && appSettings?.greetingMessageNewCustomer) {
    initialSystemMessageContent = appSettings.greetingMessageNewCustomer;
  } else if (!isNewCustomer && appSettings?.greetingMessageReturningCustomer) {
    initialSystemMessageContent = appSettings.greetingMessageReturningCustomer;
  }
  
  let finalInitialMessages: Message[] = [];
  const systemGreetingMessage: Message = {
      id: `msg_system_greeting_${Date.now()}`,
      sender: 'ai', // Display as if AI/system sent it
      content: initialSystemMessageContent,
      timestamp: new Date(),
      name: appSettings?.brandName || 'AI Assistant',
      conversationId: (activeConversation._id as Types.ObjectId).toString(),
  };
  finalInitialMessages.push(systemGreetingMessage);
  
  // Add existing messages from the conversation after the greeting
  if (activeConversation.messageIds && activeConversation.messageIds.length > 0) {
     const conversationMessageDocs = await MessageModel.find({ _id: { $in: activeConversation.messageIds as any[] } }).sort({ timestamp: 1 }).limit(50);
     finalInitialMessages.push(...conversationMessageDocs.map(transformMessageDocToMessage));
  }


  let configuredSuggestedQuestions: string[] = [];
  if (appSettings?.suggestedQuestions && appSettings.suggestedQuestions.length > 0) {
      configuredSuggestedQuestions = appSettings.suggestedQuestions;
  }

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
    password, // Hashing is done in pre-save hook
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
  const conversation = await ConversationModel.findById(conversationId).populate('messageIds');
  if (!conversation || !conversation.messageIds || conversation.messageIds.length === 0) {
    return [];
  }
  // Assuming messageIds are populated and sorted by timestamp within the Message model or need sorting here
  const messages = (conversation.messageIds as unknown as IMessage[]).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return messages.map(transformMessageDocToMessage);
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
    await dbConnect();
    const customer = await CustomerModel.findById(userId).populate({
        path: 'conversationIds',
        model: ConversationModel,
        options: { sort: { lastMessageTimestamp: -1 } } // Sort conversations by last message time
    });
    if (!customer || !customer.conversationIds || customer.conversationIds.length === 0) {
        return [];
    }
    return (customer.conversationIds as unknown as IConversation[]).map(doc => transformConversationDoc(doc)).filter(Boolean) as Conversation[];
}

export async function processUserMessage(
  userMessageContent: string,
  currentUserSession: UserSession,
  currentConversationId: string,
  currentChatHistory: Message[] // This is the history up to, but not including, the new user message
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
    content: userMessageContent,
    timestamp: new Date(),
    name: currentUserSession.name || `Người dùng ${currentUserSession.phoneNumber}`,
    customerId: new mongoose.Types.ObjectId(customerId),
    userId: new mongoose.Types.ObjectId(customerId),
  };
  const savedUserMessageDoc = await new MessageModel(userMessageData).save();
  const userMessage = transformMessageDocToMessage(savedUserMessageDoc);

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
    throw new Error("Không thể tải cài đặt ứng dụng. Không thể xử lý tin nhắn.");
  }

  const allProducts = await getAllProducts();
  const productsForAI = allProducts.map(p => ({ name: p.name, description: p.description, price: p.price, category: p.category }));
  const activeBranches = await getBranches(true);
  const branchNamesForAI = activeBranches.map(b => b.name);


  const customerAppointmentsDocs = await AppointmentModel.find({
    customerId: new mongoose.Types.ObjectId(customerId) as any,
    status: { $nin: ['cancelled', 'completed'] }
  }).populate('customerId staffId');

  const customerAppointmentsForAI = customerAppointmentsDocs.map(doc => ({
    ...transformAppointmentDocToDetails(doc), // Assuming this returns all needed fields including userId, createdAt, updatedAt
    userId: (doc.customerId as any)?._id?.toString(),
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  } as AIAppointmentDetails)); // Cast to ensure compatibility if transformAppointmentDocToDetails doesn't match exactly


  const appointmentRulesFromDB: LibAppointmentRuleType[] = await getAppointmentRules();
  const appointmentRulesForAI: AIAppointmentRuleType[] = appointmentRulesFromDB.map(
    (rule: LibAppointmentRuleType) => ({
      id: rule.id,
      name: rule.name,
      keywords: rule.keywords,
      conditions: rule.conditions,
      aiPromptInstructions: rule.aiPromptInstructions,
      createdAt: rule.createdAt?.toISOString(),
      updatedAt: rule.updatedAt?.toISOString(),
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

  aiResponseContent = scheduleOutputFromAI.confirmationMessage;

  if ((scheduleOutputFromAI.intent === 'booked' || scheduleOutputFromAI.intent === 'rescheduled') &&
    scheduleOutputFromAI.appointmentDetails?.date && scheduleOutputFromAI.appointmentDetails?.time &&
    /^\d{4}-\d{2}-\d{2}$/.test(scheduleOutputFromAI.appointmentDetails.date) &&
    /^[0-2][0-9]:[0-5][0-9]$/.test(scheduleOutputFromAI.appointmentDetails.time)
  ) {
    const targetDate = dateFnsParseISO(scheduleOutputFromAI.appointmentDetails.date);
    const targetTime = scheduleOutputFromAI.appointmentDetails.time;

    if (!isValid(targetDate)) {
      const promptInputForClarification: ScheduleAppointmentInput = {
        ...( { userInput: textForAI, phoneNumber: currentUserSession.phoneNumber, userId: customerId, currentDateTime: new Date().toISOString() } as any),
        userInput: `Ngày ${scheduleOutputFromAI.appointmentDetails.date} không hợp lệ. Yêu cầu người dùng cung cấp lại ngày.`,
        availabilityCheckResult: { status: "NEEDS_CLARIFICATION", reason: "Ngày không hợp lệ.", isStatusUnavailable: true }
      };
      const { output: clarificationOutput } = await scheduleAppointmentPrompt(promptInputForClarification);
      aiResponseContent = clarificationOutput?.confirmationMessage || "Ngày bạn cung cấp không hợp lệ. Vui lòng kiểm tra lại (YYYY-MM-DD).";
      scheduleOutputFromAI.intent = 'clarification_needed';
      processedAppointmentDB = null;
    } else {
      const availability = await checkRealAvailability(targetDate, targetTime, appSettings, undefined);

      if (availability.isAvailable) {
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
            },
            isStatusUnavailable: false,
          },
        };
        const { output: finalConfirmationOutput } = await scheduleAppointmentPrompt(promptInputForFinalConfirmation);
        aiResponseContent = finalConfirmationOutput?.confirmationMessage || "Lịch hẹn của bạn đã được xác nhận!";

        const appointmentDataCommon = {
          customerId: new mongoose.Types.ObjectId(customerId) as any,
          service: scheduleOutputFromAI.appointmentDetails.service!,
          productId: scheduleOutputFromAI.appointmentDetails.productId,
          date: scheduleOutputFromAI.appointmentDetails.date!,
          time: scheduleOutputFromAI.appointmentDetails.time!,
          branch: scheduleOutputFromAI.appointmentDetails.branch,
          branchId: activeBranches.find(b => b.name === scheduleOutputFromAI.appointmentDetails?.branch)?.id,
          notes: scheduleOutputFromAI.appointmentDetails.notes,
          packageType: scheduleOutputFromAI.appointmentDetails.packageType,
          priority: scheduleOutputFromAI.appointmentDetails.priority,
        };

        if (scheduleOutputFromAI.intent === 'booked') {
          const newAppointmentData = {
            ...appointmentDataCommon,
            status: 'booked' as AppointmentDetails['status'],
          } as any;

          try {
            const savedAppt = await new AppointmentModel(newAppointmentData).save();
            processedAppointmentDB = await AppointmentModel.findById(savedAppt._id).populate('customerId staffId');
            if (processedAppointmentDB && processedAppointmentDB._id) {
              await CustomerModel.findByIdAndUpdate(customerId, { $push: { appointmentIds: processedAppointmentDB._id } });
            } else {
              aiResponseContent = "Đã xảy ra lỗi khi lưu lịch hẹn của bạn. Vui lòng thử lại.";
              processedAppointmentDB = null;
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
                {
                  ...appointmentDataCommon,
                  status: 'booked', // or 'rescheduled' status if preferred
                  updatedAt: new Date()
                },
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
      } else { // Not available
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
        if (scheduleOutputFromAI.intent === 'booked') scheduleOutputFromAI.intent = 'pending_alternatives';
        processedAppointmentDB = null;
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
          aiResponseContent = scheduleOutputFromAI.confirmationMessage; // Use AI's confirmation
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
    let keywordFound = false;
    if (!mediaDataUriForAI) { // Only check keywords if no media file
      const keywordMappings = await getKeywordMappings();
      for (const mapping of keywordMappings) {
        if (mapping.keywords.some(kw => textForAI.toLowerCase().includes(kw.toLowerCase()))) {
          aiResponseContent = mapping.response;
          keywordFound = true;
          break;
        }
      }
    }

    // If no keyword matched and intent is not for clarification, or if it's an error from scheduling AI, try general AI
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
          mediaDataUri: mediaDataUriForAI,
          relevantTrainingData: relevantTrainingData.length > 0 ? relevantTrainingData : undefined,
          products: productsForAI.length > 0 ? productsForAI : undefined,
        });
        aiResponseContent = answerResult.answer;
      } catch (error) {
        console.error('Error answering user question:', error);
        aiResponseContent = "Xin lỗi, tôi đang gặp chút khó khăn để hiểu ý bạn. Bạn có thể hỏi theo cách khác được không?";
      }
    } else if (!keywordFound && scheduleOutputFromAI.intent === 'clarification_needed') {
      // Use the clarification message from the scheduling AI
      aiResponseContent = scheduleOutputFromAI.confirmationMessage;
    } else if (!keywordFound && scheduleOutputFromAI.intent !== 'clarification_needed' && scheduleOutputFromAI.confirmationMessage) {
      // This case might be redundant if general AI is the fallback, but kept for safety
      aiResponseContent = scheduleOutputFromAI.confirmationMessage;
    }
  } else { // Fallback if scheduling AI returns an unexpected intent or no details for booking
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
    name: `${brandNameForAI}`, // Consistent naming for AI/System messages
    customerId: new mongoose.Types.ObjectId(customerId),
  };
  const savedAiMessageDoc = await new MessageModel(aiMessageData).save();
  finalAiMessage = transformMessageDocToMessage(savedAiMessageDoc);

  await CustomerModel.findByIdAndUpdate(customerId, {
    lastInteractionAt: new Date(),
  });

  await ConversationModel.findByIdAndUpdate(currentConversationId, {
    $push: { messageIds: savedAiMessageDoc._id },
    lastMessageTimestamp: savedAiMessageDoc.timestamp,
    lastMessagePreview: savedAiMessageDoc.content.substring(0, 100),
  });

  const newSuggestedReplies: string[] = []; // No more auto-generated replies after first greeting
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

  try {
    const targetDate = dateFnsParseISO(formData.date);
    if (!isValid(targetDate)) {
      return { success: false, message: "Ngày không hợp lệ." };
    }

    const availability = await checkRealAvailability(targetDate, formData.time, appSettings);

    if (availability.isAvailable) {
      const newAppointmentData: Partial<IAppointment> = {
        customerId: new mongoose.Types.ObjectId(formData.customerId) as any,
        service: formData.service,
        productId: formData.productId ? new mongoose.Types.ObjectId(formData.productId) as any : undefined,
        date: formData.date,
        time: formData.time,
        branch: formData.branch,
        branchId: formData.branchId ? new mongoose.Types.ObjectId(formData.branchId) as any : undefined,
        notes: formData.notes,
        status: 'booked',
      };
      const savedAppt = await new AppointmentModel(newAppointmentData).save();
      await CustomerModel.findByIdAndUpdate(formData.customerId, { $push: { appointmentIds: savedAppt._id } });

      const populatedAppointment = await AppointmentModel.findById(savedAppt._id)
        .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
        .populate<{ staffId: IUser }>('staffId', 'name');
      if (!populatedAppointment) throw new Error("Không thể tạo hoặc tìm lại lịch hẹn sau khi lưu.");

      return {
        success: true,
        message: `Lịch hẹn cho dịch vụ "${formData.service}" vào lúc ${formData.time} ngày ${dateFnsFormat(targetDate, 'dd/MM/yyyy')} ${formData.branch ? `tại ${formData.branch}` : ''} đã được đặt thành công.`,
        appointment: transformAppointmentDocToDetails(populatedAppointment),
      };
    } else {
      return {
        success: false,
        message: `Rất tiếc, khung giờ bạn chọn (${formData.time} ngày ${dateFnsFormat(targetDate, 'dd/MM/yyyy')}) không còn trống.`,
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
      { tags: staffSpecificTag } // Customers specifically tagged for this staff
    ];
  } else if (requestingStaffRole === 'admin') {
    // Admins can see all customers by default unless specific admin tags are used for filtering
    if (filterTags && filterTags.some(tag => tag.startsWith('admin:'))) {
      // If admin tags are present, filter by them (e.g., admin inviting another admin)
      query.tags = { $in: filterTags.filter(tag => tag.startsWith('admin:')) };
    }
  }

  // Apply general tags if provided (excluding staff/admin specific tags already handled)
  if (filterTags && filterTags.length > 0) {
    const generalTagsToFilter = filterTags.filter(tag => !tag.startsWith('staff:') && !tag.startsWith('admin:'));
    if (generalTagsToFilter.length > 0) {
      if (query.$or) {
        // If $or already exists, add general tag filtering to each condition within $or
        query.$or = query.$or.map((condition: any) => ({
          $and: [condition, { tags: { $in: generalTagsToFilter } }]
        }));
      } else {
        // If no $or, apply general tags directly, potentially combining with existing query.tags
        if (query.tags && query.tags.$in) {
          query.tags.$in = [...new Set([...query.tags.$in, ...generalTagsToFilter])];
        } else {
          query.tags = { $in: generalTagsToFilter };
        }
      }
    }
  }
  
  // If a staff is assigned to a specific customer via a tag like "staff:staffId",
  // and this staff is not the requestingStaffId, they should not see this customer.
  // This requires a more complex query or post-filtering if not using assignedStaffId directly.
  // For now, the $or condition for staff handles direct assignment or unassignment.
  // If a tag like "staff:otherStaffId" exists, and the current staff is not "otherStaffId",
  // that customer might still appear if they are unassigned. This might need refinement based on exact visibility rules.


  const customerDocs = await CustomerModel.find(query)
    .populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name')
    .sort({ lastMessageTimestamp: -1, lastInteractionAt: -1 })
    .limit(100); // Limit for performance

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
    messagePinningAllowedConversationIds: (doc.messagePinningAllowedConversationIds || []).map(id => id.toString()),
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
  // Only mark as 'read' if current status is 'unread'
  // If staff replies, it will become 'replied_by_staff'
  if (customer && customer.interactionStatus === 'unread') {
    await CustomerModel.findByIdAndUpdate(customerId, { interactionStatus: 'read' });
  }
}


export async function getCustomerDetails(customerId: string): Promise<{ customer: CustomerProfile | null, messages: Message[], appointments: AppointmentDetails[], notes: Note[], conversations: Conversation[] }> {
    await dbConnect();
    const customerDoc = await CustomerModel.findById(customerId)
      .populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name')
      .populate({
          path: 'conversationIds', // Populate to get conversation objects
          model: ConversationModel, // Explicitly state the model for population
          options: { sort: { lastMessageTimestamp: -1 } }
      });

  if (!customerDoc) {
    return { customer: null, messages: [], appointments: [], notes: [], conversations: [] };
  }

  const transformedConversations = (customerDoc.conversationIds || [])
    .map(convDoc => transformConversationDoc(convDoc as unknown as IConversation)) // Ensure convDoc is treated as IConversation
    .filter(Boolean) as Conversation[];

  let messagesForActiveConversation: Message[] = [];
  if (transformedConversations.length > 0) {
    const activeConvId = transformedConversations[0].id; // Assuming the first is the most recent/active
    // We need to fetch messages for this active conversation
    const conversationWithMessageDocs = await ConversationModel.findById(activeConvId)
      .populate({ path: 'messageIds', model: MessageModel, options: { sort: { timestamp: 1 } } });

    if (conversationWithMessageDocs && conversationWithMessageDocs.messageIds) {
      messagesForActiveConversation = (conversationWithMessageDocs.messageIds as unknown as IMessage[]).map(transformMessageDocToMessage);
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
    conversationIds: transformedConversations.map(c => c.id), // Use IDs from transformed conversations
    appointmentIds: (customerDoc.appointmentIds || []).map(id => id.toString()),
    productIds: (customerDoc.productIds || []).map(id => id.toString()),
    noteIds: (customerDoc.noteIds || []).map(id => id.toString()),
    pinnedMessageIds: (customerDoc.pinnedMessageIds || []).map(id => id.toString()),
    messagePinningAllowedConversationIds: (customerDoc.messagePinningAllowedConversationIds || []).map(id => id.toString()),
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
    notes: noteDocs.map(transformNoteDocToNote), // Transform notes
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
  const staffUsers = await UserModel.find({ role: { $in: ['staff', 'admin'] } }, 'name'); // Fetch only name and _id
  return staffUsers.map(user => ({
    id: (user._id as Types.ObjectId).toString(),
    name: user.name || `User ${(user._id as Types.ObjectId).toString().slice(-4)}`
  }));
}


export async function createStaffOrAdminUser(
  name: string,
  phoneNumber: string,
  role: 'staff' | 'admin',
  password?: string // Password becomes optional
): Promise<UserSession | null> {
  await dbConnect();
  if (await UserModel.findOne({ phoneNumber })) {
    throw new Error('Người dùng với số điện thoại này đã tồn tại.');
  }
  const newUser = new UserModel({
    name,
    phoneNumber,
    role,
    password: password, // Will be hashed by pre-save hook if provided
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
  if (data.password) { // Only update password if provided
    user.password = data.password; // Hash will be applied by pre-save hook
  }

  await user.save();
  return transformUserToSession(user);
}

export async function deleteUser(userId: string): Promise<{ success: boolean, message?: string }> {
  await dbConnect();
  const result = await UserModel.findByIdAndDelete(userId);
  if (!result) throw new Error("Không tìm thấy người dùng để xóa.");
  // Unassign this user from customers and appointments
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

  return {
    id: (updatedCustomerDoc._id as Types.ObjectId).toString(),
    phoneNumber: updatedCustomerDoc.phoneNumber,
    name: updatedCustomerDoc.name || `Người dùng ${updatedCustomerDoc.phoneNumber}`,
    internalName: updatedCustomerDoc.internalName,
    conversationIds: (updatedCustomerDoc.conversationIds || []).map(id => id.toString()),
    appointmentIds: (updatedCustomerDoc.appointmentIds || []).map(id => id.toString()),
    productIds: (updatedCustomerDoc.productIds || []).map(id => id.toString()),
    noteIds: (updatedCustomerDoc.noteIds || []).map(id => id.toString()),
    pinnedMessageIds: (updatedCustomerDoc.pinnedMessageIds || []).map(id => id.toString()),
    messagePinningAllowedConversationIds: (updatedCustomerDoc.messagePinningAllowedConversationIds || []).map(id => id.toString()),
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
      lastInteractionAt: new Date(), // Update interaction time
      interactionStatus: 'unread', // Back to unread queue
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
    pinnedMessageIds: (updatedCustomerDoc.pinnedMessageIds || []).map(id => id.toString()),
    messagePinningAllowedConversationIds: (updatedCustomerDoc.messagePinningAllowedConversationIds || []).map(id => id.toString()),
    pinnedConversationIds: (updatedCustomerDoc.pinnedConversationIds || []).map(id => id.toString()),
    tags: updatedCustomerDoc.tags || [],
    assignedStaffId: updatedCustomerDoc.assignedStaffId ? (updatedCustomerDoc.assignedStaffId as any)._id?.toString() : undefined,
    assignedStaffName: undefined, // No staff assigned
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
    pinnedMessageIds: (customer.pinnedMessageIds || []).map(id => id.toString()),
    messagePinningAllowedConversationIds: (customer.messagePinningAllowedConversationIds || []).map(id => id.toString()),
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
    pinnedMessageIds: (customer.pinnedMessageIds || []).map(id => id.toString()),
    messagePinningAllowedConversationIds: (customer.messagePinningAllowedConversationIds || []).map(id => id.toString()),
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
    sender: 'ai', // 'ai' indicates a message from the system/staff side in customer view
    content: messageContent,
    timestamp: new Date(),
    name: staffSession.name || (staffSession.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'),
    customerId: (customer._id as Types.ObjectId),
    userId: new mongoose.Types.ObjectId(staffSession.id) as any,
  };
  const savedStaffMessageDoc = await new MessageModel(staffMessageData).save();
  const savedMessageWithConvId = { ...transformMessageDocToMessage(savedStaffMessageDoc), conversationId };


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
  if (message.sender === 'user' || message.userId?.toString() !== staffSession.id) {
    throw new Error("Bạn không có quyền chỉnh sửa tin nhắn này.");
  }

  message.content = newContent;
  message.updatedAt = new Date();
  await message.save();

  let conversationIdString: string | undefined;
  if (message.customerId) {
      const customerConversations = await ConversationModel.find({ customerId: message.customerId });
      for (const conv of customerConversations) {
          if (conv.messageIds.map(id => id.toString()).includes(message._id.toString())) {
              conversationIdString = conv._id.toString();
              // If this edited message was the last message in the conversation, update the preview
              if(conv.lastMessageTimestamp && conv.lastMessageTimestamp.getTime() === message.timestamp.getTime()){
                 await ConversationModel.findByIdAndUpdate(conv._id, {
                    lastMessagePreview: newContent.substring(0, 100),
                    lastMessageTimestamp: message.updatedAt, // Also update timestamp of last message for sorting
                });
              }
              break;
          }
      }
  }
  
  // If this message was the customer's last message preview, update it
  if (message.customerId) {
      const customer = await CustomerModel.findById(message.customerId);
      if (customer && customer.lastMessageTimestamp && message.updatedAt && customer.lastMessageTimestamp.getTime() === message.timestamp.getTime()) {
         await CustomerModel.findByIdAndUpdate(customer._id, {
            lastMessagePreview: newContent.substring(0, 100),
            lastMessageTimestamp: message.updatedAt,
        });
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
  if (message.sender === 'user' || message.userId?.toString() !== staffSession.id) {
    throw new Error("Bạn không có quyền xóa tin nhắn này.");
  }

  const customerIdString = message.customerId?.toString();
  let conversationIdString: string | undefined = undefined;

  if (customerIdString) {
      const customerConversations = await ConversationModel.find({ customerId: new mongoose.Types.ObjectId(customerIdString) as any });
      for (const conv of customerConversations) {
          if (conv.messageIds.map(id => id.toString()).includes(messageId)) {
              conversationIdString = conv._id.toString();
              // Pull the message from the conversation's messageIds array
              await ConversationModel.findByIdAndUpdate(
                  conversationIdString,
                  { $pull: { messageIds: new mongoose.Types.ObjectId(messageId) as any } }
              );
              // Update last message preview for the conversation if this was the last one
              const updatedConv = await ConversationModel.findById(conversationIdString).populate({
                path: 'messageIds',
                options: { sort: { timestamp: -1 }, limit: 1 } // Get the new last message
              });
              if (updatedConv) {
                  if (updatedConv.messageIds && updatedConv.messageIds.length > 0) {
                      const lastMessageInConv = updatedConv.messageIds[0] as unknown as IMessage; // Already sorted
                      await ConversationModel.findByIdAndUpdate(conversationIdString, {
                          lastMessagePreview: lastMessageInConv.content.substring(0, 100),
                          lastMessageTimestamp: lastMessageInConv.timestamp,
                      });
                  } else { // Conversation is now empty
                      await ConversationModel.findByIdAndUpdate(conversationIdString, {
                          lastMessagePreview: '',
                          lastMessageTimestamp: updatedConv.createdAt, // Or some default timestamp
                      });
                  }
              }
              break;
          }
      }
  }

  await MessageModel.findByIdAndDelete(messageId);

  // Update customer's last message preview if this deleted message affected it
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
      } else { // No conversations left, or only empty ones
        await CustomerModel.findByIdAndUpdate(customerIdString, {
          lastMessagePreview: '',
          lastMessageTimestamp: customer.createdAt, // Reset to customer creation time
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
    messagePinningAllowedConversationIds: (customer.messagePinningAllowedConversationIds || []).map(id => id.toString()),
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
    if (isValid(parsedDate)) {
      query.date = filters.date;
    } else {
      console.warn(`[ACTIONS] Invalid date format received in getAppointments: ${filters.date}`);
    }
  } else if (filters.dates && Array.isArray(filters.dates) && filters.dates.length > 0) {
    const validDates = filters.dates.filter(d => {
      const pd = parse(d, 'yyyy-MM-dd', new Date());
      return isValid(pd);
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
  if (filters.staffId && filters.staffId !== NO_STAFF_MODAL_VALUE) { // Check against placeholder for "no staff"
    query.staffId = new mongoose.Types.ObjectId(filters.staffId) as any;
  }
  if (filters.status && filters.status.length > 0) {
    query.status = { $in: filters.status };
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
  delete updateData.customerId; // Cannot change customerId this way
  delete updateData.userId;

  if (data.staffId && mongoose.Types.ObjectId.isValid(data.staffId) && data.staffId !== NO_STAFF_MODAL_VALUE) {
    (updateData as any).staffId = new mongoose.Types.ObjectId(data.staffId) as any;
  } else if (data.staffId === null || data.staffId === '' || data.staffId === undefined || data.staffId === NO_STAFF_MODAL_VALUE) {
    if (!updateData.$unset) updateData.$unset = {};
    updateData.$unset.staffId = ""; // Correct way to unset
    delete updateData.staffId; // Remove from direct update if trying to set it to placeholder
  }


  const updatedAppointmentDoc = await AppointmentModel.findByIdAndUpdate(
    appointmentId,
    updateData,
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
    return { success: false };
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
export async function addNoteToCustomer(customerId: string, staffId: string, content: string): Promise<Note> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(staffId)) {
    throw new Error("Invalid customer or staff ID.");
  }

  const noteDoc = new NoteModel({
    customerId: new mongoose.Types.ObjectId(customerId) as any,
    staffId: new mongoose.Types.ObjectId(staffId) as any,
    content,
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
    .populate<{ staffId: IUser }>('staffId', 'name')
    .sort({ createdAt: -1 });
  return noteDocs.map(transformNoteDocToNote);
}

export async function updateCustomerNote(noteId: string, staffId: string, content: string): Promise<Note | null> {
  await dbConnect();
  const note = await NoteModel.findById(noteId);
  if (!note) throw new Error("Note not found.");
  const staffUser = await UserModel.findById(staffId);
  if (!staffUser) throw new Error("Staff user not found.");

  // Allow admin to edit any note, staff can only edit their own notes
  if (staffUser.role !== 'admin' && note.staffId.toString() !== staffId) {
    throw new Error("You are not authorized to edit this note.");
  }
  note.content = content;
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
  
  // Allow admin to delete any note, staff can only delete their own notes
  if (staffUser.role !== 'admin' && note.staffId.toString() !== staffId) {
    throw new Error("You are not authorized to delete this note.");
  }
  await NoteModel.findByIdAndDelete(noteId);
  await CustomerModel.findByIdAndUpdate(note.customerId, { $pull: { noteIds: noteId as any } });
  return { success: true };
}

function transformProductDocToProduct(doc: any): ProductItem {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    price: doc.price,
    category: doc.category,
    imageUrl: doc.imageUrl,
    isActive: doc.isActive,
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
  const newProduct = new ProductModel(data);
  const savedProduct = await newProduct.save();
  return transformProductDocToProduct(savedProduct);
}

export async function updateProduct(
  productId: string,
  data: Partial<Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<ProductItem | null> {
  await dbConnect();
  const updatedProduct = await ProductModel.findByIdAndUpdate(
    productId,
    { $set: data },
    { new: true }
  );
  return updatedProduct ? transformProductDocToProduct(updatedProduct) : null;
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
      { assignedStaffId: { $exists: false } } // Also include unassigned customers for staff view
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

export async function pinMessageToConversation(conversationId: string, messageId: string, staffSession: UserSession): Promise<Conversation | null> {
  await dbConnect();
  // For customer view, disallow pinning from UI, only staff/admin can pin
  if (staffSession.role === 'customer') throw new Error("Khách hàng không thể ghim tin nhắn.");
  
  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Mã cuộc trò chuyện hoặc tin nhắn không hợp lệ.");
  }

  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) throw new Error("Không tìm thấy cuộc trò chuyện.");

  const message = await MessageModel.findById(messageId);
  if (!message || !conversation.messageIds.map(id => id.toString()).includes(message._id.toString())) {
    throw new Error("Không tìm thấy tin nhắn hoặc tin nhắn không thuộc về cuộc trò chuyện này.");
  }

  // Check if staff/admin is part of this conversation or is an admin
  const isParticipant = conversation.participants.some(p => p.userId?.toString() === staffSession.id);
  if (!isParticipant && staffSession.role !== 'admin') {
    throw new Error("Bạn không có quyền ghim tin nhắn trong cuộc trò chuyện này.");
  }
  
  if (conversation.pinnedMessageIds && conversation.pinnedMessageIds.length >= 3 && !conversation.pinnedMessageIds.includes(message._id as any)) {
    throw new Error("Chỉ có thể ghim tối đa 3 tin nhắn.");
  }

  if (!conversation.pinnedMessageIds?.includes(message._id as any)) {
    await ConversationModel.findByIdAndUpdate(conversationId, { $addToSet: { pinnedMessageIds: message._id } });
    await MessageModel.findByIdAndUpdate(messageId, { isPinned: true });
  }

  const updatedConversation = await ConversationModel.findById(conversationId).populate({ path: 'messageIds', model: MessageModel, options: { sort: { timestamp: 1 }}});
  return transformConversationDoc(updatedConversation);
}

export async function unpinMessageFromConversation(conversationId: string, messageId: string, staffSession: UserSession): Promise<Conversation | null> {
  await dbConnect();
  if (staffSession.role === 'customer') throw new Error("Khách hàng không thể bỏ ghim tin nhắn.");
  
  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Mã cuộc trò chuyện hoặc tin nhắn không hợp lệ.");
  }

  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) throw new Error("Không tìm thấy cuộc trò chuyện.");

  const isParticipant = conversation.participants.some(p => p.userId?.toString() === staffSession.id);
  if (!isParticipant && staffSession.role !== 'admin') {
    throw new Error("Bạn không có quyền bỏ ghim tin nhắn trong cuộc trò chuyện này.");
  }

  await ConversationModel.findByIdAndUpdate(conversationId, { $pull: { pinnedMessageIds: new mongoose.Types.ObjectId(messageId) as any } });
  await MessageModel.findByIdAndUpdate(messageId, { isPinned: false });

  const updatedConversation = await ConversationModel.findById(conversationId).populate({ path: 'messageIds', model: MessageModel, options: { sort: { timestamp: 1 }}});
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
  // Maintain the original order of messageIds if needed, or sort by timestamp
  const messagesMap = new Map(messageDocs.map(doc => [(doc._id as mongoose.Types.ObjectId).toString(), transformMessageDocToMessage(doc)]));
  // Sort by original order or by timestamp as needed
  // For pinned messages, order might not matter as much as just getting the message content.
  // If order matters, re-sort based on message.timestamp or the original messageIds order.
  return messageIds.map(id => messagesMap.get(id)).filter(Boolean) as Message[];
}


// --- Media History Actions ---
export async function getCustomerMediaMessages(customerId: string): Promise<Message[]> {
  await dbConnect();
  const messages = await MessageModel.find({
    customerId: new mongoose.Types.ObjectId(customerId) as any,
    content: { $regex: /^data:(image|application)\/[^;]+;base64,/ } // Regex to find data URIs for images or common app types
  }).sort({ timestamp: -1 }); // Get newest first

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
  if (!isParticipant) {
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

  if (customer.pinnedConversationIds && customer.pinnedConversationIds.length >= 3 && !customer.pinnedConversationIds.includes(new mongoose.Types.ObjectId(conversationId) as any)) {
    throw new Error("Chỉ có thể ghim tối đa 3 cuộc trò chuyện.");
  }

  const updatedCustomer = await CustomerModel.findByIdAndUpdate(
    userId,
    { $addToSet: { pinnedConversationIds: new mongoose.Types.ObjectId(conversationId) as any } },
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
    pinnedMessageIds: (updatedCustomer.pinnedMessageIds || []).map(id => id.toString()),
    messagePinningAllowedConversationIds: (updatedCustomer.messagePinningAllowedConversationIds || []).map(id => id.toString()),
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
  const updatedCustomer = await CustomerModel.findByIdAndUpdate(
    userId,
    { $pull: { pinnedConversationIds: new mongoose.Types.ObjectId(conversationId) as any } },
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
    pinnedMessageIds: (updatedCustomer.pinnedMessageIds || []).map(id => id.toString()),
    messagePinningAllowedConversationIds: (updatedCustomer.messagePinningAllowedConversationIds || []).map(id => id.toString()),
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
      id: (r as any)._id?.toString() || new mongoose.Types.ObjectId().toString(), // Ensure ID for client-side key
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
  if (processedData.specificDayOverrides) {
    processedData.specificDayOverrides = processedData.specificDayOverrides.map(rule => {
      const { id: ruleId, ...restOfRule } = rule; // Remove client-side id before saving
      return restOfRule as Omit<BranchSpecificDayRule, 'id'>;
    });
  }
  const updatedBranch = await BranchModel.findByIdAndUpdate(id, { $set: processedData }, { new: true, runValidators: true });
  return transformBranchDoc(updatedBranch);
}

export async function deleteBranch(id: string): Promise<{ success: boolean }> {
  await dbConnect();
  // Check if branch is used in any appointments
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
