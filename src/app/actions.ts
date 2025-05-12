// src/app/actions.ts
'use server';

import type { Message, UserSession, AppointmentDetails, Product, Note, CustomerProfile, UserRole, KeywordMapping, TrainingData, TrainingDataStatus, AppointmentRule, AppSettings, GetAppointmentsFilters, AdminDashboardStats, StaffDashboardStats } from '@/lib/types';
import { answerUserQuestion } from '@/ai/flows/answer-user-question';
import { generateSuggestedReplies } from '@/ai/flows/generate-suggested-replies';
import { scheduleAppointment as scheduleAppointmentAIFlow } from '@/ai/flows/schedule-appointment';
import type { ScheduleAppointmentOutput, AppointmentDetails as AIScheduleAppointmentDetails } from '@/ai/schemas/schedule-appointment-schemas';
import { randomUUID } from 'crypto';
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import { startOfDay, endOfDay, subDays, formatISO } from 'date-fns';


// Ensure dotenv is configured correctly
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: process.cwd() + '/.env.local' }); // Standard Next.js .env.local
} else {
  dotenv.config(); // For production, rely on environment variables set by the hosting provider
}

if (!process.env.MONGODB_URI) {
  console.error("FATAL ERROR: MONGODB_URI is not defined in .env file.");
  // For server components, throwing an error might be better than process.exit
  throw new Error("FATAL ERROR: MONGODB_URI is not defined.");
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
import NoteModel from '@/models/Note.model'; // Import NoteModel

import type { IUser } from '@/models/User.model';
import type { ICustomer } from '@/models/Customer.model';
import type { IMessage } from '@/models/Message.model';
import type { IAppointment } from '@/models/Appointment.model';
import type { IAppSettings } from '@/models/AppSettings.model';
import type { IKeywordMapping } from '@/models/KeywordMapping.model';
import type { ITrainingData } from '@/models/TrainingData.model';
import type { IAppointmentRule } from '@/models/AppointmentRule.model';
import type { INote } from '@/models/Note.model'; // Import INote


function formatChatHistoryForAI(messages: Message[]): string {
  return messages
    .map(msg => `${msg.sender === 'user' ? 'Khách' : 'AI'}: ${msg.content}`)
    .join('\n');
}

function transformCustomerToSession(customerDoc: ICustomer): UserSession {
    return {
        id: customerDoc._id.toString(),
        phoneNumber: customerDoc.phoneNumber,
        role: 'customer',
        name: customerDoc.name || `Khách ${customerDoc.phoneNumber.slice(-4)}`,
    };
}

function transformUserToSession(userDoc: IUser): UserSession {
    return {
        id: userDoc._id.toString(),
        phoneNumber: userDoc.phoneNumber,
        role: userDoc.role,
        name: userDoc.name || `${userDoc.role.charAt(0).toUpperCase() + userDoc.role.slice(1)} User`,
    };
}

function transformMessageDocToMessage(msgDoc: IMessage): Message {
    return {
        id: msgDoc._id.toString(),
        sender: msgDoc.sender as 'user' | 'ai' | 'system',
        content: msgDoc.content,
        timestamp: new Date(msgDoc.timestamp),
        name: msgDoc.name,
    };
}

function transformAppointmentDocToDetails(apptDoc: IAppointment): AppointmentDetails {
    let customerName: string | undefined = undefined;
    let customerPhoneNumber: string | undefined = undefined;
    if (apptDoc.customerId && typeof apptDoc.customerId === 'object' && 'name' in apptDoc.customerId && 'phoneNumber' in apptDoc.customerId) {
        customerName = (apptDoc.customerId as ICustomer).name;
        customerPhoneNumber = (apptDoc.customerId as ICustomer).phoneNumber;
    }

    let staffName: string | undefined = undefined;
    if (apptDoc.staffId && typeof apptDoc.staffId === 'object' && 'name' in apptDoc.staffId) {
        staffName = (apptDoc.staffId as IUser).name;
    }

    return {
        appointmentId: apptDoc._id.toString(),
        userId: typeof apptDoc.customerId === 'string' ? apptDoc.customerId : (apptDoc.customerId as any)?._id?.toString(),
        service: apptDoc.service,
        time: apptDoc.time,
        date: apptDoc.date, 
        branch: apptDoc.branch,
        status: apptDoc.status as AppointmentDetails['status'],
        notes: apptDoc.notes,
        createdAt: new Date(apptDoc.createdAt as Date),
        updatedAt: new Date(apptDoc.updatedAt as Date),
        staffId: typeof apptDoc.staffId === 'string' ? apptDoc.staffId : (apptDoc.staffId as any)?._id?.toString(),
        customerName,
        customerPhoneNumber,
        staffName,
        packageType: apptDoc.packageType,
        priority: apptDoc.priority,
    };
}

function transformKeywordMappingDoc(doc: IKeywordMapping): KeywordMapping {
    return {
        id: doc._id.toString(),
        keywords: doc.keywords,
        response: doc.response,
        createdAt: new Date(doc.createdAt as Date),
        updatedAt: new Date(doc.updatedAt as Date),
    };
}

function transformTrainingDataDoc(doc: ITrainingData): TrainingData {
    return {
        id: doc._id.toString(),
        userInput: doc.userInput,
        idealResponse: doc.idealResponse,
        label: doc.label,
        status: doc.status as TrainingDataStatus,
        createdAt: new Date(doc.createdAt as Date),
        updatedAt: new Date(doc.updatedAt as Date),
    };
}

function transformAppointmentRuleDoc(doc: IAppointmentRule): AppointmentRule {
    return {
        id: doc._id.toString(),
        name: doc.name,
        keywords: doc.keywords,
        conditions: doc.conditions,
        aiPromptInstructions: doc.aiPromptInstructions,
        createdAt: new Date(doc.createdAt as Date),
        updatedAt: new Date(doc.updatedAt as Date),
    };
}

function transformNoteDocToNote(noteDoc: INote): Note {
    return {
        id: noteDoc._id.toString(),
        customerId: noteDoc.customerId.toString(),
        staffId: noteDoc.staffId.toString(),
        staffName: (noteDoc.staffId as unknown as IUser)?.name, // Populated field
        content: noteDoc.content,
        createdAt: new Date(noteDoc.createdAt as Date),
        updatedAt: new Date(noteDoc.updatedAt as Date),
    };
}


function transformAppSettingsDoc(doc: IAppSettings | null): AppSettings | null {
    if (!doc) return null;
    const defaultBrandName = 'AetherChat';
    return {
        id: doc._id.toString(),
        greetingMessage: doc.greetingMessage || 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về dịch vụ hoặc đặt lịch hẹn.',
        suggestedQuestions: doc.suggestedQuestions && doc.suggestedQuestions.length > 0 ? doc.suggestedQuestions : ['Các dịch vụ của bạn?', 'Đặt lịch hẹn', 'Địa chỉ của bạn ở đâu?'],
        brandName: doc.brandName || defaultBrandName,
        logoUrl: doc.logoUrl,
        footerText: doc.footerText || `© ${new Date().getFullYear()} ${doc.brandName || defaultBrandName}. Đã đăng ký Bản quyền.`,
        metaTitle: doc.metaTitle || `${doc.brandName || defaultBrandName} - Live Chat Thông Minh`,
        metaDescription: doc.metaDescription || 'Live chat tích hợp AI cho giao tiếp khách hàng liền mạch.',
        metaKeywords: doc.metaKeywords,
        openGraphImageUrl: doc.openGraphImageUrl,
        robotsTxtContent: doc.robotsTxtContent,
        sitemapXmlContent: doc.sitemapXmlContent,
        updatedAt: new Date(doc.updatedAt as Date),
    };
}


export async function getAppSettings(): Promise<AppSettings | null> {
    await dbConnect();
    const settingsDoc = await AppSettingsModel.findOne({});
    return transformAppSettingsDoc(settingsDoc);
}

export async function updateAppSettings(settings: Partial<Omit<AppSettings, 'id' | 'updatedAt'>>): Promise<AppSettings | null> {
    await dbConnect();
    const updatedSettingsDoc = await AppSettingsModel.findOneAndUpdate({}, { $set: settings }, { new: true, upsert: true });
    return transformAppSettingsDoc(updatedSettingsDoc);
}


export async function handleCustomerAccess(phoneNumber: string): Promise<{
  userSession: UserSession;
  initialMessages: Message[];
  initialSuggestedReplies: string[];
}> {
  await dbConnect();
  let customer = await CustomerModel.findOne({ phoneNumber });
  let userSession: UserSession;
  let initialMessages: Message[] = [];

  if (customer) {
    userSession = transformCustomerToSession(customer);
    const messageDocs = await MessageModel.find({ customerId: customer._id }).sort({ timestamp: 1 }).limit(50);
    initialMessages = messageDocs.map(transformMessageDocToMessage);
  } else {
    const newCustomerDoc = new CustomerModel({
      phoneNumber,
      name: `Khách ${phoneNumber.slice(-4)}`, 
      lastInteractionAt: new Date(),
    });
    customer = await newCustomerDoc.save();
    userSession = transformCustomerToSession(customer);
  }

  const appSettings = await getAppSettings();
  const brandName = appSettings?.brandName || 'AetherChat';
  const customizableGreetingPart = appSettings?.greetingMessage || 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về dịch vụ hoặc đặt lịch hẹn.';
  const finalGreetingMessage = `Chào mừng bạn đến với ${brandName}! ${customizableGreetingPart}`;
  
  let defaultSuggestedReplies = appSettings?.suggestedQuestions || ['Các dịch vụ của bạn?', 'Đặt lịch hẹn', 'Địa chỉ của bạn ở đâu?'];


  const welcomeMessageContent = initialMessages.length === 0
    ? finalGreetingMessage
    : `Chào mừng bạn quay trở lại${userSession.name ? ', ' + userSession.name : ''}! Lịch sử trò chuyện của bạn đã được tải. Tôi có thể hỗ trợ gì cho bạn hôm nay?`;

  const welcomeMessage: Message = {
    id: `msg_system_${Date.now()}`,
    sender: 'system',
    content: welcomeMessageContent,
    timestamp: new Date(),
  };
  
  initialMessages.push(welcomeMessage);

  let suggestedReplies: string[] = [];
  try {
    const repliesResult = await generateSuggestedReplies({ latestMessage: welcomeMessageContent });
    suggestedReplies = repliesResult.suggestedReplies;
  } catch (error) {
    console.error('Error generating initial suggested replies:', error);
    suggestedReplies = defaultSuggestedReplies;
  }
  
  return {
    userSession,
    initialMessages,
    initialSuggestedReplies: suggestedReplies,
  };
}


export async function registerUser(name: string, phoneNumber: string, password: string, role: UserRole): Promise<UserSession | null> {
  if (role === 'customer') throw new Error("Việc đăng ký khách hàng được xử lý theo cách khác.");
  await dbConnect();

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


export async function processUserMessage(
  userMessageContent: string,
  currentUserSession: UserSession, 
  currentChatHistory: Message[] 
): Promise<{ aiMessage: Message; newSuggestedReplies: string[]; updatedAppointment?: AppointmentDetails }> {
  await dbConnect();

  const customerId = currentUserSession.id; 

  const userMessageData: Partial<IMessage> = {
    sender: 'user',
    content: userMessageContent,
    timestamp: new Date(),
    name: currentUserSession.name || 'Khách',
    customerId: new mongoose.Types.ObjectId(customerId), 
  };
  const savedUserMessageDoc = await new MessageModel(userMessageData).save();
  const userMessage = transformMessageDocToMessage(savedUserMessageDoc);

  await CustomerModel.findByIdAndUpdate(customerId, {
    $push: { chatHistoryIds: savedUserMessageDoc._id },
    lastInteractionAt: new Date(),
  });
  
  let updatedChatHistoryWithUserMsg = [...currentChatHistory, userMessage];
  const formattedHistory = formatChatHistoryForAI(updatedChatHistoryWithUserMsg.slice(-10));

  let aiResponseContent: string = "";
  let finalAiMessage: Message;
  let processedAppointmentDB: IAppointment | null = null; 
  let scheduleOutput: ScheduleAppointmentOutput | null = null;

  const schedulingKeywords = ['book', 'schedule', 'appointment', 'meeting', 'reserve', 'đặt lịch', 'hẹn', 'cancel', 'hủy', 'reschedule', 'đổi lịch', 'dời lịch'];
  const lowerCaseUserMessage = userMessageContent.toLowerCase();
  const hasSchedulingIntent = schedulingKeywords.some(keyword => lowerCaseUserMessage.includes(keyword));

  if (hasSchedulingIntent) {
    console.log(`[ACTIONS] User '${currentUserSession.phoneNumber}' has scheduling intent for: "${userMessageContent}"`);
    try {
      const customerAppointmentsDocs = await AppointmentModel.find({ 
          customerId: new mongoose.Types.ObjectId(customerId), 
          status: { $nin: ['cancelled', 'completed'] } 
      }).populate('customerId staffId'); 
      
      const customerAppointmentsForAI = customerAppointmentsDocs.map(doc => ({
        ...transformAppointmentDocToDetails(doc),
        userId: doc.customerId._id.toString(), 
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      }));
      
      scheduleOutput = await scheduleAppointmentAIFlow({
        userInput: userMessageContent,
        phoneNumber: currentUserSession.phoneNumber,
        userId: customerId, 
        existingAppointments: customerAppointmentsForAI,
        currentDateTime: new Date().toISOString(),
      });

      console.log("[ACTIONS] AI scheduleOutput RAW:", JSON.stringify(scheduleOutput, null, 2));
      
      aiResponseContent = scheduleOutput.confirmationMessage; 

      if (scheduleOutput.intent === 'booked') {
        if (!scheduleOutput.appointmentDetails || 
            !scheduleOutput.appointmentDetails.service || 
            !scheduleOutput.appointmentDetails.date || 
            !/^\d{4}-\d{2}-\d{2}$/.test(scheduleOutput.appointmentDetails.date) || 
            !scheduleOutput.appointmentDetails.time) {
            
            console.error("[ACTIONS] CRITICAL: AI 'booked' intent but appointmentDetails missing/invalid. Details:", scheduleOutput.appointmentDetails);
            aiResponseContent = "Xin lỗi, có lỗi với thông tin lịch hẹn từ AI. Không thể đặt lịch. Vui lòng thử lại hoặc cung cấp chi tiết hơn (dịch vụ, ngày YYYY-MM-DD, giờ).";
            processedAppointmentDB = null; 
        } else {
            const newAppointmentData: Omit<IAppointment, '_id' | 'createdAt' | 'updatedAt'> = {
              customerId: new mongoose.Types.ObjectId(customerId),
              service: scheduleOutput.appointmentDetails.service!,
              date: scheduleOutput.appointmentDetails.date!, 
              time: scheduleOutput.appointmentDetails.time!, 
              branch: scheduleOutput.appointmentDetails.branch,
              status: 'booked', 
              notes: scheduleOutput.appointmentDetails.notes,
              packageType: scheduleOutput.appointmentDetails.packageType,
              priority: scheduleOutput.appointmentDetails.priority,
            };
            console.log("[ACTIONS] Data prepared for DB (booked):", JSON.stringify(newAppointmentData, null, 2));
            try {
                const savedAppt = await new AppointmentModel(newAppointmentData).save();
                processedAppointmentDB = await AppointmentModel.findById(savedAppt._id).populate('customerId staffId');
                if (processedAppointmentDB && processedAppointmentDB._id) {
                    await CustomerModel.findByIdAndUpdate(customerId, { $push: { appointmentIds: processedAppointmentDB._id } });
                    aiResponseContent = scheduleOutput.confirmationMessage + ` (Mã lịch hẹn: ${processedAppointmentDB._id.toString().slice(-6)})`;
                    console.log(`[ACTIONS] Successfully created appointment ${processedAppointmentDB._id.toString()} for customer ${customerId}`);
                } else {
                    console.error("[ACTIONS] FAILED to save new appointment or _id is missing after save call.");
                    aiResponseContent = "Đã xảy ra lỗi khi lưu lịch hẹn của bạn vào cơ sở dữ liệu. Vui lòng thử lại.";
                    processedAppointmentDB = null;
                }
            } catch (dbError: any) {
                console.error("[ACTIONS] DATABASE ERROR while saving new appointment:", dbError.message, dbError.stack);
                aiResponseContent = "Đã xảy ra lỗi nghiêm trọng khi lưu lịch hẹn của bạn. Chúng tôi đã ghi nhận sự cố. Vui lòng thử lại sau.";
                processedAppointmentDB = null;
            }
        }
      } else if (scheduleOutput.intent === 'rescheduled') {
          if (!scheduleOutput.originalAppointmentIdToModify || 
              !scheduleOutput.appointmentDetails ||
              !scheduleOutput.appointmentDetails.service || 
              !scheduleOutput.appointmentDetails.date || 
              !/^\d{4}-\d{2}-\d{2}$/.test(scheduleOutput.appointmentDetails.date) || 
              !scheduleOutput.appointmentDetails.time) {
              
              console.error("[ACTIONS] CRITICAL: AI 'rescheduled' intent but originalAppointmentId or new appointmentDetails missing/invalid. Details:", scheduleOutput);
              aiResponseContent = "Xin lỗi, thông tin để đổi lịch hẹn không đầy đủ hoặc không hợp lệ từ AI. Vui lòng thử lại.";
              processedAppointmentDB = null;
          } else {
              try {
                  processedAppointmentDB = await AppointmentModel.findOneAndUpdate(
                      { _id: new mongoose.Types.ObjectId(scheduleOutput.originalAppointmentIdToModify), customerId: new mongoose.Types.ObjectId(customerId) },
                      { 
                        service: scheduleOutput.appointmentDetails.service!,
                        date: scheduleOutput.appointmentDetails.date!,
                        time: scheduleOutput.appointmentDetails.time!,
                        branch: scheduleOutput.appointmentDetails.branch,
                        status: 'booked', 
                        notes: scheduleOutput.appointmentDetails.notes,
                        packageType: scheduleOutput.appointmentDetails.packageType,
                        priority: scheduleOutput.appointmentDetails.priority,
                        updatedAt: new Date() 
                      },
                      { new: true }
                  ).populate('customerId staffId');
                  
                  if (processedAppointmentDB && processedAppointmentDB._id) {
                      aiResponseContent = scheduleOutput.confirmationMessage + ` (Mã lịch hẹn mới: ${processedAppointmentDB._id.toString().slice(-6)})`;
                      console.log(`[ACTIONS] Successfully rescheduled appointment ${processedAppointmentDB._id.toString()}`);
                  } else { 
                      console.warn("[ACTIONS] Original appointment for reschedule not found or not owned by customer.");
                      aiResponseContent = `Không tìm thấy lịch hẹn gốc để đổi. ${scheduleOutput.confirmationMessage.replace(/^OK! /, '')}`; 
                      processedAppointmentDB = null;
                  }
              } catch (dbError: any) {
                  console.error("[ACTIONS] DATABASE ERROR while rescheduling appointment:", dbError.message, dbError.stack);
                  aiResponseContent = "Đã xảy ra lỗi khi đổi lịch hẹn của bạn. Vui lòng thử lại sau.";
                  processedAppointmentDB = null;
              }
          }
      } else if (scheduleOutput.intent === 'cancelled') {
          if (!scheduleOutput.originalAppointmentIdToModify) {
              console.error("[ACTIONS] CRITICAL: AI 'cancelled' intent but originalAppointmentIdToModify missing. Details:", scheduleOutput);
              aiResponseContent = "Xin lỗi, tôi không xác định được lịch hẹn nào bạn muốn hủy. Vui lòng cung cấp thêm chi tiết.";
              processedAppointmentDB = null;
          } else {
              try {
                  processedAppointmentDB = await AppointmentModel.findOneAndUpdate(
                    { _id: new mongoose.Types.ObjectId(scheduleOutput.originalAppointmentIdToModify), customerId: new mongoose.Types.ObjectId(customerId) },
                    { status: 'cancelled', updatedAt: new Date() },
                    { new: true }
                  ).populate('customerId staffId');

                  if (processedAppointmentDB) {
                      aiResponseContent = scheduleOutput.confirmationMessage;
                      console.log(`[ACTIONS] Successfully cancelled appointment ${processedAppointmentDB._id.toString()}`);
                  } else {
                      aiResponseContent = "Không tìm thấy lịch hẹn bạn muốn hủy hoặc bạn không phải chủ sở hữu của lịch hẹn đó.";
                      processedAppointmentDB = null;
                  }
              } catch (dbError: any) {
                  console.error("[ACTIONS] DATABASE ERROR while cancelling appointment:", dbError.message, dbError.stack);
                  aiResponseContent = "Đã xảy ra lỗi khi hủy lịch hẹn của bạn. Vui lòng thử lại sau.";
                  processedAppointmentDB = null;
              }
          }
      }
      
    } catch (error) { 
      console.error('[ACTIONS] Error calling scheduleAppointmentAIFlow:', error);
      aiResponseContent = "Tôi gặp sự cố với yêu cầu đặt lịch của bạn. Bạn có thể thử diễn đạt lại hoặc cung cấp thêm chi tiết được không?";
      scheduleOutput = { intent: 'error', confirmationMessage: aiResponseContent, requiresAssistance: true };
      processedAppointmentDB = null; 
    }
  } else { 
    let keywordFound = false;
    const keywordMappings = await getKeywordMappings();
    for (const mapping of keywordMappings) {
      if (mapping.keywords.some(kw => lowerCaseUserMessage.includes(kw.toLowerCase()))) {
        aiResponseContent = mapping.response;
        keywordFound = true;
        break;
      }
    }

    if (!keywordFound) {
      try {
        const answerResult = await answerUserQuestion({
          question: userMessageContent,
          chatHistory: formattedHistory,
        });
        aiResponseContent = answerResult.answer;
      } catch (error) {
        console.error('Error answering user question:', error);
        aiResponseContent = "Tôi đang gặp chút khó khăn để hiểu ý bạn. Bạn có thể hỏi theo cách khác được không?";
      }
    }
  }
  
  const appSettings = await getAppSettings(); 
  const brandNameForAI = appSettings?.brandName || 'AetherChat';


  const aiMessageData: Partial<IMessage> = {
    sender: 'ai',
    content: aiResponseContent, 
    timestamp: new Date(),
    name: `${brandNameForAI} AI`,
    customerId: new mongoose.Types.ObjectId(customerId),
  };
  const savedAiMessageDoc = await new MessageModel(aiMessageData).save();
  finalAiMessage = transformMessageDocToMessage(savedAiMessageDoc);

  await CustomerModel.findByIdAndUpdate(customerId, {
    $push: { chatHistoryIds: savedAiMessageDoc._id },
    lastInteractionAt: new Date(),
  });

  let newSuggestedReplies: string[] = [];
  const defaultSuggestedReplies = appSettings?.suggestedQuestions || [];

  try {
    let contextForReplies = aiResponseContent; 
    if (scheduleOutput?.intent === 'pending_alternatives' && scheduleOutput.suggestedSlots?.length) {
        contextForReplies = `AI: ${aiResponseContent} Bạn có thể chọn một trong các gợi ý sau: ${scheduleOutput.suggestedSlots.map(s => `${scheduleOutput.appointmentDetails?.service || 'dịch vụ'} vào ${s.date} lúc ${s.time}${s.branch ? ' tại ' + s.branch : ''}`).join(', ')}. Hoặc hỏi các lựa chọn khác.`;
    } else if (scheduleOutput?.intent === 'clarification_needed' && scheduleOutput.missingInformation) {
        contextForReplies = `AI: ${aiResponseContent} Vui lòng cung cấp: ${scheduleOutput.missingInformation}.`;
    }

    const repliesResult = await generateSuggestedReplies({ latestMessage: contextForReplies });
    newSuggestedReplies = repliesResult.suggestedReplies;

    if (scheduleOutput?.intent === 'pending_alternatives' && scheduleOutput.suggestedSlots) {
        const slotSuggestions = scheduleOutput.suggestedSlots.slice(0, 2).map(slot => 
            `Chọn ${scheduleOutput.appointmentDetails?.service || 'dịch vụ'} ${slot.date} ${slot.time}${slot.branch ? ' ('+slot.branch+')' : ''}`
        );
        newSuggestedReplies = [...new Set([...slotSuggestions, ...newSuggestedReplies])].slice(0,3); 
    } else if (scheduleOutput?.intent === 'clarification_needed' && scheduleOutput.missingInformation) {
        newSuggestedReplies.unshift(`Cung cấp ${scheduleOutput.missingInformation}`);
        newSuggestedReplies = [...new Set(newSuggestedReplies)].slice(0,3);
    }

  } catch (error) {
    console.error('Error generating new suggested replies:', error);
    newSuggestedReplies = (hasSchedulingIntent && scheduleOutput?.intent !== 'booked' && scheduleOutput?.intent !== 'cancelled' && scheduleOutput?.intent !== 'no_action_needed')
      ? ['Xác nhận giờ gợi ý', 'Hỏi giờ khác', 'Hủy yêu cầu'] 
      : defaultSuggestedReplies.length > 0 ? defaultSuggestedReplies : ['Kể thêm cho tôi', 'Hỏi câu khác', 'Cảm ơn!'];
  }
  newSuggestedReplies = [...new Set(newSuggestedReplies)].slice(0, 3); 
  if (newSuggestedReplies.length === 0 && defaultSuggestedReplies.length > 0) {
    newSuggestedReplies = defaultSuggestedReplies.slice(0,3);
  }


  const updatedAppointmentClient = processedAppointmentDB ? transformAppointmentDocToDetails(processedAppointmentDB) : undefined;
  if (updatedAppointmentClient) {
    console.log("[ACTIONS] Returning updated/created appointment to client:", JSON.stringify(updatedAppointmentClient, null, 2));
  }

  return { aiMessage: finalAiMessage, newSuggestedReplies, updatedAppointment: updatedAppointmentClient };
}


// --- Functions for Admin/Staff ---
export async function getCustomersForStaffView(staffId?: string): Promise<CustomerProfile[]> {
    await dbConnect();
    const query: any = {};
    if (staffId) {
      // Staff see their own assigned customers OR unassigned customers
      query.$or = [
        { assignedStaffId: new mongoose.Types.ObjectId(staffId) },
        { assignedStaffId: { $exists: false } } 
      ];
    }
    // If no staffId (e.g. admin view or generic call), show all.
    // For specific "unassigned" queue, one would explicitly query for { assignedStaffId: { $exists: false } }

    const customerDocs = await CustomerModel.find(query)
        .populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name')
        .sort({ lastInteractionAt: -1 })
        .limit(50); 
    
    return customerDocs.map(doc => ({
        id: doc._id.toString(),
        phoneNumber: doc.phoneNumber,
        name: doc.name,
        internalName: doc.internalName,
        chatHistoryIds: doc.chatHistoryIds.map(id => id.toString()),
        appointmentIds: doc.appointmentIds.map(id => id.toString()),
        productIds: doc.productIds.map(id => id.toString()),
        noteIds: doc.noteIds.map(id => id.toString()),
        tags: doc.tags,
        assignedStaffId: doc.assignedStaffId?._id?.toString(),
        assignedStaffName: (doc.assignedStaffId as IUser)?.name,
        lastInteractionAt: new Date(doc.lastInteractionAt),
        createdAt: new Date(doc.createdAt as Date),
    }));
}

export async function getCustomerDetails(customerId: string): Promise<{customer: CustomerProfile | null, messages: Message[], appointments: AppointmentDetails[], notes: Note[]}> {
    await dbConnect();
    const customerDoc = await CustomerModel.findById(customerId)
      .populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');

    if (!customerDoc) {
        return { customer: null, messages: [], appointments: [], notes: [] };
    }

    const messageDocs = await MessageModel.find({ customerId: customerDoc._id }).sort({ timestamp: 1 });
    const appointmentDocs = await AppointmentModel.find({ customerId: customerDoc._id })
      .populate<{ customerId: ICustomer }>('customerId', 'name phoneNumber')
      .populate<{ staffId: IUser }>('staffId', 'name')
      .sort({ date: -1, time: -1 }); 
    
    const noteDocs = await NoteModel.find({ customerId: customerDoc._id })
        .populate<{ staffId: IUser }>('staffId', 'name')
        .sort({ createdAt: -1 });

    const customerProfile: CustomerProfile = {
        id: customerDoc._id.toString(),
        phoneNumber: customerDoc.phoneNumber,
        name: customerDoc.name,
        internalName: customerDoc.internalName,
        chatHistoryIds: customerDoc.chatHistoryIds.map(id => id.toString()),
        appointmentIds: customerDoc.appointmentIds.map(id => id.toString()),
        productIds: customerDoc.productIds.map(id => id.toString()),
        noteIds: customerDoc.noteIds.map(id => id.toString()),
        tags: customerDoc.tags, 
        assignedStaffId: customerDoc.assignedStaffId?._id?.toString(),
        assignedStaffName: (customerDoc.assignedStaffId as IUser)?.name,
        lastInteractionAt: new Date(customerDoc.lastInteractionAt),
        createdAt: new Date(customerDoc.createdAt as Date),
    };
    
    return { 
        customer: customerProfile, 
        messages: messageDocs.map(transformMessageDocToMessage), 
        appointments: appointmentDocs.map(transformAppointmentDocToDetails),
        notes: noteDocs.map(transformNoteDocToNote)
    };
}

export async function getAllUsers(): Promise<UserSession[]> {
    await dbConnect();
    const userDocs = await UserModel.find({ role: { $in: ['staff', 'admin'] } });
    return userDocs.map(transformUserToSession);
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
  const updatedCustomer = await CustomerModel.findByIdAndUpdate(
    customerId,
    { assignedStaffId: new mongoose.Types.ObjectId(staffId), lastInteractionAt: new Date() },
    { new: true }
  ).populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');
  if (!updatedCustomer) throw new Error("Không tìm thấy khách hàng.");
  return {
        id: updatedCustomer._id.toString(),
        phoneNumber: updatedCustomer.phoneNumber,
        name: updatedCustomer.name,
        internalName: updatedCustomer.internalName,
        chatHistoryIds: updatedCustomer.chatHistoryIds.map(id => id.toString()),
        appointmentIds: updatedCustomer.appointmentIds.map(id => id.toString()),
        productIds: updatedCustomer.productIds.map(id => id.toString()),
        noteIds: updatedCustomer.noteIds.map(id => id.toString()),
        tags: updatedCustomer.tags,
        assignedStaffId: updatedCustomer.assignedStaffId?._id?.toString(),
        assignedStaffName: (updatedCustomer.assignedStaffId as IUser)?.name,
        lastInteractionAt: new Date(updatedCustomer.lastInteractionAt),
        createdAt: new Date(updatedCustomer.createdAt as Date),
  };
}

export async function unassignStaffFromCustomer(customerId: string): Promise<CustomerProfile | null> {
  await dbConnect();
  const updatedCustomer = await CustomerModel.findByIdAndUpdate(
    customerId,
    { $unset: { assignedStaffId: "" }, lastInteractionAt: new Date() },
    { new: true }
  );
  if (!updatedCustomer) throw new Error("Không tìm thấy khách hàng.");
   return {
        id: updatedCustomer._id.toString(),
        phoneNumber: updatedCustomer.phoneNumber,
        name: updatedCustomer.name,
        internalName: updatedCustomer.internalName,
        chatHistoryIds: updatedCustomer.chatHistoryIds.map(id => id.toString()),
        appointmentIds: updatedCustomer.appointmentIds.map(id => id.toString()),
        productIds: updatedCustomer.productIds.map(id => id.toString()),
        noteIds: updatedCustomer.noteIds.map(id => id.toString()),
        tags: updatedCustomer.tags,
        assignedStaffId: updatedCustomer.assignedStaffId?._id?.toString(),
        assignedStaffName: undefined, // explicitly unassigned
        lastInteractionAt: new Date(updatedCustomer.lastInteractionAt),
        createdAt: new Date(updatedCustomer.createdAt as Date),
  };
}

export async function addTagToCustomer(customerId: string, tag: string): Promise<CustomerProfile | null> {
    await dbConnect();
    const customer = await CustomerModel.findById(customerId).populate<{ assignedStaffId: IUser }>('assignedStaffId', 'name');
    if (!customer) throw new Error("Không tìm thấy khách hàng.");

    if (!customer.tags.includes(tag)) {
        customer.tags.push(tag);
        customer.lastInteractionAt = new Date();
        await customer.save();
    }
     return {
        id: customer._id.toString(),
        phoneNumber: customer.phoneNumber,
        name: customer.name,
        internalName: customer.internalName,
        chatHistoryIds: customer.chatHistoryIds.map(id => id.toString()),
        appointmentIds: customer.appointmentIds.map(id => id.toString()),
        productIds: customer.productIds.map(id => id.toString()),
        noteIds: customer.noteIds.map(id => id.toString()),
        tags: customer.tags,
        assignedStaffId: customer.assignedStaffId?._id?.toString(),
        assignedStaffName: (customer.assignedStaffId as IUser)?.name,
        lastInteractionAt: new Date(customer.lastInteractionAt),
        createdAt: new Date(customer.createdAt as Date),
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
        id: customer._id.toString(),
        phoneNumber: customer.phoneNumber,
        name: customer.name,
        internalName: customer.internalName,
        chatHistoryIds: customer.chatHistoryIds.map(id => id.toString()),
        appointmentIds: customer.appointmentIds.map(id => id.toString()),
        productIds: customer.productIds.map(id => id.toString()),
        noteIds: customer.noteIds.map(id => id.toString()),
        tags: customer.tags,
        assignedStaffId: customer.assignedStaffId?._id?.toString(),
        assignedStaffName: (customer.assignedStaffId as IUser)?.name,
        lastInteractionAt: new Date(customer.lastInteractionAt),
        createdAt: new Date(customer.createdAt as Date),
  };
}


export async function sendStaffMessage(
  staffSession: UserSession,
  customerId: string,
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
  const staffMessageData: Partial<IMessage> = {
    sender: 'ai', // Staff messages are logged as 'ai' for simplicity in chat bubble styling for now
    content: messageContent,
    timestamp: new Date(),
    name: staffSession.name || 'Nhân viên', 
    customerId: customer._id, 
    userId: new mongoose.Types.ObjectId(staffSession.id), 
  };
  const savedStaffMessageDoc = await new MessageModel(staffMessageData).save();
  await CustomerModel.findByIdAndUpdate(customerId, {
    $push: { chatHistoryIds: savedStaffMessageDoc._id },
    lastInteractionAt: new Date(),
  });
  return transformMessageDocToMessage(savedStaffMessageDoc);
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
export async function getAppointmentRules(): Promise<AppointmentRule[]> {
    await dbConnect();
    const docs = await AppointmentRuleModel.find({}).sort({ name: 1 });
    return docs.map(transformAppointmentRuleDoc);
}

export async function createAppointmentRule(data: Omit<AppointmentRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AppointmentRule> {
    await dbConnect();
    const newDoc = new AppointmentRuleModel(data);
    await newDoc.save();
    return transformAppointmentRuleDoc(newDoc);
}

export async function updateAppointmentRule(id: string, data: Partial<Omit<AppointmentRule, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AppointmentRule | null> {
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
        id: customer._id.toString(),
        phoneNumber: customer.phoneNumber,
        name: customer.name,
        internalName: customer.internalName,
        chatHistoryIds: customer.chatHistoryIds.map(id => id.toString()),
        appointmentIds: customer.appointmentIds.map(id => id.toString()),
        productIds: customer.productIds.map(id => id.toString()),
        noteIds: customer.noteIds.map(id => id.toString()),
        tags: customer.tags,
        assignedStaffId: customer.assignedStaffId?._id?.toString(),
        assignedStaffName: (customer.assignedStaffId as IUser)?.name,
        lastInteractionAt: new Date(customer.lastInteractionAt),
        createdAt: new Date(customer.createdAt as Date), 
  };
}

// --- Appointment Management Actions ---

export async function getAppointments(filters: GetAppointmentsFilters): Promise<AppointmentDetails[]> {
  await dbConnect();
  const query: any = {};

  if (filters.date) {
    query.date = filters.date;
  } else if (filters.dates && Array.isArray(filters.dates) && filters.dates.length > 0) {
     query.date = { $in: filters.dates };
  }

  if (filters.customerId) {
    query.customerId = new mongoose.Types.ObjectId(filters.customerId);
  }
  if (filters.staffId) {
    query.staffId = new mongoose.Types.ObjectId(filters.staffId);
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
  if (!Types.ObjectId.isValid(data.customerId)) {
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
    customerId: new Types.ObjectId(data.customerId),
    service: data.service,
    date: data.date, 
    time: data.time, 
    branch: data.branch,
    status: data.status || 'booked', 
    notes: data.notes,
    packageType: data.packageType,
    priority: data.priority,
  };
  if (data.staffId && Types.ObjectId.isValid(data.staffId)) {
    appointmentData.staffId = new Types.ObjectId(data.staffId);
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

  if (data.staffId && Types.ObjectId.isValid(data.staffId)) {
    updateData.staffId = new Types.ObjectId(data.staffId);
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
        id: c._id.toString(),
        name: c.name || `Khách ${c.phoneNumber.slice(-4)}`,
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
            id: doc._id.toString(),
            name: doc.name,
            phoneNumber: doc.phoneNumber,
            createdAt: new Date(doc.createdAt as Date),
        })),
        systemStatus: 'Optimal', // Placeholder, can be enhanced
    };
}

export async function getStaffDashboardStats(staffId: string): Promise<StaffDashboardStats> {
    await dbConnect();
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const todayDateString = formatISO(todayStart, { representation: 'date' }); // YYYY-MM-DD

    const activeChatsAssignedToMeCount = await CustomerModel.countDocuments({
        assignedStaffId: new mongoose.Types.ObjectId(staffId),
        lastInteractionAt: { $gte: todayStart, $lt: todayEnd },
    });
    
    const myAppointmentsTodayCount = await AppointmentModel.countDocuments({
        staffId: new mongoose.Types.ObjectId(staffId),
        date: todayDateString,
        status: {$nin: ['cancelled', 'completed']}
    });
    
    const totalAssignedToMeCount = await CustomerModel.countDocuments({ assignedStaffId: new mongoose.Types.ObjectId(staffId) });

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
        customerId: new mongoose.Types.ObjectId(customerId),
        staffId: new mongoose.Types.ObjectId(staffId),
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
    const noteDocs = await NoteModel.find({ customerId: new mongoose.Types.ObjectId(customerId) })
        .populate<{ staffId: IUser }>('staffId', 'name')
        .sort({ createdAt: -1 });
    return noteDocs.map(transformNoteDocToNote);
}

export async function updateCustomerNote(noteId: string, staffId: string, content: string): Promise<Note | null> {
    await dbConnect();
    const note = await NoteModel.findById(noteId);
    if (!note) throw new Error("Note not found.");
    if (note.staffId.toString() !== staffId) { // Basic permission check: only creator can edit
        // More complex logic might allow admins or other staff based on roles
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
     if (note.staffId.toString() !== staffId) {
        throw new Error("You are not authorized to delete this note.");
    }
    await NoteModel.findByIdAndDelete(noteId);
    await CustomerModel.findByIdAndUpdate(note.customerId, { $pull: { noteIds: noteId } });
    return { success: true };
}