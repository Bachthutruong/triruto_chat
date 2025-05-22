
// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { ChatInterface } from '@/components/chat/ChatInterface';
import type { Message, UserSession, Conversation, MessageViewerRole, AppointmentBookingFormData } from '@/lib/types';
import { 
  handleCustomerAccess, 
  processUserMessage, 
  // createNewConversationForUser, // Removed as it's not exported from actions
  getConversationHistory, 
  getUserConversations,
  getMessagesByIds,
  updateConversationTitle,
  pinConversationForUser,
  unpinConversationForUser,
  pinMessageToConversation,
  unpinMessageFromConversation,
  deleteStaffMessage,
  editStaffMessage,
  handleBookAppointmentFromForm,
} from './actions'; 
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { getAppSettings } from './actions';
import { AppointmentBookingForm } from '@/components/chat/AppointmentBookingForm';
import { useSocket } from '@/contexts/SocketContext'; 
import { cn } from '@/lib/utils';
import { ChatWindow } from '@/components/chat/ChatWindow';

export default function HomePage() {
  const [currentUserSession, setCurrentUserSession] = useState<UserSession | null>(null);
  const [initialSessionFromStorage, setInitialSessionFromStorage] = useState<UserSession | null>(null);

  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [currentSuggestedReplies, setCurrentSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname(); 
  const appSettingsContext = useAppSettingsContext();
  const [brandName, setBrandName] = useState('AetherChat');

  const usersTypingMapRef = useRef<Record<string, string>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    const updateBrandName = async () => {
      if (appSettingsContext?.brandName) {
        setBrandName(appSettingsContext.brandName);
      } else {
        const settings = await getAppSettings();
        setBrandName(settings?.brandName || 'AetherChat');
      }
    };
    updateBrandName();
  }, [appSettingsContext]);

  const loadConversation = useCallback(async (conversationId: string, customerId?: string) => {
    if (!customerId && (!currentUserSession || currentUserSession.role !== 'customer')) {
      console.warn("loadConversation called without customerId and no customer session");
      setIsChatLoading(false);
      return;
    }
    const effectiveCustomerId = customerId || currentUserSession?.id;
    if (!effectiveCustomerId) {
      console.warn("loadConversation: effectiveCustomerId is undefined");
      setIsChatLoading(false);
      return;
    }

    setIsChatLoading(true);
    try {
      const messagesFromHistory = await getConversationHistory(conversationId);
      setCurrentMessages(messagesFromHistory); // This loads history, greeting is handled by initial load
      setActiveConversationId(conversationId);

      // Suggested replies logic: show only if chat is very new and based on admin settings
      const currentAppSettings = appSettingsContext || await getAppSettings();
      if (messagesFromHistory.length <= 2 && currentAppSettings?.suggestedQuestions && currentAppSettings.suggestedQuestions.length > 0 && messagesFromHistory.some(m => m.sender === 'ai' && m.content.startsWith('Chào'))) {
         // If it's the initial greeting, retain admin-configured suggested questions
         // This condition might need adjustment based on how `initialMessages` from `handleCustomerAccess` is structured
      } else {
        setCurrentSuggestedReplies([]); // Clear for ongoing chats
      }

      setCurrentUserSession(prev => {
        if (prev && prev.id === effectiveCustomerId) {
          const updatedSession = { ...prev, currentConversationId: conversationId };
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('aetherChatUserSession', JSON.stringify(updatedSession));
          }
          return updatedSession;
        }
        return prev;
      });

    } catch (error) {
      console.error("Lỗi tải cuộc trò chuyện:", error);
      toast({ title: "Lỗi", description: "Không thể tải cuộc trò chuyện.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  }, [toast, appSettingsContext, currentUserSession]); // Removed loadConversation from its own deps

  const loadInitialData = useCallback(async (session: UserSession) => {
    if (session.role !== 'customer' || !session.id) {
      setIsLoadingSession(false);
      return;
    }
    setIsLoadingSession(true);
    try {
      const { 
        userSession: updatedSession, 
        initialMessages, 
        initialSuggestedReplies, 
        activeConversationId: primaryConvId, 
        conversations: customerConversations 
      } = await handleCustomerAccess(session.phoneNumber);

      setCurrentUserSession(updatedSession);
      // initialMessages from handleCustomerAccess should now contain the greeting + history
      setCurrentMessages(initialMessages); 
      setCurrentSuggestedReplies(initialSuggestedReplies);
      setActiveConversationId(primaryConvId);
      setConversations(customerConversations); 
      
      // DO NOT call loadConversation here for the primaryConvId, 
      // as initialMessages from handleCustomerAccess already contains the full initial state.
      // loadConversation is for when the user explicitly switches to another (older) conversation.

    } catch (error) {
      console.error("Lỗi tải dữ liệu ban đầu:", error);
      toast({ title: "Lỗi", description: "Không thể tải dữ liệu trò chuyện.", variant: "destructive" });
      if (typeof window !== 'undefined') { 
        sessionStorage.removeItem('aetherChatUserSession');
        router.replace('/enter-phone');
      }
    } finally {
      setIsLoadingSession(false);
    }
  }, [toast, router]); 


  useEffect(() => {
    setIsLoadingSession(true);
    const storedSessionString = sessionStorage.getItem('aetherChatUserSession');
    if (storedSessionString) {
      try {
        const session: UserSession = JSON.parse(storedSessionString);
        setInitialSessionFromStorage(session); // Set intermediary state
      } catch (error) {
        console.error("Lỗi phân tích cú pháp session từ sessionStorage:", error);
        sessionStorage.removeItem('aetherChatUserSession');
        router.replace('/enter-phone');
      }
    } else {
      if (pathname !== '/enter-phone') {
        router.replace('/enter-phone');
      } else {
        setIsLoadingSession(false); 
      }
    }
  }, [router, pathname]); // router.pathname to re-check if path changes

  useEffect(() => {
    if (initialSessionFromStorage) {
      if (initialSessionFromStorage.role === 'customer') {
        setCurrentUserSession(initialSessionFromStorage); // Set current user session
        loadInitialData(initialSessionFromStorage);       // Then load initial data
      } else if (initialSessionFromStorage.role === 'admin' || initialSessionFromStorage.role === 'staff') {
        setCurrentUserSession(initialSessionFromStorage); 
        setIsLoadingSession(false); 
      } else {
        setIsLoadingSession(false);
      }
    } else if (router && router.pathname && !router.pathname.startsWith('/enter-phone')) { 
      setIsLoadingSession(false);
    }
  }, [initialSessionFromStorage, loadInitialData, router]); // router is stable, router.pathname is not


  useEffect(() => {
    if (!socket || !isConnected || !activeConversationId || !currentUserSession || currentUserSession.role !== 'customer') {
      return;
    }

    console.log(`Customer ${currentUserSession.id} joining room: ${activeConversationId}`);
    socket.emit('joinRoom', activeConversationId);

    const handleNewMessage = (newMessage: Message) => {
      console.log('Customer received new message via socket:', newMessage);
      if (newMessage.conversationId === activeConversationId && newMessage.userId !== currentUserSession?.id) {
        setCurrentMessages(prev => {
          if (prev.find(m => m.id === newMessage.id)) return prev; // Avoid duplicates
          return [...prev, newMessage];
        });
      }
    };

    const handleUserTyping = ({ userId: typingUserId, userName, conversationId: incomingConvId }: { userId: string, userName: string, conversationId: string }) => {
      if (incomingConvId === activeConversationId && typingUserId !== currentUserSession?.id) {
        usersTypingMapRef.current[typingUserId] = userName;
        setTypingUsers({ ...usersTypingMapRef.current });
      }
    };

    const handleUserStopTyping = ({ userId: typingUserId, conversationId: incomingConvId }: { userId: string, conversationId: string }) => {
      if (incomingConvId === activeConversationId && typingUserId !== currentUserSession?.id) {
        delete usersTypingMapRef.current[typingUserId];
        setTypingUsers({ ...usersTypingMapRef.current });
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);

    return () => {
      if (socket && activeConversationId && currentUserSession) {
        console.log(`Customer ${currentUserSession.id} leaving room: ${activeConversationId}`);
        socket.emit('leaveRoom', activeConversationId);
        socket.off('newMessage', handleNewMessage);
        socket.off('userTyping', handleUserTyping);
        socket.off('userStopTyping', handleUserStopTyping);
      }
    };
  }, [socket, isConnected, activeConversationId, currentUserSession]);


  const handleLogout = () => {
    const currentSessionString = sessionStorage.getItem('aetherChatUserSession');
    let role: UserSession['role'] | null = null;
    if (currentSessionString) {
      try {
        role = JSON.parse(currentSessionString).role;
      } catch (e) { /* ignore */ }
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if(socket && activeConversationId && currentUserSession?.id && onTyping) {
        onTyping(false); // Emit stop typing on logout
    }


    setCurrentUserSession(null);
    setInitialSessionFromStorage(null);
    sessionStorage.removeItem('aetherChatUserSession');
    setCurrentMessages([]);
    setCurrentSuggestedReplies([]);
    setActiveConversationId(null);
    setConversations([]);
    setTypingUsers({});


    if (role === 'admin' || role === 'staff') {
      router.push('/login');
    } else {
      router.push('/enter-phone');
    }
  };

  const onTyping = (isTypingStatus: boolean) => {
    if (!socket || !isConnected || !activeConversationId || !currentUserSession) return;
    if (isTypingStatus) {
      socket.emit('typing', { conversationId: activeConversationId, userName: currentUserSession.name || `User ${currentUserSession.id.slice(-4)}` });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    } else {
      // Debounce stopTyping event
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (socket && isConnected) socket.emit('stopTyping', { conversationId: activeConversationId, userId: currentUserSession.id });
      }, 1500); 
    }
  };


  const handleSendMessage = async (messageContent: string) => {
    if (!currentUserSession || !activeConversationId) return;

    const userMessage: Message = {
      id: `msg_local_user_${Date.now()}`,
      sender: 'user',
      content: messageContent,
      timestamp: new Date(),
      conversationId: activeConversationId,
      name: currentUserSession.name || `Người dùng ${currentUserSession.phoneNumber}`,
      userId: currentUserSession.id,
    };

    setCurrentMessages((prevMessages) => [...prevMessages, userMessage]);
    setCurrentSuggestedReplies([]); 
    setIsChatLoading(true);
    if (socket && isConnected && onTyping) {
      onTyping(false); // Ensure typing indicator stops
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }


    try {
      const { userMessage: savedUserMessage, aiMessage, updatedAppointment } = await processUserMessage(
        messageContent,
        currentUserSession,
        activeConversationId,
        [...currentMessages, userMessage] // Send the current view of messages for history
      );

      // Replace local message with saved one and add AI message
      setCurrentMessages((prevMessages) => [
        ...prevMessages.filter(m => m.id !== userMessage.id), // Remove local optimistic message
        savedUserMessage, // Add saved user message from server
        aiMessage // Add AI message from server
      ]);

      // Emit messages to other clients via socket
      if (socket && isConnected) {
        socket.emit('sendMessage', { message: savedUserMessage, conversationId: activeConversationId });
        socket.emit('sendMessage', { message: aiMessage, conversationId: activeConversationId });
      }


      if (updatedAppointment) {
        // Handle appointment update UI if needed, e.g., toast or update an appointments list
        toast({
          title: "Cập nhật lịch hẹn",
          description: `Dịch vụ: ${updatedAppointment.service}, Ngày: ${updatedAppointment.date}, Giờ: ${updatedAppointment.time}, Trạng thái: ${updatedAppointment.status}`,
        });
      }

    } catch (error) {
      console.error("Lỗi xử lý tin nhắn:", error);
      // Remove the optimistic local message if an error occurred
      const errorMessage: Message = {
        id: `msg_error_${Date.now()}`,
        sender: 'system',
        content: 'Xin lỗi, tôi gặp lỗi. Vui lòng thử lại.',
        timestamp: new Date(),
        conversationId: activeConversationId,
      };
      setCurrentMessages((prevMessages) => [...prevMessages.filter(m => m.id !== userMessage.id), errorMessage]); 
      toast({
        title: "Lỗi tin nhắn",
        description: "Không thể xử lý tin nhắn của bạn. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const renderCustomerChatInterface = () => {
    if (!currentUserSession || !activeConversationId) {
      return <div className="flex-grow flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    return (
      <ChatInterface
        userSession={currentUserSession}
        conversations={conversations} // This is empty for customers as they see only one conversation
        activeConversationId={activeConversationId}
        messages={currentMessages}
        pinnedMessages={currentMessages.filter(m => m.isPinned)}
        suggestedReplies={currentSuggestedReplies}
        onSendMessage={handleSendMessage}
        onSelectConversation={(convId) => {
          if (currentUserSession.id && convId !== activeConversationId) { // Only load if different
            loadConversation(convId, currentUserSession.id);
          }
        }}
        // onCreateNewConversation is not for customers in this single-conversation model
        isChatLoading={isChatLoading || isLoadingSession}
        viewerRole="customer_view" 
        // Pinning and title updates are not for customer view in this model
        onBookAppointmentClick={() => setIsBookingModalOpen(true)}
        onTyping={onTyping}
      />
    );
  };

  const handleDirectBookAppointment = async (formData: AppointmentBookingFormData) => {
    if (!currentUserSession || !activeConversationId) return;
    setIsChatLoading(true);
    try {
      const result = await handleBookAppointmentFromForm(formData);
      toast({
        title: result.success ? "Thành công" : "Thất bại",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });

      let systemMessageContent = result.message;
      if (!result.success && result.suggestedSlots && result.suggestedSlots.length > 0) {
        systemMessageContent += "\nCác khung giờ gợi ý khác:\n" +
          result.suggestedSlots.map(s => `- ${s.date} lúc ${s.time}`).join("\n");
      }

      const systemMessage: Message = {
        id: `msg_system_booking_${Date.now()}`,
        sender: 'system',
        content: systemMessageContent,
        timestamp: new Date(),
        conversationId: activeConversationId,
      };
      setCurrentMessages(prev => [...prev, systemMessage]);
      if (socket && isConnected) {
        socket.emit('sendMessage', { message: systemMessage, conversationId: activeConversationId });
      }
      if(result.success) setIsBookingModalOpen(false);

    } catch (error: any) {
      toast({ title: "Lỗi đặt lịch", description: error.message || "Không thể đặt lịch hẹn.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  };

  const renderContent = () => {
    if (isLoadingSession || (!initialSessionFromStorage && (router && router.pathname && !router.pathname.startsWith('/enter-phone')))) {
      return (
        <div className="flex flex-col items-center justify-center h-full flex-grow">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Đang tải {brandName}...</p>
        </div>
      );
    }

    if (currentUserSession) {
      if (currentUserSession.role === 'admin') {
        return (
          <div className="flex-grow flex items-center justify-center p-4">
            <Card className="w-full max-w-md text-center shadow-xl mx-auto my-auto">
              <CardHeader>
                <CardTitle>Truy cập Admin</CardTitle>
                <CardDescription>Chào mừng, {currentUserSession.name || 'Admin'}.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4">Bạn đã đăng nhập với tư cách Admin.</p>
                <Button asChild>
                  <Link href="/admin/dashboard">
                    <LogIn className="mr-2 h-4 w-4" /> Đến Bảng điều khiển Admin
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      }

      if (currentUserSession.role === 'staff') {
        return (
          <div className="flex-grow flex items-center justify-center p-4">
            <Card className="w-full max-w-md text-center shadow-xl mx-auto my-auto">
              <CardHeader>
                <CardTitle>Truy cập Nhân viên</CardTitle>
                <CardDescription>Chào mừng, {currentUserSession.name || 'Nhân viên'}.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4">Bạn đã đăng nhập với tư cách Nhân viên.</p>
                <Button asChild>
                  <Link href="/staff/dashboard">
                    <LogIn className="mr-2 h-4 w-4" /> Đến Bảng điều khiển Nhân viên
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      }
      // Customer View
      return (
        <div className="flex-grow flex flex-col items-stretch w-full overflow-hidden h-full">
          {renderCustomerChatInterface()}
        </div>
      );
    }
    // If no currentUserSession and not loading, it means user should be at /enter-phone or login
    // This case is usually handled by the redirects in useEffect, but as a fallback:
    if (pathname !== '/enter-phone' && pathname !== '/login' && pathname !== '/register') {
        return (
             <div className="flex-grow flex items-center justify-center p-4">
                <p>Đang chuyển hướng...</p>
             </div>
        )
    }
    return null; 
  };

  return (
    <div className="flex flex-col min-h-screen bg-background h-screen">
      <AppHeader userSession={currentUserSession} onLogout={handleLogout} />
      <main className={cn(
        "flex-grow flex items-stretch w-full overflow-hidden pt-16",
        currentUserSession?.role !== 'customer' && "items-center justify-center",
        currentUserSession?.role === 'customer' ? "h-[calc(100vh-4rem)]" : "h-auto" // Full height for customer chat
      )}>
        {renderContent()}
      </main>
      {currentUserSession?.role === 'customer' && activeConversationId && (
        <AppointmentBookingForm
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          onSubmit={handleDirectBookAppointment}
          currentUserSession={currentUserSession}
        />
      )}
    </div>
  );
}

    