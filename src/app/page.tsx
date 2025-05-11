'use client';

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { PhoneNumberModal } from '@/components/chat/PhoneNumberModal';
import { ChatWindow } from '@/components/chat/ChatWindow';
import type { Message, UserSession, AppointmentDetails } from '@/lib/types';
import { identifyUserAndLoadData, processUserMessage } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';

export default function HomePage() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPhoneModal, setShowPhoneModal] = useState<boolean>(true); // Start with modal open
  const { toast } = useToast();

  // Effect to ensure modal state is client-side after hydration
  useEffect(() => {
    setShowPhoneModal(true); 
  }, []);


  const handlePhoneNumberSubmit = async (phoneNumber: string) => {
    setIsLoading(true);
    try {
      const { userSession: session, initialMessages, initialSuggestedReplies } = await identifyUserAndLoadData(phoneNumber);
      setUserSession(session);
      setMessages(initialMessages);
      setSuggestedReplies(initialSuggestedReplies);
      setShowPhoneModal(false);
      toast({
        title: "Chat Started",
        description: session.name ? `Welcome back, ${session.name}!` : "Welcome to AetherChat!",
      });
    } catch (error) {
      console.error("Error identifying user:", error);
      toast({
        title: "Error",
        description: "Could not start chat session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (messageContent: string) => {
    if (!userSession) return;

    const userMessage: Message = {
      id: `msg_local_user_${Date.now()}`,
      sender: 'user',
      content: messageContent,
      timestamp: new Date(),
      name: userSession.name || 'User',
    };
    
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setSuggestedReplies([]); // Clear old suggestions
    setIsLoading(true);

    try {
      const { aiMessage, newSuggestedReplies, appointment } = await processUserMessage(
        messageContent,
        userSession,
        [...messages, userMessage] // send current history including new user message
      );
      
      setMessages((prevMessages) => [...prevMessages, aiMessage]);
      setSuggestedReplies(newSuggestedReplies);

      if (appointment) {
        toast({
          title: "Appointment Update",
          description: `Service: ${appointment.service}, Date: ${appointment.date}, Time: ${appointment.time}`,
        });
      }

    } catch (error) {
      console.error("Error processing message:", error);
      const errorMessage: Message = {
        id: `msg_error_${Date.now()}`,
        sender: 'system',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
       toast({
        title: "Message Error",
        description: "Could not process your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <AppHeader />
      <main className="flex-grow container mx-auto py-8 px-4 flex justify-center items-center">
        {showPhoneModal && !userSession && (
          <PhoneNumberModal
            isOpen={showPhoneModal}
            onSubmit={handlePhoneNumberSubmit}
            isLoading={isLoading}
          />
        )}
        
        {userSession && (
          <Card className="w-full max-w-2xl h-[70vh] shadow-2xl rounded-lg flex flex-col">
            <CardContent className="p-0 flex-grow flex flex-col overflow-hidden">
              <ChatWindow
                userSession={userSession}
                messages={messages}
                suggestedReplies={suggestedReplies}
                onSendMessage={handleSendMessage}
                onSuggestedReplyClick={handleSendMessage} // Clicking a suggestion sends it as a message
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
