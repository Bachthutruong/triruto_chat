// src/app/actions.ts
'use server';

import type { Message, UserSession, AppointmentDetails, Product, Note, AppointmentStatus } from '@/lib/types';
import { answerUserQuestion } from '@/ai/flows/answer-user-question';
import { generateSuggestedReplies } from '@/ai/flows/generate-suggested-replies';
import { scheduleAppointment } from '@/ai/flows/schedule-appointment';
import type { ScheduleAppointmentOutput } from '@/ai/schemas/schedule-appointment-schemas';
import { randomUUID } from 'crypto'; // For generating unique IDs

// Mock database for users, appointments, etc.
let MOCK_USERS: Record<string, UserSession> = {
  '1234567890': {
    id: 'user_123',
    phoneNumber: '1234567890',
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
};
let MOCK_USER_ID_COUNTER = 1; // Start from 1 for new users
let MOCK_APPOINTMENT_ID_COUNTER = 1;

let MOCK_APPOINTMENTS: AppointmentDetails[] = [
    {
        appointmentId: 'appt_0',
        userId: 'user_123',
        service: 'Initial Consultation',
        date: '2024-07-10',
        time: '10:00 AM',
        branch: 'Main Street Branch',
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000 * 5),
        updatedAt: new Date(Date.now() - 86400000 * 5),
    }
];
const MOCK_PRODUCTS: Product[] = []; // If needed globally
const MOCK_NOTES: Note[] = []; // If needed globally

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
  initialMessages: Message[];
  initialSuggestedReplies: string[];
}> {
  await new Promise(resolve => setTimeout(resolve, 500)); 

  let user = MOCK_USERS[phoneNumber];
  const isNewUser = !user;

  if (isNewUser) {
    MOCK_USER_ID_COUNTER++;
    const newUserId = `user_guest_${String(Date.now()).slice(-4)}${MOCK_USER_ID_COUNTER}`;
    user = {
      id: newUserId,
      phoneNumber,
      chatHistory: [],
      appointments: [],
      products: [],
      notes: [],
      tags: [],
    };
    MOCK_USERS[phoneNumber] = user;
  } else {
    // Load existing user's appointments from the global list
    user.appointments = MOCK_APPOINTMENTS.filter(appt => appt.userId === user!.id);
  }

  const welcomeMessageContent = isNewUser
    ? `Welcome to AetherChat! I'm your AI assistant. How can I help you today? You can ask about our services or schedule an appointment.`
    : `Welcome back${user.name ? ', ' + user.name : ''}! Your appointments are loaded. How can I assist you today?`;

  const welcomeMessage: Message = {
    id: `msg_system_${Date.now()}`,
    sender: 'ai',
    content: welcomeMessageContent,
    timestamp: new Date(),
  };

  // Ensure chatHistory is an array
  user.chatHistory = user.chatHistory || [];
  const initialMessages = [...user.chatHistory, welcomeMessage];
  
  user.chatHistory = initialMessages; // Update user's chat history in mock DB

  let suggestedReplies: string[] = [];
  try {
    const repliesResult = await generateSuggestedReplies({ latestMessage: welcomeMessageContent });
    suggestedReplies = repliesResult.suggestedReplies;
  } catch (error) {
    console.error('Error generating initial suggested replies:', error);
    suggestedReplies = ['Tell me about services', 'Schedule an appointment', 'Where are you located?'];
  }
  
  return {
    userSession: { 
        id: user.id, 
        phoneNumber: user.phoneNumber, 
        name: user.name,
        // Return full session data as per new type definition
        appointments: user.appointments,
        products: user.products,
        notes: user.notes,
        tags: user.tags,
        chatHistory: user.chatHistory // Already part of initialMessages, but good to be explicit for session type
    },
    initialMessages,
    initialSuggestedReplies: suggestedReplies,
  };
}


export async function processUserMessage(
  userMessageContent: string,
  currentUserSession: UserSession,
  currentChatHistory: Message[]
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
  if (MOCK_USERS[currentUserSession.phoneNumber]) {
    MOCK_USERS[currentUserSession.phoneNumber].chatHistory = updatedChatHistoryWithUserMsg;
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
          status: 'booked', // Ensure status is booked
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        MOCK_APPOINTMENTS.push(newAppointment);
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
                ...scheduleOutput.appointmentDetails, // service, date, time, branch
                status: 'booked', // Rescheduled appointment is now booked
                updatedAt: new Date(),
            };
            processedAppointment = MOCK_APPOINTMENTS[apptIndex];
         } else { // Original appointment not found, treat as new booking if details are sufficient
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
            processedAppointment = newAppointment;
            aiResponseContent = `Could not find the original appointment to reschedule. So, I've created a new one for you: ${scheduleOutput.confirmationMessage} Appointment ID: ${newAppointmentId}.`;
         }
      }
      // If pending_alternatives, clarification_needed, or error, aiResponseContent is already set from scheduleOutput.confirmationMessage.

    } catch (error) {
      console.error('Error processing appointment action:', error);
      aiResponseContent = "I encountered an issue with your appointment request. Could you please try rephrasing or provide more details?";
      // Optionally, set scheduleOutput to an error state if it's not already
      if (!scheduleOutput) {
        scheduleOutput = { intent: 'error', confirmationMessage: aiResponseContent, requiresAssistance: true };
      }
    }
  } else {
    // Check for keyword match if no scheduling intent
    let keywordFound = false;
    for (const keyword in KEYWORD_RESPONSES) {
      if (lowerCaseUserMessage.includes(keyword)) {
        aiResponseContent = KEYWORD_RESPONSES[keyword];
        keywordFound = true;
        break;
      }
    }

    if (!keywordFound) {
      // Fallback to general AI question answering
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
  
  if (MOCK_USERS[currentUserSession.phoneNumber]) {
     MOCK_USERS[currentUserSession.phoneNumber].chatHistory?.push(finalAiMessage);
     if (processedAppointment) {
        // Update user session's appointment list
        const userAppts = MOCK_USERS[currentUserSession.phoneNumber].appointments || [];
        const existingApptIndex = userAppts.findIndex(a => a.appointmentId === processedAppointment.appointmentId);
        if (existingApptIndex > -1) {
            userAppts[existingApptIndex] = processedAppointment;
        } else {
            userAppts.push(processedAppointment);
        }
        MOCK_USERS[currentUserSession.phoneNumber].appointments = userAppts.filter(a => a.status !== 'cancelled'); // Keep non-cancelled
     }
  }

  let newSuggestedReplies: string[] = [];
  try {
    // Base suggested replies on AI's response
    let contextForReplies = aiResponseContent;
    if (scheduleOutput?.intent === 'pending_alternatives' && scheduleOutput.suggestedSlots?.length) {
        contextForReplies = `AI: ${aiResponseContent} You can choose one of these: ${scheduleOutput.suggestedSlots.map(s => `${s.service || scheduleOutput.appointmentDetails?.service} on ${s.date} at ${s.time}`).join(', ')}. Or ask for other options.`;
    } else if (scheduleOutput?.intent === 'clarification_needed' && scheduleOutput.missingInformation) {
        contextForReplies = `AI: ${aiResponseContent} Please provide: ${scheduleOutput.missingInformation}.`;
    }

    const repliesResult = await generateSuggestedReplies({ latestMessage: contextForReplies });
    newSuggestedReplies = repliesResult.suggestedReplies;

    // Add context-specific suggestions if AI returned alternatives or needs clarification
    if (scheduleOutput?.intent === 'pending_alternatives' && scheduleOutput.suggestedSlots) {
        const slotSuggestions = scheduleOutput.suggestedSlots.slice(0, 2).map(slot => 
            `Book ${scheduleOutput.appointmentDetails?.service || 'service'} ${slot.date} ${slot.time}`
        );
        newSuggestedReplies = [...slotSuggestions, ...newSuggestedReplies.filter(r => !slotSuggestions.some(s => r.includes(s.split(' ')[1])))].slice(0,3);
    } else if (scheduleOutput?.intent === 'clarification_needed' && scheduleOutput.missingInformation) {
        newSuggestedReplies.unshift(`Provide ${scheduleOutput.missingInformation}`);
        newSuggestedReplies = newSuggestedReplies.slice(0,3);
    }


  } catch (error) {
    console.error('Error generating new suggested replies:', error);
    newSuggestedReplies = (hasSchedulingIntent && scheduleOutput?.intent !== 'booked' && scheduleOutput?.intent !== 'cancelled')
      ? ['Confirm suggested time', 'Ask for other times', 'Cancel request'] 
      : ['Tell me more', 'Ask something else', 'Thanks!'];
  }
  // Ensure no duplicate suggestions and limit to 3
  newSuggestedReplies = [...new Set(newSuggestedReplies)].slice(0, 3);


  return { aiMessage: finalAiMessage, newSuggestedReplies, updatedAppointment: processedAppointment };
}
