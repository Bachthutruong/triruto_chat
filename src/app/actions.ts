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
  "giờ mở cửa": "Chúng tôi mở cửa từ 9 giờ sáng đến 6 giờ tối, từ Thứ Hai đến Thứ Sáu.",
  "dịch vụ": "Chúng tôi cung cấp các dịch vụ cắt tóc, tạo kiểu, nhuộm tóc, làm móng, chăm sóc da mặt và massage. Bạn có muốn biết thêm về một dịch vụ cụ thể không?",
  "địa chỉ": "Chi nhánh chính của chúng tôi ở 123 Đường Chính (Main Street Branch). Chúng tôi cũng có một chi nhánh ở 456 Đường Sồi (Oak Avenue Annex).",
  "opening hours": "We are open from 9 AM to 6 PM, Monday to Friday.",
  "services list": "We offer hair cutting, styling, coloring, manicures, pedicures, facials, and massages. Would you like to know more about a specific service?",
  "location": "Our main branch is at 123 Main Street. We also have a branch at 456 Oak Avenue.",
  "chi nhánh": "Chúng tôi có 2 chi nhánh: Main Street Branch (123 Đường Chính) và Oak Avenue Annex (456 Đường Sồi).",
};


function formatChatHistoryForAI(messages: Message[]): string {
  return messages
    .map(msg => `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.content}`)
    .join('\n');
}

function transformCustomerToSession(customerDoc: ICustomer): UserSession {
    return {
        id: customerDoc._id.toString(),
        phoneNumber: customerDoc.phoneNumber,
        role: 'customer',
        name: customerDoc.name || `Customer ${customerDoc.phoneNumber.slice(-4)}`,
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
      name: `Customer ${phoneNumber.slice(-4)}`,
      lastInteractionAt: new Date(),
    });
    customer = await newCustomerDoc.save();
    userSession = transformCustomerToSession(customer);
  }

  const welcomeMessageContent = initialMessages.length === 0
    ? `Welcome to AetherChat! I'm your AI assistant. How can I help you today? You can ask about our services or schedule an appointment.`
    : `Welcome back${userSession.name ? ', ' + userSession.name : ''}! Your history is loaded. How can I assist you today?`;

  const welcomeMessage: Message = {
    id: `msg_system_${Date.now()}`,
    sender: 'system',
    content: welcomeMessageContent,
    timestamp: new Date(),
  };
  
  // Do not save system welcome message to DB, it's dynamic for the session
  initialMessages.push(welcomeMessage);

  let suggestedReplies: string[] = [];
  try {
    const repliesResult = await generateSuggestedReplies({ latestMessage: welcomeMessageContent });
    suggestedReplies = repliesResult.suggestedReplies;
  } catch (error) {
    console.error('Error generating initial suggested replies:', error);
    suggestedReplies = ['Tell me about services', 'Schedule an appointment', 'Where are you located?'];
  }
  
  return {
    userSession,
    initialMessages,
    initialSuggestedReplies: suggestedReplies,
  };
}


export async function registerUser(name: string, phoneNumber: string, password: string, role: UserRole): Promise<UserSession | null> {
  if (role === 'customer') throw new Error("Customer registration is handled differently.");
  await dbConnect();

  const existingUser = await UserModel.findOne({ phoneNumber });
  if (existingUser) {
    throw new Error('User with this phone number already exists.');
  }

  const newUserDoc = new UserModel({
    name,
    phoneNumber,
    password, // Will be hashed by pre-save hook
    role,
  });
  await newUserDoc.save();
  return transformUserToSession(newUserDoc);
}

export async function loginUser(phoneNumber: string, passwordAttempt: string): Promise<UserSession | null> {
  await dbConnect();
  const user = await UserModel.findOne({ phoneNumber }).select('+password'); // Explicitly select password

  if (!user || user.role === 'customer') { // Customers don't log in with password this way
    throw new Error('User not found or not authorized for password login.');
  }

  if (!user.password) {
     throw new Error('Password not set for this user. Please contact admin.');
  }

  const isMatch = await user.comparePassword(passwordAttempt);
  if (!isMatch) {
    throw new Error('Invalid credentials.');
  }
  return transformUserToSession(user);
}


export async function processUserMessage(
  userMessageContent: string,
  currentUserSession: UserSession, // This is the customer's session ID (from CustomerModel._id)
  currentChatHistory: Message[] 
): Promise<{ aiMessage: Message; newSuggestedReplies: string[]; updatedAppointment?: AppointmentDetails }> {
  await dbConnect();

  const customerId = currentUserSession.id; // This is CustomerModel._id for customers

  const userMessageData: Partial<IMessage> = {
    sender: 'user',
    content: userMessageContent,
    timestamp: new Date(),
    name: currentUserSession.name || 'User',
    customerId: customerId as any, // mongoose.Types.ObjectId,
  };
  const savedUserMessageDoc = await new MessageModel(userMessageData).save();
  const userMessage = transformMessageDocToMessage(savedUserMessageDoc);

  // Update customer's last interaction and add message ID to history
  await CustomerModel.findByIdAndUpdate(customerId, {
    $push: { chatHistoryIds: savedUserMessageDoc._id },
    lastInteractionAt: new Date(),
  });
  
  let updatedChatHistoryWithUserMsg = [...currentChatHistory, userMessage];
  const formattedHistory = formatChatHistoryForAI(updatedChatHistoryWithUserMsg.slice(-10));

  let aiResponseContent: string = "";
  let finalAiMessage: Message;
  let processedAppointmentDB: IAppointment | null = null; // To store appointment from DB if action occurs
  let scheduleOutput: ScheduleAppointmentOutput | null = null;

  const schedulingKeywords = ['book', 'schedule', 'appointment', 'meeting', 'reserve', 'đặt lịch', 'hẹn', 'cancel', 'hủy', 'reschedule', 'đổi lịch'];
  const lowerCaseUserMessage = userMessageContent.toLowerCase();
  const hasSchedulingIntent = schedulingKeywords.some(keyword => lowerCaseUserMessage.includes(keyword));

  if (hasSchedulingIntent) {
    try {
      const customerAppointmentsDocs = await AppointmentModel.find({ customerId: customerId, status: { $ne: 'cancelled' } });
      const customerAppointments = customerAppointmentsDocs.map(transformAppointmentDocToDetails);
      
      scheduleOutput = await scheduleAppointmentAIFlow({
        userInput: userMessageContent,
        phoneNumber: currentUserSession.phoneNumber,
        userId: customerId, // Use customer's DB ID
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
        aiResponseContent += ` Appointment ID: ${processedAppointmentDB._id.toString()}.`;

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
         if (!processedAppointmentDB) { // Original not found, create new
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
            aiResponseContent = `Could not find the original appointment to reschedule. So, I've created a new one for you: ${scheduleOutput.confirmationMessage} Appointment ID: ${processedAppointmentDB._id.toString()}.`;
         }
      }

    } catch (error) {
      console.error('Error processing appointment action:', error);
      aiResponseContent = "I encountered an issue with your appointment request. Could you please try rephrasing or provide more details?";
      if (!scheduleOutput) {
        scheduleOutput = { intent: 'error', confirmationMessage: aiResponseContent, requiresAssistance: true };
      }
    }
  } else { // Not a scheduling intent
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
        aiResponseContent = "I'm having a bit of trouble understanding that. Could you try asking in a different way?";
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
        contextForReplies = `AI: ${aiResponseContent} You can choose one of these: ${scheduleOutput.suggestedSlots.map(s => `${s.service || scheduleOutput.appointmentDetails?.service} on ${s.date} at ${s.time}`).join(', ')}. Or ask for other options.`;
    } else if (scheduleOutput?.intent === 'clarification_needed' && scheduleOutput.missingInformation) {
        contextForReplies = `AI: ${aiResponseContent} Please provide: ${scheduleOutput.missingInformation}.`;
    }

    const repliesResult = await generateSuggestedReplies({ latestMessage: contextForReplies });
    newSuggestedReplies = repliesResult.suggestedReplies;

    if (scheduleOutput?.intent === 'pending_alternatives' && scheduleOutput.suggestedSlots) {
        const slotSuggestions = scheduleOutput.suggestedSlots.slice(0, 2).map(slot => 
            `Book ${scheduleOutput.appointmentDetails?.service || 'service'} ${slot.date} ${slot.time}`
        );
        newSuggestedReplies = [...new Set([...slotSuggestions, ...newSuggestedReplies])].slice(0,3);
    } else if (scheduleOutput?.intent === 'clarification_needed' && scheduleOutput.missingInformation) {
        newSuggestedReplies.unshift(`Provide ${scheduleOutput.missingInformation}`);
        newSuggestedReplies = [...new Set(newSuggestedReplies)].slice(0,3);
    }

  } catch (error) {
    console.error('Error generating new suggested replies:', error);
    newSuggestedReplies = (hasSchedulingIntent && scheduleOutput?.intent !== 'booked' && scheduleOutput?.intent !== 'cancelled')
      ? ['Confirm suggested time', 'Ask for other times', 'Cancel request'] 
      : ['Tell me more', 'Ask something else', 'Thanks!'];
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
        .limit(50); // Add pagination later
    
    return customerDocs.map(doc => ({
        id: doc._id.toString(),
        phoneNumber: doc.phoneNumber,
        name: doc.name,
        internalName: doc.internalName,
        chatHistoryIds: doc.chatHistoryIds.map(id => id.toString()),
        appointmentIds: doc.appointmentIds.map(id => id.toString()),
        productIds: doc.productIds,
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
        productIds: customerDoc.productIds,
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
    // Fetch only staff and admin users for user management purposes, exclude customers.
    const userDocs = await UserModel.find({ role: { $in: ['staff', 'admin'] } });
    return userDocs.map(transformUserToSession);
}

// Example action for admin to create a staff user or another admin
export async function createStaffOrAdminUser(
  name: string,
  phoneNumber: string,
  role: 'staff' | 'admin',
  // In a real app, password would be set by admin or a temporary one sent
  tempPassword?: string 
): Promise<UserSession | null> {
  await dbConnect();
  if (await UserModel.findOne({ phoneNumber })) {
    throw new Error('User with this phone number already exists.');
  }
  const newUser = new UserModel({
    name,
    phoneNumber,
    role,
    password: tempPassword || randomUUID(), // Set a random password if not provided, to be changed on first login
  });
  await newUser.save();
  return transformUserToSession(newUser);
}
