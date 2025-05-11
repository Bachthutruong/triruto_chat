'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { PhoneNumberModal } from '@/components/chat/PhoneNumberModal';
import { ChatWindow } from '@/components/chat/ChatWindow';
import type { Message, UserSession, UserRole } from '@/lib/types';
import { identifyUserAndLoadData, processUserMessage } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export default function HomePage() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPhoneModal, setShowPhoneModal] = useState<boolean>(true);
  const { toast } = useToast();

  useEffect(() => {
    const storedSession = sessionStorage.getItem('aetherChatUserSession');
    if (storedSession) {
      const session: UserSession = JSON.parse(storedSession);
      setUserSession(session);
      setShowPhoneModal(false);
      // If customer, load their messages etc.
      if (session.role === 'customer') {
        // This part would ideally re-fetch or use more persistent storage for messages
        // For now, if session exists, we assume messages might need to be reloaded or were part of session
        // For simplicity, let's assume identifyUserAndLoadData would handle this if called again.
        // Or, store messages in session/local storage too (careful with size).
         handlePhoneNumberSubmit(session.phoneNumber, true); // Re-init session, potentially loading messages
      }
    } else {
      setShowPhoneModal(true);
    }
  }, []);

  const handlePhoneNumberSubmit = async (phoneNumber: string, isSessionRestore = false) => {
    setIsLoading(true);
    try {
      const { userSession: session, initialMessages, initialSuggestedReplies } = await identifyUserAndLoadData(phoneNumber);
      setUserSession(session);
      sessionStorage.setItem('aetherChatUserSession', JSON.stringify(session));
      
      if (session.role === 'customer') {
        setMessages(initialMessages || []);
        setSuggestedReplies(initialSuggestedReplies || []);
      }
      setShowPhoneModal(false);

      if (!isSessionRestore) {
        toast({
          title: session.role === 'customer' ? "Chat Started" : "Access Granted",
          description: session.name ? 
            (session.role === 'customer' ? `Welcome back, ${session.name}!` : `Welcome, ${session.name}!`)
            : (session.role === 'customer' ? "Welcome to AetherChat!" : `Access for ${session.role}.`),
        });
      }
    } catch (error) {
      console.error("Error identifying user:", error);
      toast({
        title: "Error",
        description: "Could not start session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (messageContent: string) => {
    if (!userSession || userSession.role !== 'customer') return;

    const userMessage: Message = {
      id: `msg_local_user_${Date.now()}`,
      sender: 'user',
      content: messageContent,
      timestamp: new Date(),
      name: userSession.name || 'User',
    };
    
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setSuggestedReplies([]);
    setIsLoading(true);

    try {
      const { aiMessage, newSuggestedReplies, updatedAppointment } = await processUserMessage(
        messageContent,
        userSession,
        [...messages, userMessage]
      );
      
      setMessages((prevMessages) => [...prevMessages, aiMessage]);
      setSuggestedReplies(newSuggestedReplies);

      if (updatedAppointment) {
        toast({
          title: "Appointment Update",
          description: `Service: ${updatedAppointment.service}, Date: ${updatedAppointment.date}, Time: ${updatedAppointment.time}, Status: ${updatedAppointment.status}`,
        });
        // Update userSession's appointments if needed, or rely on next load
        if (userSession.appointments) {
            const existingIndex = userSession.appointments.findIndex(a => a.appointmentId === updatedAppointment.appointmentId);
            if (existingIndex > -1) {
                userSession.appointments[existingIndex] = updatedAppointment;
            } else {
                userSession.appointments.push(updatedAppointment);
            }
            setUserSession({...userSession}); // Trigger re-render if needed
        }
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

  const renderContent = () => {
    if (showPhoneModal && !userSession) {
      return (
        <PhoneNumberModal
          isOpen={showPhoneModal}
          onSubmit={handlePhoneNumberSubmit}
          isLoading={isLoading}
        />
      );
    }

    if (userSession) {
      if (userSession.role === 'admin') {
        return (
          <Card className="w-full max-w-md text-center shadow-xl">
            <CardHeader>
              <CardTitle>Admin Access</CardTitle>
              <CardDescription>Welcome, {userSession.name || 'Admin'}.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">This is the customer-facing chat. Please use the admin dashboard for your tasks.</p>
              <Button asChild>
                <Link href="/admin/dashboard">
                  <LogIn className="mr-2 h-4 w-4" /> Go to Admin Dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      }

      if (userSession.role === 'staff') {
        return (
          <Card className="w-full max-w-md text-center shadow-xl">
            <CardHeader>
              <CardTitle>Staff Access</CardTitle>
              <CardDescription>Welcome, {userSession.name || 'Staff Member'}.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">This is the customer-facing chat. Please use the staff dashboard to manage customer interactions.</p>
              <Button asChild>
                <Link href="/staff/dashboard">
                  <LogIn className="mr-2 h-4 w-4" /> Go to Staff Dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      }

      // Role is 'customer'
      return (
        <Card className="w-full max-w-2xl h-[70vh] shadow-2xl rounded-lg flex flex-col">
          <CardContent className="p-0 flex-grow flex flex-col overflow-hidden">
            <ChatWindow
              userSession={userSession}
              messages={messages}
              suggestedReplies={suggestedReplies}
              onSendMessage={handleSendMessage}
              onSuggestedReplyClick={handleSendMessage}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      );
    }
    return null; // Should not happen if logic is correct
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <AppHeader userSession={userSession} onLogout={() => { setUserSession(null); sessionStorage.removeItem('aetherChatUserSession'); setShowPhoneModal(true); }}/>
      <main className="flex-grow container mx-auto py-8 px-4 flex justify-center items-center">
        {renderContent()}
      </main>
      <AppFooter />
    </div>
  );
}
