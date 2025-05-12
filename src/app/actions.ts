// src/app/actions.ts
'use server';

import type { Message, UserSession, AppointmentDetails, Product, Note, CustomerProfile, UserRole } from '@/lib/types';
import { answerUserQuestion } from '@/ai/flows/answer-user-question';
import { generateSuggestedReplies } from '@/ai/flows/generate-suggested-replies';
import { scheduleAppointment as scheduleAppointmentAIFlow } from '@/ai/flows/schedule-appointment';
import type { ScheduleAppointmentOutput, AppointmentDetails as AIScheduleAppointmentDetails } from '@/ai/schemas/schedule-appointment-schemas';
import { randomUUID } from 'crypto'; // For generating unique IDs if needed for non-DB items

import dbConnect from '@/lib/mongodb';
import UserModel from '@/models/User.model';
import CustomerModel from '@/models/Customer.model';
import MessageModel from '@/models/Message.model';
import AppointmentModel from '@/models/Appointment.model';
import type { IUser } from '@/models/User.model';
import type { ICustomer } from '@/models/Customer.model';
import type { IMessage } from '@/models/Message.model';
import type { IAppointment } from '@/models/Appointment.model';

const KEYWORD_RESPONSES: Record<string, string> = {
  "giờ mở cửa": "Chúng tôi mở cửa từ 9 giờ sáng đến 6 giờ tối, tất cả các ngày trong tuần.",
  "dịch vụ": "Chúng tôi cung cấp các dịch vụ cắt tóc, tạo kiểu, nhuộm tóc, làm móng, chăm sóc da mặt và massage. Bạn có muốn biết thêm về một dịch vụ cụ thể không?",
  "địa chỉ": "Chi nhánh chính của chúng tôi ở 123 Đường Chính (Main Street Branch). Chúng tôi cũng có một chi nhánh ở 456 Đường Sồi (Oak Avenue Annex).",
  "chi nhánh": "Chúng tôi có 2 chi nhánh: Chi nhánh Chính (123 Đường Chính) và Chi nhánh Phụ (456 Đường Sồi).",
  "giá": "Giá dịch vụ của chúng tôi rất cạnh tranh. Bạn quan tâm đến dịch vụ nào để tôi báo giá chi tiết?",
  "khuyến mãi": "Hiện tại chúng tôi đang có chương trình giảm giá 10% cho dịch vụ chăm sóc da mặt. Bạn có muốn đặt lịch không?",
};


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
        // chatHistory, appointments, etc. will be loaded separately or populated if needed
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
    return {
        appointmentId: apptDoc._id.toString(),
        userId: apptDoc.customerId.toString(), // In AppointmentDetails, userId refers to the customer
        service: apptDoc.service,
        time: apptDoc.time,
        date: apptDoc.date,
        branch: apptDoc.branch,
        status: apptDoc.status as AppointmentDetails['status'],
        notes: apptDoc.notes,
        createdAt: new Date(apptDoc.createdAt as Date),
        updatedAt: new Date(apptDoc.updatedAt as Date),
        staffId: apptDoc.staffId?.toString(),
    };
}


// For customer identification via phone number on main page
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
      name: `Khách ${phoneNumber.slice(-4)}`, // Default name in Vietnamese
      lastInteractionAt: new Date(),
    });
    customer = await newCustomerDoc.save();
    userSession = transformCustomerToSession(customer);
  }

  const welcomeMessageContent = initialMessages.length === 0
    ? `Chào mừng bạn đến với AetherChat! Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về dịch vụ hoặc đặt lịch hẹn.`
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
    suggestedReplies = ['Các dịch vụ của bạn?', 'Đặt lịch hẹn', 'Địa chỉ của bạn ở đâu?'];
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
    customerId: customerId as any, 
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
    try {
      const customerAppointmentsDocs = await AppointmentModel.find({ customerId: customerId, status: { $ne: 'cancelled' } });
      const customerAppointments = customerAppointmentsDocs.map(transformAppointmentDocToDetails);
      
      scheduleOutput = await scheduleAppointmentAIFlow({
        userInput: userMessageContent,
        phoneNumber: currentUserSession.phoneNumber,
        userId: customerId, 
        existingAppointments: customerAppointments,
        currentDateTime: new Date().toISOString(),
      });

      aiResponseContent = scheduleOutput.confirmationMessage;

      if (scheduleOutput.intent === 'booked' && scheduleOutput.appointmentDetails) {
        const newAppointmentData: Omit<IAppointment, '_id' | 'createdAt' | 'updatedAt'> = {
          customerId: customerId as any,
          service: scheduleOutput.appointmentDetails.service!,
          date: scheduleOutput.appointmentDetails.date!,
          time: scheduleOutput.appointmentDetails.time!,
          branch: scheduleOutput.appointmentDetails.branch,
          status: 'booked',
        };
        processedAppointmentDB = await new AppointmentModel(newAppointmentData).save();
        await CustomerModel.findByIdAndUpdate(customerId, { $push: { appointmentIds: processedAppointmentDB._id } });
        aiResponseContent += ` Mã lịch hẹn: ${processedAppointmentDB._id.toString()}.`;

      } else if (scheduleOutput.intent === 'cancelled' && scheduleOutput.originalAppointmentIdToModify) {
        processedAppointmentDB = await AppointmentModel.findOneAndUpdate(
          { _id: scheduleOutput.originalAppointmentIdToModify, customerId: customerId },
          { status: 'cancelled', updatedAt: new Date() },
          { new: true }
        );
      } else if (scheduleOutput.intent === 'rescheduled' && scheduleOutput.originalAppointmentIdToModify && scheduleOutput.appointmentDetails) {
         processedAppointmentDB = await AppointmentModel.findOneAndUpdate(
            { _id: scheduleOutput.originalAppointmentIdToModify, customerId: customerId },
            { 
              service: scheduleOutput.appointmentDetails.service!,
              date: scheduleOutput.appointmentDetails.date!,
              time: scheduleOutput.appointmentDetails.time!,
              branch: scheduleOutput.appointmentDetails.branch,
              status: 'booked', 
              updatedAt: new Date() 
            },
            { new: true }
         );
         if (!processedAppointmentDB) { 
            const newAppointmentData: Omit<IAppointment, '_id' | 'createdAt' | 'updatedAt'> = {
              customerId: customerId as any,
              service: scheduleOutput.appointmentDetails.service!,
              date: scheduleOutput.appointmentDetails.date!,
              time: scheduleOutput.appointmentDetails.time!,
              branch: scheduleOutput.appointmentDetails.branch,
              status: 'booked',
            };
            processedAppointmentDB = await new AppointmentModel(newAppointmentData).save();
            await CustomerModel.findByIdAndUpdate(customerId, { $push: { appointmentIds: processedAppointmentDB._id } });
            aiResponseContent = `Không tìm thấy lịch hẹn gốc để đổi. Vì vậy, tôi đã tạo một lịch hẹn mới cho bạn: ${scheduleOutput.confirmationMessage} Mã lịch hẹn: ${processedAppointmentDB._id.toString()}.`;
         }
      }

    } catch (error) {
      console.error('Error processing appointment action:', error);
      aiResponseContent = "Tôi gặp sự cố với yêu cầu đặt lịch của bạn. Bạn có thể thử diễn đạt lại hoặc cung cấp thêm chi tiết được không?";
      if (!scheduleOutput) {
        scheduleOutput = { intent: 'error', confirmationMessage: aiResponseContent, requiresAssistance: true };
      }
    }
  } else { 
    let keywordFound = false;
    for (const keyword in KEYWORD_RESPONSES) {
      if (lowerCaseUserMessage.includes(keyword)) {
        aiResponseContent = KEYWORD_RESPONSES[keyword];
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

  const aiMessageData: Partial<IMessage> = {
    sender: 'ai',
    content: aiResponseContent,
    timestamp: new Date(),
    name: 'AetherChat AI',
    customerId: customerId as any,
  };
  const savedAiMessageDoc = await new MessageModel(aiMessageData).save();
  finalAiMessage = transformMessageDocToMessage(savedAiMessageDoc);

  await CustomerModel.findByIdAndUpdate(customerId, {
    $push: { chatHistoryIds: savedAiMessageDoc._id },
    lastInteractionAt: new Date(),
  });

  let newSuggestedReplies: string[] = [];
  try {
    let contextForReplies = aiResponseContent;
    if (scheduleOutput?.intent === 'pending_alternatives' && scheduleOutput.suggestedSlots?.length) {
        contextForReplies = `AI: ${aiResponseContent} Bạn có thể chọn một trong các gợi ý sau: ${scheduleOutput.suggestedSlots.map(s => `${s.service || scheduleOutput.appointmentDetails?.service} vào ${s.date} lúc ${s.time}`).join(', ')}. Hoặc hỏi các lựa chọn khác.`;
    } else if (scheduleOutput?.intent === 'clarification_needed' && scheduleOutput.missingInformation) {
        contextForReplies = `AI: ${aiResponseContent} Vui lòng cung cấp: ${scheduleOutput.missingInformation}.`;
    }

    const repliesResult = await generateSuggestedReplies({ latestMessage: contextForReplies });
    newSuggestedReplies = repliesResult.suggestedReplies;

    if (scheduleOutput?.intent === 'pending_alternatives' && scheduleOutput.suggestedSlots) {
        const slotSuggestions = scheduleOutput.suggestedSlots.slice(0, 2).map(slot => 
            `Đặt ${scheduleOutput.appointmentDetails?.service || 'dịch vụ'} ${slot.date} ${slot.time}`
        );
        newSuggestedReplies = [...new Set([...slotSuggestions, ...newSuggestedReplies])].slice(0,3);
    } else if (scheduleOutput?.intent === 'clarification_needed' && scheduleOutput.missingInformation) {
        newSuggestedReplies.unshift(`Cung cấp ${scheduleOutput.missingInformation}`);
        newSuggestedReplies = [...new Set(newSuggestedReplies)].slice(0,3);
    }

  } catch (error) {
    console.error('Error generating new suggested replies:', error);
    newSuggestedReplies = (hasSchedulingIntent && scheduleOutput?.intent !== 'booked' && scheduleOutput?.intent !== 'cancelled')
      ? ['Xác nhận giờ gợi ý', 'Hỏi giờ khác', 'Hủy yêu cầu'] 
      : ['Kể thêm cho tôi', 'Hỏi câu khác', 'Cảm ơn!'];
  }
  newSuggestedReplies = [...new Set(newSuggestedReplies)].slice(0, 3);

  const updatedAppointmentClient = processedAppointmentDB ? transformAppointmentDocToDetails(processedAppointmentDB) : undefined;

  return { aiMessage: finalAiMessage, newSuggestedReplies, updatedAppointment: updatedAppointmentClient };
}


// --- Functions for Admin/Staff ---
export async function getCustomersForStaffView(): Promise<CustomerProfile[]> {
    await dbConnect();
    const customerDocs = await CustomerModel.find({})
        .sort({ lastInteractionAt: -1 })
        .limit(50); 
    
    return customerDocs.map(doc => ({
        id: doc._id.toString(),
        phoneNumber: doc.phoneNumber,
        name: doc.name,
        internalName: doc.internalName,
        chatHistoryIds: doc.chatHistoryIds.map(id => id.toString()),
        appointmentIds: doc.appointmentIds.map(id => id.toString()),
        productIds: doc.productIds, // Assuming productIds are stored directly as strings
        noteIds: doc.noteIds.map(id => id.toString()),
        tags: doc.tags,
        assignedStaffId: doc.assignedStaffId?.toString(),
        lastInteractionAt: new Date(doc.lastInteractionAt),
        createdAt: new Date(doc.createdAt as Date),
    }));
}

export async function getCustomerDetails(customerId: string): Promise<{customer: CustomerProfile | null, messages: Message[], appointments: AppointmentDetails[]}> {
    await dbConnect();
    const customerDoc = await CustomerModel.findById(customerId);
    if (!customerDoc) {
        return { customer: null, messages: [], appointments: [] };
    }

    const messageDocs = await MessageModel.find({ customerId: customerDoc._id }).sort({ timestamp: 1 });
    const appointmentDocs = await AppointmentModel.find({ customerId: customerDoc._id }).sort({ date: 1, time: 1 });

    const customerProfile: CustomerProfile = {
        id: customerDoc._id.toString(),
        phoneNumber: customerDoc.phoneNumber,
        name: customerDoc.name,
        internalName: customerDoc.internalName,
        chatHistoryIds: customerDoc.chatHistoryIds.map(id => id.toString()),
        appointmentIds: customerDoc.appointmentIds.map(id => id.toString()),
        productIds: customerDoc.productIds, // Assuming productIds are stored directly as strings
        noteIds: customerDoc.noteIds.map(id => id.toString()),
        tags: customerDoc.tags,
        assignedStaffId: customerDoc.assignedStaffId?.toString(),
        lastInteractionAt: new Date(customerDoc.lastInteractionAt),
        createdAt: new Date(customerDoc.createdAt as Date),
    };
    
    return { 
        customer: customerProfile, 
        messages: messageDocs.map(transformMessageDocToMessage), 
        appointments: appointmentDocs.map(transformAppointmentDocToDetails) 
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
  tempPassword?: string 
): Promise<UserSession | null> {
  await dbConnect();
  if (await UserModel.findOne({ phoneNumber })) {
    throw new Error('Người dùng với số điện thoại này đã tồn tại.');
  }
  const newUser = new UserModel({
    name,
    phoneNumber,
    role,
    password: tempPassword || randomUUID(), 
  });
  await newUser.save();
  return transformUserToSession(newUser);
}

export async function assignStaffToCustomer(customerId: string, staffId: string): Promise<CustomerProfile | null> {
  await dbConnect();
  const updatedCustomer = await CustomerModel.findByIdAndUpdate(
    customerId,
    { assignedStaffId: staffId, lastInteractionAt: new Date() }, // also update last interaction
    { new: true }
  );
  if (!updatedCustomer) throw new Error("Không tìm thấy khách hàng.");
  // TODO: Notify staff if needed
  return {
        id: updatedCustomer._id.toString(),
        phoneNumber: updatedCustomer.phoneNumber,
        name: updatedCustomer.name,
        internalName: updatedCustomer.internalName,
        chatHistoryIds: updatedCustomer.chatHistoryIds.map(id => id.toString()),
        appointmentIds: updatedCustomer.appointmentIds.map(id => id.toString()),
        productIds: updatedCustomer.productIds,
        noteIds: updatedCustomer.noteIds.map(id => id.toString()),
        tags: updatedCustomer.tags,
        assignedStaffId: updatedCustomer.assignedStaffId?.toString(),
        lastInteractionAt: new Date(updatedCustomer.lastInteractionAt),
        createdAt: new Date(updatedCustomer.createdAt as Date),
  };
}

export async function unassignStaffFromCustomer(customerId: string): Promise<CustomerProfile | null> {
  await dbConnect();
  const updatedCustomer = await CustomerModel.findByIdAndUpdate(
    customerId,
    { $unset: { assignedStaffId: "" }, lastInteractionAt: new Date() }, // remove assignedStaffId
    { new: true }
  );
  if (!updatedCustomer) throw new Error("Không tìm thấy khách hàng.");
  // TODO: Notify relevant parties if customer is back in general queue
   return {
        id: updatedCustomer._id.toString(),
        phoneNumber: updatedCustomer.phoneNumber,
        name: updatedCustomer.name,
        internalName: updatedCustomer.internalName,
        chatHistoryIds: updatedCustomer.chatHistoryIds.map(id => id.toString()),
        appointmentIds: updatedCustomer.appointmentIds.map(id => id.toString()),
        productIds: updatedCustomer.productIds,
        noteIds: updatedCustomer.noteIds.map(id => id.toString()),
        tags: updatedCustomer.tags,
        assignedStaffId: updatedCustomer.assignedStaffId?.toString(),
        lastInteractionAt: new Date(updatedCustomer.lastInteractionAt),
        createdAt: new Date(updatedCustomer.createdAt as Date),
  };
}

export async function addTagToCustomer(customerId: string, tag: string): Promise<CustomerProfile | null> {
    await dbConnect();
    const customer = await CustomerModel.findById(customerId);
    if (!customer) throw new Error("Không tìm thấy khách hàng.");

    if (!customer.tags.includes(tag)) {
        customer.tags.push(tag);
        await customer.save();
    }
     return {
        id: customer._id.toString(),
        phoneNumber: customer.phoneNumber,
        name: customer.name,
        internalName: customer.internalName,
        chatHistoryIds: customer.chatHistoryIds.map(id => id.toString()),
        appointmentIds: customer.appointmentIds.map(id => id.toString()),
        productIds: customer.productIds,
        noteIds: customer.noteIds.map(id => id.toString()),
        tags: customer.tags,
        assignedStaffId: customer.assignedStaffId?.toString(),
        lastInteractionAt: new Date(customer.lastInteractionAt),
        createdAt: new Date(customer.createdAt as Date),
  };
}

export async function removeTagFromCustomer(customerId: string, tagToRemove: string): Promise<CustomerProfile | null> {
    await dbConnect();
    const customer = await CustomerModel.findByIdAndUpdate(
        customerId,
        { $pull: { tags: tagToRemove } },
        { new: true }
    );
    if (!customer) throw new Error("Không tìm thấy khách hàng.");
    return {
        id: customer._id.toString(),
        phoneNumber: customer.phoneNumber,
        name: customer.name,
        internalName: customer.internalName,
        chatHistoryIds: customer.chatHistoryIds.map(id => id.toString()),
        appointmentIds: customer.appointmentIds.map(id => id.toString()),
        productIds: customer.productIds,
        noteIds: customer.noteIds.map(id => id.toString()),
        tags: customer.tags,
        assignedStaffId: customer.assignedStaffId?.toString(),
        lastInteractionAt: new Date(customer.lastInteractionAt),
        createdAt: new Date(customer.createdAt as Date),
  };
}

// This is a staff action, sending message to a customer
export async function sendStaffMessage(
  staffSession: UserSession, // Staff's session
  customerId: string,
  messageContent: string
): Promise<Message> {
  await dbConnect();

  // Ensure staff is authorized (basic check)
  if (staffSession.role !== 'staff' && staffSession.role !== 'admin') {
    throw new Error("Không được phép gửi tin nhắn.");
  }

  // Find customer to ensure they exist
  const customer = await CustomerModel.findById(customerId);
  if (!customer) {
    throw new Error("Không tìm thấy khách hàng.");
  }

  const staffMessageData: Partial<IMessage> = {
    sender: 'ai', // 'ai' sender type is used for system/staff messages to customer in current model
    content: messageContent,
    timestamp: new Date(),
    name: staffSession.name || 'Nhân viên', // Staff's name
    customerId: customer._id, // Link to customer
    userId: new mongoose.Types.ObjectId(staffSession.id), // Staff's user ID
  };

  const savedStaffMessageDoc = await new MessageModel(staffMessageData).save();

  // Update customer's last interaction and add message to their history
  await CustomerModel.findByIdAndUpdate(customerId, {
    $push: { chatHistoryIds: savedStaffMessageDoc._id },
    lastInteractionAt: new Date(),
  });
  
  // TODO: Implement real-time notification to the customer if they are online
  // For now, just return the saved message
  return transformMessageDocToMessage(savedStaffMessageDoc);
}
