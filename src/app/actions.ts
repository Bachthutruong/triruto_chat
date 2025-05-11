// src/app/actions.ts
'use server';

import type { Message, UserSession, AppointmentDetails, Product, Note, CustomerProfile, UserRole } from '@/lib/types';
import { answerUserQuestion } from '@/ai/flows/answer-user-question';
import { generateSuggestedReplies } from '@/ai/flows/generate-suggested-replies';
import { scheduleAppointment } from '@/ai/flows/schedule-appointment';
import type { ScheduleAppointmentOutput } from '@/ai/schemas/schedule-appointment-schemas';
import { randomUUID } from 'crypto'; // For generating unique IDs

// Mock database for users, appointments, etc.
// Extended MOCK_USERS to include roles
let MOCK_USERS: Record<string, UserSession> = {
  // Customer
  '1234567890': {
    id: 'user_123',
    phoneNumber: '1234567890',
    role: 'customer',
    name: 'Jane Doe',
    chatHistory: [
      { id: 'hist_1', sender: 'system', content: 'Chat history loaded for Jane Doe.', timestamp: new Date(Date.now() - 3600000) },
      { id: 'hist_2', sender: 'user', content: 'Hello!', timestamp: new Date(Date.now() - 3500000) },
      { id: 'hist_3', sender: 'ai', content: 'Hi Jane, how can I help you today?', timestamp: new Date(Date.now() - 3400000) },
    ],
    appointments: [],
    products: [],
    notes: [],
    tags: ['VIP'],
  },
  // Staff
  'staff001': {
    id: 'staff_001_user',
    phoneNumber: 'staff001', // Using phone number as a simple login key for mock
    role: 'staff',
    name: 'Support Staff Alice',
  },
  // Admin
  'admin001': {
    id: 'admin_001_user',
    phoneNumber: 'admin001', // Using phone number as a simple login key for mock
    role: 'admin',
    name: 'Admin Bob',
  }
};

let MOCK_CUSTOMERS_DATA: Record<string, CustomerProfile> = {
    'user_123': {
        id: 'user_123',
        phoneNumber: '1234567890',
        name: 'Jane Doe',
        chatHistoryIds: ['hist_1', 'hist_2', 'hist_3'],
        appointmentIds: ['appt_0'],
        productIds: [],
        noteIds: [],
        tags: ['VIP'],
        lastInteractionAt: new Date(Date.now() - 3400000),
        createdAt: new Date(Date.now() - 86400000 * 10),
    }
};
let MOCK_ALL_MESSAGES: Record<string, Message> = {
    'hist_1': { id: 'hist_1', sender: 'system', content: 'Chat history loaded for Jane Doe.', timestamp: new Date(Date.now() - 3600000) },
    'hist_2': { id: 'hist_2', sender: 'user', content: 'Hello!', timestamp: new Date(Date.now() - 3500000) },
    'hist_3': { id: 'hist_3', sender: 'ai', content: 'Hi Jane, how can I help you today?', timestamp: new Date(Date.now() - 3400000) },
};


let MOCK_USER_ID_COUNTER = Object.keys(MOCK_USERS).length;
let MOCK_APPOINTMENT_ID_COUNTER = 1;
let MOCK_CUSTOMER_ID_COUNTER = Object.keys(MOCK_CUSTOMERS_DATA).length;


let MOCK_APPOINTMENTS: AppointmentDetails[] = [
    {
        appointmentId: 'appt_0',
        userId: 'user_123', // Links to CustomerProfile.id
        service: 'Initial Consultation',
        date: '2024-07-10',
        time: '10:00 AM',
        branch: 'Main Street Branch',
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000 * 5),
        updatedAt: new Date(Date.now() - 86400000 * 5),
    }
];
const MOCK_PRODUCTS: Product[] = [];
const MOCK_NOTES: Note[] = [];

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

export async function identifyUserAndLoadData(phoneNumber: string): Promise<{
  userSession: UserSession;
  initialMessages?: Message[]; // Optional for admin/staff
  initialSuggestedReplies?: string[]; // Optional for admin/staff
}> {
  await new Promise(resolve => setTimeout(resolve, 500)); 

  let user = MOCK_USERS[phoneNumber];
  
  if (user) { // Existing user (could be customer, staff, or admin)
    if (user.role === 'customer') {
      const customerProfile = MOCK_CUSTOMERS_DATA[user.id];
      const chatHistory = customerProfile?.chatHistoryIds.map(id => MOCK_ALL_MESSAGES[id]).filter(Boolean) || [];
      user.chatHistory = chatHistory;
      user.appointments = MOCK_APPOINTMENTS.filter(appt => appt.userId === user!.id);
      // Load products, notes, tags similarly if they were stored by ID
    }
    // For staff/admin, their UserSession is already defined with their role and name.
    // No specific customer data to load into their session directly here.
  } else { // New customer
    MOCK_USER_ID_COUNTER++;
    const newUserId = `user_customer_${String(Date.now()).slice(-4)}${MOCK_USER_ID_COUNTER}`;
    user = {
      id: newUserId,
      phoneNumber,
      role: 'customer', // New users are customers by default
      name: `Customer ${phoneNumber.slice(-4)}`, // Default name
      chatHistory: [],
      appointments: [],
      products: [],
      notes: [],
      tags: [],
    };
    MOCK_USERS[phoneNumber] = user;

    MOCK_CUSTOMER_ID_COUNTER++;
    const newCustomerProfile: CustomerProfile = {
        id: newUserId,
        phoneNumber: phoneNumber,
        name: user.name,
        chatHistoryIds: [],
        appointmentIds: [],
        productIds: [],
        noteIds: [],
        tags: [],
        lastInteractionAt: new Date(),
        createdAt: new Date(),
    };
    MOCK_CUSTOMERS_DATA[newUserId] = newCustomerProfile;
  }

  if (user.role === 'customer') {
    const welcomeMessageContent = !user.chatHistory || user.chatHistory.length === 0
      ? `Welcome to AetherChat! I'm your AI assistant. How can I help you today? You can ask about our services or schedule an appointment.`
      : `Welcome back${user.name ? ', ' + user.name : ''}! Your history is loaded. How can I assist you today?`;

    const welcomeMessage: Message = {
      id: `msg_system_${Date.now()}`,
      sender: 'system', // System message, not AI
      content: welcomeMessageContent,
      timestamp: new Date(),
    };
    
    const initialMessages = [...(user.chatHistory || []), welcomeMessage];
    // Don't save welcome message to persistent history, it's dynamic
    // MOCK_USERS[phoneNumber].chatHistory = initialMessages; 
    // MOCK_CUSTOMERS_DATA[user.id].chatHistoryIds.push(welcomeMessage.id);
    // MOCK_ALL_MESSAGES[welcomeMessage.id] = welcomeMessage;


    let suggestedReplies: string[] = [];
    try {
      const repliesResult = await generateSuggestedReplies({ latestMessage: welcomeMessageContent });
      suggestedReplies = repliesResult.suggestedReplies;
    } catch (error) {
      console.error('Error generating initial suggested replies:', error);
      suggestedReplies = ['Tell me about services', 'Schedule an appointment', 'Where are you located?'];
    }
    
    return {
      userSession: { ...user, chatHistory: undefined }, // Return user session without full history here
      initialMessages, // Send messages for display
      initialSuggestedReplies: suggestedReplies,
    };
  } else {
    // For staff/admin, no initial messages or replies in this context.
    // They'll go to their dashboards.
    return { userSession: user };
  }
}


export async function processUserMessage(
  userMessageContent: string,
  currentUserSession: UserSession, // This is the customer's session
  currentChatHistory: Message[] // This is the current displayed chat
): Promise<{ aiMessage: Message; newSuggestedReplies: string[]; updatedAppointment?: AppointmentDetails }> {
  await new Promise(resolve => setTimeout(resolve, 300)); 

  const userMessage: Message = {
    id: `msg_user_${Date.now()}`,
    sender: 'user',
    content: userMessageContent,
    timestamp: new Date(),
    name: currentUserSession.name || 'User',
  };

  let updatedChatHistoryWithUserMsg = [...currentChatHistory, userMessage];
  
  // Persist user message
  if (MOCK_CUSTOMERS_DATA[currentUserSession.id]) {
    MOCK_ALL_MESSAGES[userMessage.id] = userMessage;
    MOCK_CUSTOMERS_DATA[currentUserSession.id].chatHistoryIds.push(userMessage.id);
    MOCK_CUSTOMERS_DATA[currentUserSession.id].lastInteractionAt = new Date();
  }
  
  const formattedHistory = formatChatHistoryForAI(updatedChatHistoryWithUserMsg.slice(-10));

  let aiResponseContent: string = "";
  let finalAiMessage: Message;
  let processedAppointment: AppointmentDetails | undefined = undefined;
  let scheduleOutput: ScheduleAppointmentOutput | null = null;

  const schedulingKeywords = ['book', 'schedule', 'appointment', 'meeting', 'reserve', 'đặt lịch', 'hẹn', 'cancel', 'hủy', 'reschedule', 'đổi lịch'];
  const lowerCaseUserMessage = userMessageContent.toLowerCase();
  const hasSchedulingIntent = schedulingKeywords.some(keyword => lowerCaseUserMessage.includes(keyword));

  if (hasSchedulingIntent) {
    try {
      const userAppointments = MOCK_APPOINTMENTS.filter(a => a.userId === currentUserSession.id && a.status !== 'cancelled');
      scheduleOutput = await scheduleAppointment({
        userInput: userMessageContent,
        phoneNumber: currentUserSession.phoneNumber,
        userId: currentUserSession.id,
        existingAppointments: userAppointments,
        currentDateTime: new Date().toISOString(),
      });

      aiResponseContent = scheduleOutput.confirmationMessage;

      if (scheduleOutput.intent === 'booked' && scheduleOutput.appointmentDetails) {
        MOCK_APPOINTMENT_ID_COUNTER++;
        const newAppointmentId = `appt_${String(Date.now()).slice(-4)}${MOCK_APPOINTMENT_ID_COUNTER}`;
        const newAppointment: AppointmentDetails = {
          ...scheduleOutput.appointmentDetails,
          appointmentId: newAppointmentId,
          userId: currentUserSession.id,
          status: 'booked', 
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        MOCK_APPOINTMENTS.push(newAppointment);
        if (MOCK_CUSTOMERS_DATA[currentUserSession.id]) {
            MOCK_CUSTOMERS_DATA[currentUserSession.id].appointmentIds.push(newAppointmentId);
        }
        processedAppointment = newAppointment;
        aiResponseContent += ` Appointment ID: ${newAppointmentId}.`;
      } else if (scheduleOutput.intent === 'cancelled' && scheduleOutput.originalAppointmentIdToModify) {
        const apptIndex = MOCK_APPOINTMENTS.findIndex(a => a.appointmentId === scheduleOutput!.originalAppointmentIdToModify && a.userId === currentUserSession.id);
        if (apptIndex > -1) {
          MOCK_APPOINTMENTS[apptIndex].status = 'cancelled';
          MOCK_APPOINTMENTS[apptIndex].updatedAt = new Date();
          processedAppointment = MOCK_APPOINTMENTS[apptIndex];
        }
      } else if (scheduleOutput.intent === 'rescheduled' && scheduleOutput.originalAppointmentIdToModify && scheduleOutput.appointmentDetails) {
         const apptIndex = MOCK_APPOINTMENTS.findIndex(a => a.appointmentId === scheduleOutput!.originalAppointmentIdToModify && a.userId === currentUserSession.id);
         if (apptIndex > -1) {
            MOCK_APPOINTMENTS[apptIndex] = {
                ...MOCK_APPOINTMENTS[apptIndex],
                ...scheduleOutput.appointmentDetails, 
                status: 'booked', 
                updatedAt: new Date(),
            };
            processedAppointment = MOCK_APPOINTMENTS[apptIndex];
         } else { 
            MOCK_APPOINTMENT_ID_COUNTER++;
            const newAppointmentId = `appt_${String(Date.now()).slice(-4)}${MOCK_APPOINTMENT_ID_COUNTER}`;
            const newAppointment: AppointmentDetails = {
              ...scheduleOutput.appointmentDetails,
              appointmentId: newAppointmentId,
              userId: currentUserSession.id,
              status: 'booked',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            MOCK_APPOINTMENTS.push(newAppointment);
            if (MOCK_CUSTOMERS_DATA[currentUserSession.id]) {
                MOCK_CUSTOMERS_DATA[currentUserSession.id].appointmentIds.push(newAppointmentId);
            }
            processedAppointment = newAppointment;
            aiResponseContent = `Could not find the original appointment to reschedule. So, I've created a new one for you: ${scheduleOutput.confirmationMessage} Appointment ID: ${newAppointmentId}.`;
         }
      }

    } catch (error) {
      console.error('Error processing appointment action:', error);
      aiResponseContent = "I encountered an issue with your appointment request. Could you please try rephrasing or provide more details?";
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
        aiResponseContent = "I'm having a bit of trouble understanding that. Could you try asking in a different way?";
      }
    }
  }

  finalAiMessage = {
    id: `msg_ai_${Date.now()}`,
    sender: 'ai',
    content: aiResponseContent,
    timestamp: new Date(),
    name: 'AetherChat AI',
  };
  
  // Persist AI message
  if (MOCK_CUSTOMERS_DATA[currentUserSession.id]) {
     MOCK_ALL_MESSAGES[finalAiMessage.id] = finalAiMessage;
     MOCK_CUSTOMERS_DATA[currentUserSession.id].chatHistoryIds.push(finalAiMessage.id);
     MOCK_CUSTOMERS_DATA[currentUserSession.id].lastInteractionAt = new Date();
     if (processedAppointment) {
        // MOCK_APPOINTMENTS is already updated. UserSession in MOCK_USERS is also updated.
        // For CustomerProfile, appointmentIds are updated when appointment is created/modified.
     }
  }

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

  return { aiMessage: finalAiMessage, newSuggestedReplies, updatedAppointment: processedAppointment };
}


// --- Functions for Admin/Staff ---
export async function getCustomersForStaffView(): Promise<CustomerProfile[]> {
    // In a real app, filter by assignment, status, etc.
    // For now, return all customers, sorted by last interaction.
    return Object.values(MOCK_CUSTOMERS_DATA).sort((a, b) => b.lastInteractionAt.getTime() - a.lastInteractionAt.getTime());
}

export async function getCustomerDetails(customerId: string): Promise<{customer: CustomerProfile | null, messages: Message[], appointments: AppointmentDetails[]}> {
    const customer = MOCK_CUSTOMERS_DATA[customerId] || null;
    if (!customer) {
        return { customer: null, messages: [], appointments: [] };
    }
    const messages = customer.chatHistoryIds.map(id => MOCK_ALL_MESSAGES[id]).filter(Boolean);
    const appointments = MOCK_APPOINTMENTS.filter(a => customer.appointmentIds.includes(a.appointmentId));
    return { customer, messages, appointments };
}

export async function getAllUsers(): Promise<UserSession[]> {
    // Returns all users including customers, staff, admin for user management by admin
    return Object.values(MOCK_USERS);
}

// Add more actions for staff/admin as features are built, e.g.:
// - assignCustomerToStaff(customerId, staffId)
// - addInternalNote(customerId, staffId, noteContent)
// - updateCustomerTags(customerId, tags)
// - createManualAppointmentForCustomer(staffId, customerId, appointmentDetails)
// - manageKeywords(action: 'add'|'update'|'delete', keywordData)
// - manageInterfaceSettings(settings)
// - manageSEOSettings(settings)
// etc.