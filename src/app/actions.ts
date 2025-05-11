// src/app/actions.ts
'use server';

import type { Message, UserSession, AppointmentDetails } from '@/lib/types';
import { answerUserQuestion } from '@/ai/flows/answer-user-question';
import { generateSuggestedReplies } from '@/ai/flows/generate-suggested-replies';
import { scheduleAppointment } from '@/ai/flows/schedule-appointment';

// Mock database for users and chat history
const MOCK_USERS: Record<string, UserSession> = {
  '1234567890': {
    id: 'user_123',
    phoneNumber: '1234567890',
    name: 'Jane Doe',
    chatHistory: [
      { id: 'hist_1', sender: 'system', content: 'Chat history loaded for Jane Doe.', timestamp: new Date(Date.now() - 3600000) },
      { id: 'hist_2', sender: 'user', content: 'Hello!', timestamp: new Date(Date.now() - 3500000) },
      { id: 'hist_3', sender: 'ai', content: 'Hi Jane, how can I help you today?', timestamp: new Date(Date.now() - 3400000) },
    ],
  },
};
let MOCK_USER_ID_COUNTER = 0;

const MOCK_APPOINTMENTS: AppointmentDetails[] = [];

function formatChatHistoryForAI(messages: Message[]): string {
  return messages
    .map(msg => `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.content}`)
    .join('\\n');
}

export async function identifyUserAndLoadData(phoneNumber: string): Promise<{
  userSession: UserSession;
  initialMessages: Message[];
  initialSuggestedReplies: string[];
}> {
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

  let user = MOCK_USERS[phoneNumber];
  const isNewUser = !user;

  if (isNewUser) {
    MOCK_USER_ID_COUNTER++;
    const newUserId = `user_guest_${MOCK_USER_ID_COUNTER}`;
    user = {
      id: newUserId,
      phoneNumber,
      chatHistory: [],
    };
    MOCK_USERS[phoneNumber] = user; // Save new user to mock DB
  }

  const welcomeMessageContent = isNewUser
    ? `Welcome to AetherChat! I'm your AI assistant. How can I help you today? You can ask me questions or request to schedule an appointment.`
    : `Welcome back${user.name ? ', ' + user.name : ''}! How can I assist you today?`;

  const welcomeMessage: Message = {
    id: `msg_${Date.now()}`,
    sender: 'ai',
    content: welcomeMessageContent,
    timestamp: new Date(),
  };

  const initialMessages = [...(user.chatHistory || []), welcomeMessage];
  
  // Update user's chat history in mock DB
  user.chatHistory = initialMessages;
  MOCK_USERS[phoneNumber] = user;

  let suggestedReplies: string[] = [];
  try {
    const repliesResult = await generateSuggestedReplies({ latestMessage: welcomeMessageContent });
    suggestedReplies = repliesResult.suggestedReplies;
  } catch (error) {
    console.error('Error generating initial suggested replies:', error);
    suggestedReplies = ['Ask about services', 'Schedule an appointment', 'General inquiry'];
  }
  
  return {
    userSession: { id: user.id, phoneNumber: user.phoneNumber, name: user.name }, // Return only essential session info
    initialMessages,
    initialSuggestedReplies: suggestedReplies,
  };
}


export async function processUserMessage(
  userMessageContent: string,
  currentUserSession: UserSession,
  currentChatHistory: Message[]
): Promise<{ aiMessage: Message; newSuggestedReplies: string[]; appointment?: AppointmentDetails }> {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate AI processing delay

  const userMessage: Message = {
    id: `msg_user_${Date.now()}`,
    sender: 'user',
    content: userMessageContent,
    timestamp: new Date(),
    name: currentUserSession.name || 'User',
  };

  const updatedChatHistory = [...currentChatHistory, userMessage];
  // Update history in mock DB
  if (MOCK_USERS[currentUserSession.phoneNumber]) {
    MOCK_USERS[currentUserSession.phoneNumber].chatHistory = updatedChatHistory;
  }
  
  const formattedHistory = formatChatHistoryForAI(updatedChatHistory.slice(-10)); // Use recent history

  let aiResponseContent: string;
  let appointmentDetails: AppointmentDetails | undefined = undefined;

  // Basic intent detection for scheduling
  const schedulingKeywords = ['book', 'schedule', 'appointment', 'meeting', 'reserve'];
  const hasSchedulingIntent = schedulingKeywords.some(keyword => userMessageContent.toLowerCase().includes(keyword));

  if (hasSchedulingIntent) {
    try {
      const scheduleResult = await scheduleAppointment({
        userInput: userMessageContent,
        phoneNumber: currentUserSession.phoneNumber,
      });
      aiResponseContent = scheduleResult.confirmationMessage;
      if (scheduleResult.appointmentDetails) {
        appointmentDetails = scheduleResult.appointmentDetails;
        // Simulate saving appointment
        MOCK_APPOINTMENTS.push(appointmentDetails); 
        aiResponseContent += `\\nAppointment for ${appointmentDetails.service} on ${appointmentDetails.date} at ${appointmentDetails.time} has been noted.`;
      }
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      aiResponseContent = "I encountered an issue trying to schedule your appointment. Could you please try rephrasing or provide more details?";
    }
  } else {
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

  const aiMessage: Message = {
    id: `msg_ai_${Date.now()}`,
    sender: 'ai',
    content: aiResponseContent,
    timestamp: new Date(),
    name: 'AetherChat AI',
  };
  
  // Update history with AI message in mock DB
  if (MOCK_USERS[currentUserSession.phoneNumber]) {
     MOCK_USERS[currentUserSession.phoneNumber].chatHistory?.push(aiMessage);
  }

  let newSuggestedReplies: string[] = [];
  try {
    const repliesResult = await generateSuggestedReplies({ latestMessage: aiResponseContent });
    newSuggestedReplies = repliesResult.suggestedReplies;
  } catch (error) {
    console.error('Error generating new suggested replies:', error);
    // Fallback suggestions
    newSuggestedReplies = hasSchedulingIntent 
      ? ['Confirm appointment', 'Change time', 'Cancel booking'] 
      : ['Tell me more', 'Ask something else', 'Thanks!'];
  }

  return { aiMessage, newSuggestedReplies, appointment: appointmentDetails };
}
