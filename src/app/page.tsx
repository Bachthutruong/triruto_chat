// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Added for redirection
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { PhoneNumberModal } from '@/components/chat/PhoneNumberModal';
import { ChatWindow } from '@/components/chat/ChatWindow';
import type { Message, UserSession } from '@/lib/types';
import { handleCustomerAccess, processUserMessage } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export default function HomePage() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPhoneModal, setShowPhoneModal] = useState<boolean>(true); // Show by default if no session
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const storedSessionString = sessionStorage.getItem('aetherChatUserSession');
    if (storedSessionString) {
      try {
        const session: UserSession = JSON.parse(storedSessionString);
        setUserSession(session);
        setShowPhoneModal(false); // Hide modal if session exists

        if (session.role === 'customer') {
          // For customers, re-fetch initial data based on their session
          // This ensures chat history and other details are loaded correctly
          initializeCustomerSession(session.phoneNumber, true);
        } else if (session.role === 'admin') {
           // router.push('/admin/dashboard'); // Redirect if already logged in
        } else if (session.role === 'staff') {
           // router.push('/staff/dashboard'); // Redirect if already logged in
        }
      } catch (error) {
        console.error("Error parsing session from sessionStorage:", error);
        sessionStorage.removeItem('aetherChatUserSession'); // Clear corrupted session
        setShowPhoneModal(true); // Show modal if session is corrupted
      }
    } else {
      setShowPhoneModal(true); // No session, show modal
    }
  }, [router]);

  const initializeCustomerSession = async (phoneNumber: string, isSessionRestore = false) => {
    setIsLoading(true);
    try {
      // handleCustomerAccess is now specifically for customers
      const { userSession: custSession, initialMessages, initialSuggestedReplies } = await handleCustomerAccess(phoneNumber);
      
      // Important: custSession from handleCustomerAccess is now a customer-specific session.
      // We need to store this, not the generic one from sessionStorage if it was admin/staff.
      setUserSession(custSession); 
      sessionStorage.setItem('aetherChatUserSession', JSON.stringify(custSession)); // Store customer session
      
      setMessages(initialMessages || []);
      setSuggestedReplies(initialSuggestedReplies || []);
      setShowPhoneModal(false);

      if (!isSessionRestore) {
        toast({
          title: "Chat Started",
          description: custSession.name ? `Welcome back, ${custSession.name}!` : "Welcome to AetherChat!",
        });
      }
    } catch (error) {
      console.error("Error initializing customer session:", error);
      toast({
        title: "Error",
        description: "Could not start chat session. Please try again.",
        variant: "destructive",
      });
      // Potentially clear session if init fails
      sessionStorage.removeItem('aetherChatUserSession');
      setUserSession(null);
      setShowPhoneModal(true);
    } finally {
      setIsLoading(false);
    }
  };


  const handlePhoneNumberSubmit = async (phoneNumber: string) => {
    // This function is now solely for initiating a *customer* chat.
    // Staff/admin login is handled by /login page.
    // We could add a check here: if phone number matches a known staff/admin, guide them.
    // For now, we assume any number entered here is for customer chat.
    await initializeCustomerSession(phoneNumber);
  };

  const handleLogout = () => {
    setUserSession(null);
    sessionStorage.removeItem('aetherChatUserSession');
    setMessages([]);
    setSuggestedReplies([]);
    setShowPhoneModal(true); 
    router.push('/'); // Go to home page, which will show phone modal
  };


  const handleSendMessage = async (messageContent: string) => {
    if (!userSession || userSession.role !== 'customer') return;

    const userMessage: Message = {
      id: `msg_local_user_${Date.now()}`, // Temporary local ID
      sender: 'user',
      content: messageContent,
      timestamp: new Date(),
      name: userSession.name || 'User',
    };
    
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setSuggestedReplies([]); // Clear old suggestions
    setIsLoading(true); // For AI response

    try {
      // currentUserSession.id is the Customer's MongoDB _id string
      const { aiMessage, newSuggestedReplies, updatedAppointment } = await processUserMessage(
        messageContent,
        userSession, // This userSession is specifically the customer's session
        [...messages, userMessage] // Pass current client-side messages for context if needed by AI
      );
      
      // Replace local user message with the one from DB if IDs differ (or just add AI message)
      setMessages((prevMessages) => {
        // This logic might need refinement if you want to update the local user message ID with the DB ID
        // For simplicity, just add the AI message. The chat history will rebuild from DB on refresh.
        return [...prevMessages, aiMessage];
      });
      setSuggestedReplies(newSuggestedReplies);

      if (updatedAppointment) {
        toast({
          title: "Appointment Update",
          description: `Service: ${updatedAppointment.service}, Date: ${updatedAppointment.date}, Time: ${updatedAppointment.time}, Status: ${updatedAppointment.status}`,
        });
        // Optionally update local session's appointment list if displaying it directly
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
    if (userSession) { // A session exists
      if (userSession.role === 'admin') {
        return (
          <Card className="w-full max-w-md text-center shadow-xl">
            <CardHeader>
              <CardTitle>Admin Access</CardTitle>
              <CardDescription>Welcome, {userSession.name || 'Admin'}.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">You are logged in as an Admin.</p>
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
              <p className="mb-4">You are logged in as Staff.</p>
              <Button asChild>
                <Link href="/staff/dashboard">
                  <LogIn className="mr-2 h-4 w-4" /> Go to Staff Dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      }

      // Role is 'customer', show chat window
      return (
        <Card className="w-full max-w-2xl h-[70vh] shadow-2xl rounded-lg flex flex-col">
          <CardContent className="p-0 flex-grow flex flex-col overflow-hidden">
            <ChatWindow
              userSession={userSession}
              messages={messages}
              suggestedReplies={suggestedReplies}
              onSendMessage={handleSendMessage}
              onSuggestedReplyClick={handleSendMessage} // A suggested reply is also a message sent by user
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      );
    }

    // No session, and modal should be shown
    if (showPhoneModal) {
      return (
        <PhoneNumberModal
          isOpen={showPhoneModal}
          onSubmit={handlePhoneNumberSubmit} // This is for customers
          isLoading={isLoading}
        />
      );
    }
    
    // Fallback, though ideally one of the above conditions should always be met.
    return <p>Loading AetherChat...</p>; 
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <AppHeader userSession={userSession} onLogout={handleLogout}/>
      <main className="flex-grow container mx-auto py-8 px-4 flex justify-center items-center">
        {renderContent()}
      </main>
      <AppFooter />
    </div>
  );
}
