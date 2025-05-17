
// src/app/actions.ts
'use server';

import type { Message, UserSession, AppointmentDetails, Product, Note, CustomerProfile, UserRole, KeywordMapping, TrainingData, TrainingDataStatus, AppSettings, GetAppointmentsFilters, AdminDashboardStats, StaffDashboardStats, ProductItem, Reminder, ReminderStatus, ReminderPriority, SpecificDayRule, CustomerInteractionStatus, Conversation, AppointmentBookingFormData } from '@/lib/types';
import type { AppointmentRule as LibAppointmentRuleType, Conversation as LibConversationType } from '@/lib/types'; // Aliased for clarity
import { answerUserQuestion } from '@/ai/flows/answer-user-question';
import { generateSuggestedReplies } from '@/ai/flows/generate-suggested-replies';
import { scheduleAppointment as scheduleAppointmentAIFlow, checkRealAvailability } from '@/ai/flows/schedule-appointment'; // Import checkRealAvailability
import type { ScheduleAppointmentOutput, AppointmentRule as AIAppointmentRuleType, AppointmentDetails as AIAppointmentDetails } from '@/ai/schemas/schedule-appointment-schemas'; // Imported AIAppointmentRuleType
import { randomUUID } from 'crypto';
import mongoose, { Types, Document } from 'mongoose';
import dotenv from 'dotenv';
import { startOfDay, endOfDay, subDays, formatISO, parse, isValid, parseISO as dateFnsParseISO, setHours, setMinutes, setSeconds, setMilliseconds, getDay, addMinutes, isBefore, isEqual, format as dateFnsFormat } from 'date-fns';
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
import CustomerModel from '@/models/Customer.model';
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


import type { IUser } from '@/models/User.model';
import type { ICustomer } from '@/models/Customer.model';
import type { IMessage } from '@/models/Message.model';
import type { IAppointment } from '@/models/Appointment.model';
import type { IAppSettings } from '@/models/AppSettings.model';
import type { IKeywordMapping } from '@/models/KeywordMapping.model';
import type { ITrainingData } from '@/models/TrainingData.model';
import type { IAppointmentRule } from '@/models/AppointmentRule.model';
import type { INote } from '@/models/Note.model'; 
import type { IProduct } from '@/models/Product.model';
import type { IReminder } from '@/models/Reminder.model';

function transformConversationDoc(doc: IConversation | null): Conversation | null {
    if (!doc) return null;
    return {
        id: (doc._id as Types.ObjectId).toString(),
        customerId: (doc.customerId as Types.ObjectId).toString(),
        staffId: doc.staffId ? (doc.staffId as Types.ObjectId).toString() : undefined,
        title: doc.title,
        participants: doc.participants.map((p: any) => ({ 
            userId: p.userId?.toString(), 
            role: p.role,
            name: p.name,
            phoneNumber: p.phoneNumber,
        })),
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
  return messages
    .map(msg => {
      let displayContent = msg.content;
      const match = msg.content.match(dataUriRegex);
      if (match) {
        const textAfterFile = match[3]?.trim();
        displayContent = `[Tệp đính kèm] ${textAfterFile || ''}`.trim();
      }
      return `${msg.sender === 'user' ? 'Khách' : 'AI/Nhân viên'}: ${displayContent}`; 
    })
    .join('\n');
}


function transformCustomerToSession(customerDoc: ICustomer, conversationId?: string): UserSession {
    return {
        id: (customerDoc._id as Types.ObjectId).toString(),
        phoneNumber: customerDoc.phoneNumber,
        role: 'customer',
        name: customerDoc.name || `Người dùng ${customerDoc.phoneNumber}`,
        currentConversationId: conversationId,
        pinnedConversationIds: (customerDoc.pinnedConversationIds as Types.ObjectId[] || []).map(id => id.toString()),
        messagePinningAllowedConversationIds: (customerDoc.messagePinningAllowedConversationIds as Types.ObjectId[] || []).map(id => id.toString()),
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
        conversationId: (msgDoc.conversationId as Types.ObjectId)?.toString(),
        name: msgDoc.name, 
        userId: msgDoc.userId?.toString(), 
        isPinned: msgDoc.isPinned,
        updatedAt: msgDoc.updatedAt ? new Date(msgDoc.updatedAt) : undefined,
    };
}

function transformAppointmentDocToDetails(apptDoc: any): AppointmentDetails {
    const customerIdObj = apptDoc.customerId && typeof apptDoc.customerId === 'object' ? apptDoc.customerId : null;
    const staffIdObj = apptDoc.staffId && typeof apptDoc.staffId === 'object' ? apptDoc.staffId : null;

    return {
        appointmentId: (apptDoc._id as Types.ObjectId).toString(),
        userId: typeof apptDoc.customerId === 'string' ? apptDoc.customerId : customerIdObj?._id?.toString(),
        service: apptDoc.service,
        time: apptDoc.time,
        date: apptDoc.date, 
        branch: apptDoc.branch,
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
    const defaultSettings: Partial<AppSettings> = {
        greetingMessage: 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về dịch vụ hoặc đặt lịch hẹn.',
        suggestedQuestions: ['Các dịch vụ của bạn?', 'Đặt lịch hẹn', 'Địa chỉ của bạn ở đâu?'],
        brandName: defaultBrandName,
        footerText: `© ${new Date().getFullYear()} ${defaultBrandName}. Đã đăng ký Bản quyền.`,
        metaTitle: `${defaultBrandName} - Live Chat Thông Minh`,
        metaDescription: 'Live chat tích hợp AI cho giao tiếp khách hàng liền mạch.',
        numberOfStaff: 1,
        defaultServiceDurationMinutes: 60,
        workingHours: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
        weeklyOffDays: [],
        oneTimeOffDates: [],
        specificDayRules: [],
    };

    const specificDayRulesPlain = doc.specificDayRules?.map(rule => {
        const plainRule: SpecificDayRule = {
            id: (rule as any)._id ? (rule as any)._id.toString() : rule.id || new mongoose.Types.ObjectId().toString(), 
            date: rule.date,
            isOff: rule.isOff,
            workingHours: rule.workingHours,
            numberOfStaff: rule.numberOfStaff,
            serviceDurationMinutes: rule.serviceDurationMinutes,
        };
        return plainRule;
    }) || defaultSettings.specificDayRules;


    return {
        id: (doc._id as Types.ObjectId).toString(),
        greetingMessage: doc.greetingMessage || defaultSettings.greetingMessage,
        suggestedQuestions: doc.suggestedQuestions && doc.suggestedQuestions.length > 0 ? doc.suggestedQuestions : defaultSettings.suggestedQuestions!,
        brandName: doc.brandName || defaultSettings.brandName,
        logoUrl: doc.logoUrl,
        logoDataUri: doc.logoDataUri,
        footerText: doc.footerText || defaultSettings.footerText,
        metaTitle: doc.metaTitle || defaultSettings.metaTitle,
        metaDescription: doc.metaDescription || defaultSettings.metaDescription,
        metaKeywords: doc.metaKeywords,
        openGraphImageUrl: doc.openGraphImageUrl,
        robotsTxtContent: doc.robotsTxtContent,
        sitemapXmlContent: doc.sitemapXmlContent,
        numberOfStaff: doc.numberOfStaff ?? defaultSettings.numberOfStaff,
        defaultServiceDurationMinutes: doc.defaultServiceDurationMinutes ?? defaultSettings.defaultServiceDurationMinutes,
        workingHours: doc.workingHours && doc.workingHours.length > 0 ? doc.workingHours : defaultSettings.workingHours!,
        weeklyOffDays: doc.weeklyOffDays || defaultSettings.weeklyOffDays!,
        oneTimeOffDates: doc.oneTimeOffDates || defaultSettings.oneTimeOffDates!,
        specificDayRules: specificDayRulesPlain,
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
        // Remove client-side 'id' before saving to DB, as DB generates its own _id for subdocuments
        processedSettings.specificDayRules = processedSettings.specificDayRules.map(rule => {
            const { id, ...restOfRule } = rule; 
            return restOfRule as any; 
        });
    }

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

    if (!user.conversationIds) { // Ensure conversationIds is initialized
        user.conversationIds = [];
    }
    user.conversationIds.push(savedConversation._id);
    await user.save();

    return transformConversationDoc(savedConversation);
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
  let activeConversation: IConversation | null = null;

  if (!customer) {
    customer = new CustomerModel({
      phoneNumber,
      name: `Người dùng ${phoneNumber}`, 
      lastInteractionAt: new Date(),
      interactionStatus: 'unread',
      lastMessageTimestamp: new Date(),
      conversationIds: [], 
    });
    await customer.save();
  } else {
    if (!customer.conversationIds) {
      customer.conversationIds = [];
      // await customer.save(); // Only save if necessary and if it doesn't cause recursion
    }
  }
  
  if (customer.conversationIds && customer.conversationIds.length > 0) {
    activeConversation = await ConversationModel.findById(customer.conversationIds[customer.conversationIds.length - 1])
                                          .sort({ lastMessageTimestamp: -1 });
  }

  if (!activeConversation) {
    const newConvDoc = await createNewConversationForUser(customer._id.toString());
    if (!newConvDoc || !newConvDoc.id) throw new Error("Không thể tạo cuộc trò chuyện mới.");
    activeConversation = await ConversationModel.findById(newConvDoc.id); 
  }

  if (!activeConversation) {
      throw new Error("Không thể tìm hoặc tạo cuộc trò chuyện cho khách hàng.");
  }

  const userSession = transformCustomerToSession(customer, activeConversation._id.toString());
  
  let initialMessages: Message[] = [];
  if (activeConversation.messageIds && activeConversation.messageIds.length > 0) {
    const messageDocs = await MessageModel.find({ _id: { $in: activeConversation.messageIds } }).sort({ timestamp: 1 }).limit(50);
    initialMessages = messageDocs.map(transformMessageDocToMessage);
  }

  const appSettings = await getAppSettings();
  const brandName = appSettings?.brandName || 'AetherChat';
  const customizableGreetingPart = appSettings?.greetingMessage || 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về dịch vụ hoặc đặt lịch hẹn.';
  const finalGreetingMessage = `Chào mừng bạn đến với ${brandName}! ${customizableGreetingPart}`;
  
  const configuredSuggestedQuestions = (initialMessages.length === 0 && appSettings?.suggestedQuestions) ? appSettings.suggestedQuestions : [];

  const welcomeMessageContent = initialMessages.length === 0
    ? finalGreetingMessage
    : `Chào mừng bạn quay trở lại${userSession.name ? ', ' + userSession.name : ''}! Lịch sử trò chuyện của bạn đã được tải. Tôi có thể hỗ trợ gì cho bạn hôm nay?`;

  if (initialMessages.length === 0) {
    const welcomeMessage: Message = {
      id: `msg_system_${Date.now()}`,
      sender: 'system',
      content: welcomeMessageContent,
      timestamp: new Date(),
      conversationId: activeConversation._id.toString(),
      name: `${brandName} AI`, 
    };
    initialMessages.push(welcomeMessage);
  }

  const allUserConversations = await getUserConversations(customer._id.toString());
  
  return {
    userSession,
    initialMessages,
    initialSuggestedReplies: configuredSuggestedQuestions,
    activeConversationId: activeConversation._id.toString(),
    conversations: allUserConversations,
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
    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation || !conversation.messageIds) {
        return [];
    }
    const messageDocs = await MessageModel.find({ _id: { $in: conversation.messageIds as any[] } }).sort({ timestamp: 1 });
    return messageDocs.map(transformMessageDocToMessage);
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
    await dbConnect();
    const customer = await CustomerModel.findById(userId).populate({
        path: 'conversationIds', // Correct path
        model: ConversationModel, // Explicitly state the model
        options: { sort: { lastMessageTimestamp: -1 } } 
    });
    if (!customer || !customer.conversationIds || customer.conversationIds.length === 0) {
        return []; 
    }
    return (customer.conversationIds as unknown as IConversation[]).map(transformConversationDoc).filter(Boolean) as Conversation[];
}

export async function processUserMessage(
  userMessageContent: string, 
  currentUserSession: UserSession, 
  currentConversationId: string,
  currentChatHistory: Message[] 
): Promise<{ aiMessage: Message; newSuggestedReplies: string[]; updatedAppointment?: AppointmentDetails }> {
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
    customerId: new mongoose.Types.ObjectId(customerId) as any,
    userId: new mongoose.Types.ObjectId(customerId) as any, 
    conversationId: new mongoose.Types.ObjectId(currentConversationId) as any,
  };
  const savedUserMessageDoc = await new MessageModel(userMessageData).save();
  const userMessage = transformMessageDocToMessage(savedUserMessageDoc);

  await CustomerModel.findByIdAndUpdate(customerId, {
    lastInteractionAt: new Date(),
    interactionStatus: currentUserSession.role === 'customer' ? 'unread' : 'replied_by_staff', 
    lastMessagePreview: userMessage.content.substring(0, 100),
    lastMessageTimestamp: userMessage.timestamp,
  });

  await ConversationModel.findByIdAndUpdate(currentConversationId, {
    $push: { messageIds: savedUserMessageDoc._id },
    lastMessageTimestamp: userMessage.timestamp,
    lastMessagePreview: userMessage.content.substring(0, 100),
  });
  
  let updatedChatHistoryWithUserMsg = [...currentChatHistory, userMessage];
  const formattedHistory = formatChatHistoryForAI(updatedChatHistoryWithUserMsg.slice(-10)); 

  let aiResponseContent: string = "";
  let finalAiMessage: Message;
  let processedAppointmentDB: IAppointment | null = null; 
  let scheduleOutputFromAI: ScheduleOutput | null = null;
  const appSettings = await getAppSettings(); 
  if (!appSettings) {
      throw new Error("Không thể tải cài đặt ứng dụng. Không thể xử lý tin nhắn.");
  }
  
  const allProducts = await getAllProducts(); 
  const productsForAI = allProducts.map(p => ({ name: p.name, description: p.description, price: p.price, category: p.category }));


  const customerAppointmentsDocs = await AppointmentModel.find({ 
      customerId: new mongoose.Types.ObjectId(customerId) as any, 
      status: { $nin: ['cancelled', 'completed'] } 
  }).populate('customerId staffId'); 
  
  const customerAppointmentsForAI = customerAppointmentsDocs.map(doc => ({
    ...(transformAppointmentDocToDetails(doc) as AIAppointmentDetails), 
    userId: (doc.customerId as any)._id.toString(), 
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }));
  
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
    mediaDataUri: mediaDataUriForAI, 
  });

  console.log("[ACTIONS] AI scheduleOutput (initial parse):", JSON.stringify(scheduleOutputFromAI, null, 2));
  aiResponseContent = scheduleOutputFromAI.confirmationMessage;

  if (scheduleOutputFromAI.intent === 'booked' || scheduleOutputFromAI.intent === 'rescheduled') {
    if (!scheduleOutputFromAI.appointmentDetails || 
        !scheduleOutputFromAI.appointmentDetails.service || 
        !scheduleOutputFromAI.appointmentDetails.date || 
        !/^\d{4}-\d{2}-\d{2}$/.test(scheduleOutputFromAI.appointmentDetails.date) || 
        !scheduleOutputFromAI.appointmentDetails.time) {
        
        console.error("[ACTIONS] AI 'booked/rescheduled' intent but crucial details missing/invalid from AI. Details:", scheduleOutputFromAI.appointmentDetails);
        aiResponseContent = "Xin lỗi, có lỗi với thông tin lịch hẹn từ AI. Vui lòng thử lại hoặc cung cấp chi tiết hơn (dịch vụ, ngày YYYY-MM-DD, giờ HH:MM).";
        processedAppointmentDB = null; 
    } else {
        const targetDateObj = dateFnsParseISO(scheduleOutputFromAI.appointmentDetails.date);
        const availability = await checkRealAvailability( 
            targetDateObj,
            scheduleOutputFromAI.appointmentDetails.time,
            appSettings
        );


        if (availability.isAvailable) {
            aiResponseContent = scheduleOutputFromAI.confirmationMessage; 
            const appointmentDataCommon = {
                  customerId: new mongoose.Types.ObjectId(customerId) as any,
                  service: scheduleOutputFromAI.appointmentDetails.service!,
                  date: scheduleOutputFromAI.appointmentDetails.date!, 
                  time: scheduleOutputFromAI.appointmentDetails.time!, 
                  branch: scheduleOutputFromAI.appointmentDetails.branch,
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
                            status: 'booked', 
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
        } else { 
            aiResponseContent = scheduleOutputFromAI.confirmationMessage; 
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
                  aiResponseContent = scheduleOutputFromAI.confirmationMessage; 
              } else {
                  aiResponseContent = "Không tìm thấy lịch hẹn bạn muốn hủy hoặc bạn không phải chủ sở hữu.";
                  processedAppointmentDB = null;
              }
          } catch (dbError: any) {
              aiResponseContent = "Đã xảy ra lỗi khi hủy lịch hẹn của bạn. Vui lòng thử lại sau.";
              processedAppointmentDB = null;
          }
      }
  } else if (scheduleOutputFromAI.intent === 'no_action_needed' || scheduleOutputFromAI.intent === 'clarification_needed' || scheduleOutputFromAI.intent === 'error' ) {
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

    if (!keywordFound && scheduleOutputFromAI.intent === 'no_action_needed') {
        try {
            const approvedTrainingDocs = await TrainingDataModel.find({ status: 'approved' }).sort({updatedAt: -1}).limit(5);
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
    } else if (!keywordFound) { 
        aiResponseContent = scheduleOutputFromAI.confirmationMessage; 
    }
  }
  
  const brandNameForAI = appSettings?.brandName || 'AetherChat';

  const aiMessageData: Partial<IMessage> = {
    sender: 'ai', 
    content: aiResponseContent, 
    timestamp: new Date(),
    name: `${brandNameForAI} AI`, 
    customerId: new mongoose.Types.ObjectId(customerId) as any,
    conversationId: new mongoose.Types.ObjectId(currentConversationId) as any,
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


  const newSuggestedReplies: string[] = []; 

  const updatedAppointmentClient = processedAppointmentDB ? transformAppointmentDocToDetails(processedAppointmentDB) : undefined;
  if (updatedAppointmentClient) {
    console.log("[ACTIONS] Returning updated/created appointment to client:", JSON.stringify(updatedAppointmentClient, null, 2));
  }

  return { aiMessage: finalAiMessage, newSuggestedReplies, updatedAppointment: updatedAppointmentClient };
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
        date: formData.date,
        time: formData.time,
        branch: formData.branch,
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
        message: `Lịch hẹn cho dịch vụ "${formData.service}" vào lúc ${formData.time} ngày ${dateFnsFormat(targetDate, 'dd/MM/yyyy')} đã được đặt thành công.`,
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
      id: (doc as any)._id.toString(),
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
  if (customer && customer.interactionStatus === 'unread') {
    await CustomerModel.findByIdAndUpdate(customerId, { interactionStatus: 'read' });
  }
}


export async function getCustomerDetails(customerId: string): Promise<{customer: CustomerProfile | null, messages: Message[], appointments: AppointmentDetails[], notes: Note[], conversations: Conversation[]}> {
    await dbConnect();
    const customerDoc = await CustomerModel.findById(customerId)
      .populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name')
      .populate({ 
        path: 'conversationIds', // Correct path
        model: ConversationModel, // Explicitly state the model
        options: { sort: { lastMessageTimestamp: -1 } }
      }); 

    if (!customerDoc) {
        return { customer: null, messages: [], appointments: [], notes: [], conversations: [] };
    }
    
    const transformedConversations = (customerDoc.conversationIds as unknown as IConversation[] || [])
        .map(transformConversationDoc)
        .filter(Boolean) as Conversation[];
    
    let messagesForActiveConversation: Message[] = [];
    if (transformedConversations.length > 0) {
        const activeConvId = transformedConversations[0].id; 
        const conversationWithMessageDocs = await ConversationModel.findById(activeConvId)
          .populate({ path: 'messageIds', options: { sort: { timestamp: 1 } } });
        
        if (conversationWithMessageDocs && conversationWithMessageDocs.messageIds) {
          messagesForActiveConversation = (conversationWithMessageDocs.messageIds as unknown as IMessage[]).map(transformMessageDocToMessage);
        }
    }


    const appointmentDocs = await AppointmentModel.find({ customerId: customerDoc._id })
      .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
      .populate<{ staffId: IUser }>('staffId', 'name')
      .sort({ date: -1, time: -1 }); 
    
    const noteDocs = await NoteModel.find({ customerId: customerDoc._id })
        .populate<{ staffId: IUser }>('staffId', 'name')
        .sort({ createdAt: -1 });

    const customerProfile: CustomerProfile = {
        id: (customerDoc as any)._id.toString(),
        phoneNumber: customerDoc.phoneNumber,
        name: customerDoc.name || `Người dùng ${customerDoc.phoneNumber}`,
        internalName: customerDoc.internalName,
        conversationIds: transformedConversations.map(c => c.id),
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
        notes: noteDocs.map(transformNoteDocToNote),
        conversations: transformedConversations,
    };
}

export async function getAllUsers(roles: UserRole[] = ['staff', 'admin']): Promise<UserSession[]> {
    await dbConnect();
    const userDocs = await UserModel.find({ role: { $in: roles } });
    return userDocs.map(transformUserToSession);
}

export async function getStaffList(): Promise<{id: string, name: string}[]> {
    await dbConnect();
    const staffUsers = await UserModel.find({ role: { $in: ['staff', 'admin'] } }, 'name');
    return staffUsers.map(user => ({
        id: (user._id as Types.ObjectId).toString(),
        name: user.name || `User ${user._id.toString().slice(-4)}`
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
    password: password || randomUUID(), 
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
    await CustomerModel.updateMany({ assignedStaffId: userId }, { $unset: { assignedStaffId: "" } });
    await AppointmentModel.updateMany({ staffId: userId }, { $unset: { staffId: "" } });
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
  
  return {
        id: (updatedCustomerDoc as any)._id.toString(),
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
      lastInteractionAt: new Date(),
      interactionStatus: 'unread', 
    },
    { new: true }
  );
  if (!updatedCustomerDoc) throw new Error("Không tìm thấy khách hàng.");
   return {
        id: (updatedCustomerDoc as any)._id.toString(),
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
     return {
        id: (customer as any)._id.toString(),
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
        { $pull: { tags: tagToRemove }, lastInteractionAt: new Date() },
        { new: true }
    ).populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');
    if (!customer) throw new Error("Không tìm thấy khách hàng.");
    return {
        id: (customer as any)._id.toString(),
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
    sender: 'ai', 
    content: messageContent, 
    timestamp: new Date(),
    name: staffSession.name || (staffSession.role === 'admin' ? 'Admin' : 'Nhân viên'), 
    customerId: (customer as any)._id,
    userId: new mongoose.Types.ObjectId(staffSession.id) as any, 
    conversationId: conversation._id,
  };
  const savedStaffMessageDoc = await new MessageModel(staffMessageData).save();
  
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
  return transformMessageDocToMessage(savedStaffMessageDoc);
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

  if (message.conversationId) {
    const conversation = await ConversationModel.findById(message.conversationId);
    if (conversation && conversation.messageIds.includes(message._id) && conversation.messageIds[conversation.messageIds.length - 1].toString() === message._id.toString()) {
        await ConversationModel.findByIdAndUpdate(conversation._id, {
            lastMessagePreview: newContent.substring(0, 100),
            lastMessageTimestamp: message.updatedAt,
        });
    }
  }
  
  const customer = await CustomerModel.findById(message.customerId);
  if (customer && customer.lastMessageTimestamp && message.updatedAt && customer.lastMessageTimestamp.getTime() === message.timestamp.getTime() && customer.conversationIds.some(convId => convId.toString() === message.conversationId?.toString())) {
      await CustomerModel.findByIdAndUpdate(customer._id, {
          lastMessagePreview: newContent.substring(0, 100),
          lastMessageTimestamp: message.updatedAt,
      });
  }


  return transformMessageDocToMessage(message);
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
  const conversationIdString = message.conversationId?.toString();

  await MessageModel.findByIdAndDelete(messageId);

  if (conversationIdString) {
      const conversation = await ConversationModel.findByIdAndUpdate(
          conversationIdString,
          { $pull: { messageIds: new mongoose.Types.ObjectId(messageId) as any } },
          { new: true }
      );
      if (conversation && conversation.messageIds.length > 0) {
          const lastMessageInConv = await MessageModel.findById(conversation.messageIds[conversation.messageIds.length -1]).sort({timestamp: -1});
          await ConversationModel.findByIdAndUpdate(conversationIdString, {
              lastMessagePreview: lastMessageInConv ? lastMessageInConv.content.substring(0, 100) : '',
              lastMessageTimestamp: lastMessageInConv ? lastMessageInConv.timestamp : conversation.createdAt,
          });
      } else if (conversation) {
          await ConversationModel.findByIdAndUpdate(conversationIdString, {
              lastMessagePreview: '',
              lastMessageTimestamp: conversation.createdAt,
          });
      }
  }
  
  if (customerIdString) {
    const customer = await CustomerModel.findById(customerIdString);
    if (customer) {
        const conversationsOfCustomer = await ConversationModel.find({ customerId: customer._id }).sort({lastMessageTimestamp: -1}).limit(1);
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
    return {
        id: (customer as any)._id.toString(),
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
  if (filters.staffId) {
    query.staffId = new mongoose.Types.ObjectId(filters.staffId) as any;
  }
  if (filters.status && filters.status.length > 0) {
    query.status = { $in: filters.status };
  }
  
  console.log("[ACTIONS] getAppointments query:", JSON.stringify(query));
  const appointmentDocs = await AppointmentModel.find(query)
    .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
    .populate<{ staffId: IUser }>('staffId', 'name')
    .sort({ date: 1, time: 1 }); 
  
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
    date: data.date, 
    time: data.time, 
    branch: data.branch,
    status: data.status || 'booked', 
    notes: data.notes,
    packageType: data.packageType,
    priority: data.priority,
  };
  if (data.staffId && mongoose.Types.ObjectId.isValid(data.staffId)) {
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
  delete updateData.customerId; 
  delete updateData.userId; 

  if (data.staffId && mongoose.Types.ObjectId.isValid(data.staffId)) {
    (updateData as any).staffId = new mongoose.Types.ObjectId(data.staffId) as any;
  } else if (data.staffId === null || data.staffId === '' || data.staffId === undefined || data.staffId === NO_STAFF_MODAL_VALUE) {
    if (!updateData.$unset) updateData.$unset = {};
    updateData.$unset.staffId = "";
    delete updateData.staffId; 
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
        id: (c as any)._id.toString(),
        name: c.name || `Người dùng ${c.phoneNumber}`,
        phoneNumber: c.phoneNumber
    }));
}

const NO_STAFF_MODAL_VALUE = "__NO_STAFF_ASSIGNED__";

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
            id: (doc as any)._id.toString(),
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
        status: {$nin: ['cancelled', 'completed']}
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
    
    if (staffUser.role !== 'admin' && note.staffId.toString() !== staffId) {
        throw new Error("You are not authorized to delete this note.");
    }
    await NoteModel.findByIdAndDelete(noteId);
    await CustomerModel.findByIdAndUpdate(note.customerId, { $pull: { noteIds: noteId } });
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
      id: (customer as any)._id.toString(),
      name: customer.name || `Người dùng ${customer.phoneNumber}`,
      phoneNumber: customer.phoneNumber,
      internalName: customer.internalName,
      lastInteractionAt: customer.lastInteractionAt,
      tags: customer.tags || [],
      assignedStaffId: customer.assignedStaffId?._id.toString(),
      assignedStaffName: (customer.assignedStaffId as IUser)?.name, 
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
  if (staffSession.role === 'customer') throw new Error("Customers cannot pin messages.");
  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Invalid conversation or message ID.");
  }

  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) throw new Error("Không tìm thấy cuộc trò chuyện.");

  const message = await MessageModel.findById(messageId);
  if (!message || message.conversationId?.toString() !== conversationId) {
    throw new Error("Không tìm thấy tin nhắn hoặc tin nhắn không thuộc về cuộc trò chuyện này.");
  }

  const isParticipant = conversation.participants.some(p => p.userId.toString() === staffSession.id);
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
  
  const updatedConversation = await ConversationModel.findById(conversationId).populate('messageIds');
  return transformConversationDoc(updatedConversation);
}

export async function unpinMessageFromConversation(conversationId: string, messageId: string, staffSession: UserSession): Promise<Conversation | null> {
  await dbConnect();
  if (staffSession.role === 'customer') throw new Error("Customers cannot unpin messages.");
   if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Invalid conversation or message ID.");
  }

  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) throw new Error("Không tìm thấy cuộc trò chuyện.");

  const isParticipant = conversation.participants.some(p => p.userId.toString() === staffSession.id);
  if (!isParticipant && staffSession.role !== 'admin') {
    throw new Error("Bạn không có quyền bỏ ghim tin nhắn trong cuộc trò chuyện này.");
  }

  await ConversationModel.findByIdAndUpdate(conversationId, { $pull: { pinnedMessageIds: new mongoose.Types.ObjectId(messageId) as any } });
  await MessageModel.findByIdAndUpdate(messageId, { isPinned: false });

  const updatedConversation = await ConversationModel.findById(conversationId).populate('messageIds');
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
  const messagesMap = new Map(messageDocs.map(doc => [doc._id.toString(), transformMessageDocToMessage(doc)]));
  return messageIds.map(id => messagesMap.get(id)).filter(Boolean) as Message[];
}


// --- Media History Actions ---
export async function getCustomerMediaMessages(customerId: string): Promise<Message[]> {
  await dbConnect();
  const messages = await MessageModel.find({ 
    customerId: new mongoose.Types.ObjectId(customerId) as any,
    content: { $regex: /^data:(image|application)\/[^;]+;base64,/ } 
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

    const isParticipant = conversation.participants.some(p => p.userId.toString() === userId);
    if (!isParticipant) {
        const user = await UserModel.findById(userId);
        if (!user || user.role !== 'admin') {
            throw new Error("Bạn không có quyền chỉnh sửa tiêu đề cuộc trò chuyện này.");
        }
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
        id: updatedCustomer._id.toString(),
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
        id: updatedCustomer._id.toString(),
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

