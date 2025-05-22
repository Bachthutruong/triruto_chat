
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
  createNewConversationForUser,
  getUserConversations,
  getMessagesByIds,
  updateConversationTitle,
  pinConversationForUser,
  unpinConversationForUser,
  pinMessageToConversation, // Use this for pinning messages
  unpinMessageFromConversation, // Use this for unpinning messages
  deleteStaffMessage, // This seems staff-specific, customer shouldn't delete AI/staff messages
  editStaffMessage,   // This also seems staff-specific
  handleBookAppointmentFromForm,
} from './actions'; 
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { getAppSettings } from './actions'; // Keep this for initial brand name if context is not ready
import { AppointmentBookingForm } from '@/components/chat/AppointmentBookingForm';
import { useSocket } from '@/contexts/SocketContext'; 
import { cn } from '@/lib/utils';
// ChatWindow is used internally by ChatInterface, no direct import needed here.

export default function HomePage() {
  const [currentUserSession, setCurrentUserSession] = useState<UserSession | null>(null);
  const [initialSessionFromStorage, setInitialSessionFromStorage] = useState<UserSession | null>(null);

  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]); // State for pinned messages
  const [currentSuggestedReplies, setCurrentSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null); // Store the whole active conversation object
  const [conversations, setConversations] = useState<Conversation[]>([]); // Customer will only have one effectively
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

  const fetchPinnedMessages = useCallback(async (convId: string | null) => {
    if (!convId) {
        setPinnedMessages([]);
        return;
    }
    const currentConv = conversations.find(c => c.id === convId) || activeConversation;
    if (currentConv && currentConv.pinnedMessageIds && currentConv.pinnedMessageIds.length > 0) {
        try {
            const fetchedPinned = await getMessagesByIds(currentConv.pinnedMessageIds);
            setPinnedMessages(fetchedPinned);
        } catch (error) {
            console.error("Error fetching pinned messages:", error);
            setPinnedMessages([]);
        }
    } else {
        setPinnedMessages([]);
    }
  }, [conversations, activeConversation]); // Added activeConversation

  useEffect(() => {
    if (activeConversation?.id) {
        fetchPinnedMessages(activeConversation.id);
    }
  }, [activeConversation?.id, activeConversation?.pinnedMessageIds, fetchPinnedMessages]);


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
      setCurrentMessages(initialMessages); 
      setCurrentSuggestedReplies(initialSuggestedReplies);
      
      const primaryConversation = customerConversations.find(c => c.id === primaryConvId) || customerConversations[0] || null;
      setActiveConversation(primaryConversation);
      setConversations(customerConversations); 
      
      if (primaryConversation?.id) {
        fetchPinnedMessages(primaryConversation.id);
      }

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
  }, [toast, router, fetchPinnedMessages]); 


  useEffect(() => {
    setIsLoadingSession(true);
    const storedSessionString = sessionStorage.getItem('aetherChatUserSession');
    if (storedSessionString) {
      try {
        const session: UserSession = JSON.parse(storedSessionString);
        setInitialSessionFromStorage(session); 
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
  }, [router, pathname]); 

  useEffect(() => {
    if (initialSessionFromStorage) {
      if (initialSessionFromStorage.role === 'customer') {
        setCurrentUserSession(initialSessionFromStorage); 
        loadInitialData(initialSessionFromStorage);       
      } else if (initialSessionFromStorage.role === 'admin' || initialSessionFromStorage.role === 'staff') {
        setCurrentUserSession(initialSessionFromStorage); 
        setIsLoadingSession(false); 
      } else {
        setIsLoadingSession(false);
      }
    } else if (router && router.pathname && !router.pathname.startsWith('/enter-phone')) { 
      setIsLoadingSession(false);
    }
  }, [initialSessionFromStorage, loadInitialData, router]); 


  useEffect(() => {
    if (!socket || !isConnected || !activeConversation?.id || !currentUserSession || currentUserSession.role !== 'customer') {
      return;
    }

    console.log(`Customer ${currentUserSession.id} joining room: ${activeConversation.id}`);
    socket.emit('joinRoom', activeConversation.id);

    const handleNewMessage = (newMessage: Message) => {
      console.log('Customer received new message via socket:', newMessage);
      if (newMessage.conversationId === activeConversation?.id && newMessage.userId !== currentUserSession?.id) {
        setCurrentMessages(prev => {
          if (prev.find(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      }
    };

    const handleUserTyping = ({ userId: typingUserId, userName, conversationId: incomingConvId }: { userId: string, userName: string, conversationId: string }) => {
      if (incomingConvId === activeConversation?.id && typingUserId !== currentUserSession?.id) {
        usersTypingMapRef.current[typingUserId] = userName;
        setTypingUsers({ ...usersTypingMapRef.current });
      }
    };

    const handleUserStopTyping = ({ userId: typingUserId, conversationId: incomingConvId }: { userId: string, conversationId: string }) => {
      if (incomingConvId === activeConversation?.id && typingUserId !== currentUserSession?.id) {
        delete usersTypingMapRef.current[typingUserId];
        setTypingUsers({ ...usersTypingMapRef.current });
      }
    };

    const handlePinnedMessagesUpdated = ({ conversationId: updatedConvId, pinnedMessageIds: newPinnedIds }: { conversationId: string, pinnedMessageIds: string[] }) => {
      if (updatedConvId === activeConversation?.id) {
        setActiveConversation(prev => prev ? { ...prev, pinnedMessageIds: newPinnedIds } : null);
        // fetchPinnedMessages will be called by its own useEffect due to activeConversation.pinnedMessageIds changing
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);
    socket.on('pinnedMessagesUpdated', handlePinnedMessagesUpdated);


    return () => {
      if (socket && activeConversation?.id && currentUserSession) {
        console.log(`Customer ${currentUserSession.id} leaving room: ${activeConversation.id}`);
        socket.emit('leaveRoom', activeConversation.id);
        socket.off('newMessage', handleNewMessage);
        socket.off('userTyping', handleUserTyping);
        socket.off('userStopTyping', handleUserStopTyping);
        socket.off('pinnedMessagesUpdated', handlePinnedMessagesUpdated);
      }
    };
  }, [socket, isConnected, activeConversation, currentUserSession, fetchPinnedMessages]);


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
    if(socket && activeConversation?.id && currentUserSession?.id && onTyping) {
        onTyping(false); 
    }

    setCurrentUserSession(null);
    setInitialSessionFromStorage(null);
    sessionStorage.removeItem('aetherChatUserSession');
    setCurrentMessages([]);
    setPinnedMessages([]);
    setCurrentSuggestedReplies([]);
    setActiveConversation(null);
    setConversations([]);
    setTypingUsers({});


    if (role === 'admin' || role === 'staff') {
      router.push('/login');
    } else {
      router.push('/enter-phone');
    }
  };

  const onTyping = (isTypingStatus: boolean) => {
    if (!socket || !isConnected || !activeConversation?.id || !currentUserSession) return;
    if (isTypingStatus) {
      socket.emit('typing', { conversationId: activeConversation.id, userName: currentUserSession.name || `User ${currentUserSession.id.slice(-4)}` });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (socket && isConnected) socket.emit('stopTyping', { conversationId: activeConversation?.id, userId: currentUserSession?.id });
      }, 1500); 
    }
  };


  const handleSendMessage = async (messageContent: string) => {
    if (!currentUserSession || !activeConversation?.id) return;

    const userMessage: Message = {
      id: `msg_local_user_${Date.now()}`,
      sender: 'user',
      content: messageContent,
      timestamp: new Date(),
      conversationId: activeConversation.id,
      name: currentUserSession.name || `Người dùng ${currentUserSession.phoneNumber}`,
      userId: currentUserSession.id,
    };

    setCurrentMessages((prevMessages) => [...prevMessages, userMessage]);
    setCurrentSuggestedReplies([]); 
    setIsChatLoading(true);
    if (socket && isConnected && onTyping) {
      onTyping(false); 
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }


    try {
      const { userMessage: savedUserMessage, aiMessage, updatedAppointment } = await processUserMessage(
        messageContent,
        currentUserSession,
        activeConversation.id,
        [...currentMessages, userMessage] 
      );

      setCurrentMessages((prevMessages) => [
        ...prevMessages.filter(m => m.id !== userMessage.id), 
        savedUserMessage, 
        aiMessage 
      ]);

      if (socket && isConnected) {
        socket.emit('sendMessage', { message: savedUserMessage, conversationId: activeConversation.id });
        socket.emit('sendMessage', { message: aiMessage, conversationId: activeConversation.id });
      }

      if (updatedAppointment) {
        toast({
          title: "Cập nhật lịch hẹn",
          description: `Dịch vụ: ${updatedAppointment.service}, Ngày: ${updatedAppointment.date}, Giờ: ${updatedAppointment.time}, Trạng thái: ${updatedAppointment.status}`,
        });
      }

    } catch (error) {
      console.error("Lỗi xử lý tin nhắn:", error);
      const errorMessage: Message = {
        id: `msg_error_${Date.now()}`,
        sender: 'system',
        content: 'Xin lỗi, tôi gặp lỗi. Vui lòng thử lại.',
        timestamp: new Date(),
        conversationId: activeConversation.id,
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
  
  const handlePinRequested = (messageId: string) => {
    if (!socket || !isConnected || !activeConversation?.id || !currentUserSession) return;
    // Customer cannot pin messages, only staff/admin
    if (currentUserSession.role === 'customer') {
        toast({ title: "Thông báo", description: "Bạn không có quyền ghim tin nhắn.", variant: "default" });
        return;
    }
    socket.emit('pinMessageRequested', { 
        conversationId: activeConversation.id, 
        messageId,
        staffSessionJsonString: JSON.stringify(currentUserSession) 
    });
  };

  const handleUnpinRequested = (messageId: string) => {
    if (!socket || !isConnected || !activeConversation?.id || !currentUserSession) return;
    if (currentUserSession.role === 'customer') {
        toast({ title: "Thông báo", description: "Bạn không có quyền bỏ ghim tin nhắn.", variant: "default" });
        return;
    }
    socket.emit('unpinMessageRequested', { 
        conversationId: activeConversation.id, 
        messageId,
        staffSessionJsonString: JSON.stringify(currentUserSession)
    });
  };
  
  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(messageId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('bg-yellow-200', 'transition-all', 'duration-1000');
      setTimeout(() => {
        element.classList.remove('bg-yellow-200');
      }, 2000);
    }
  };

  const renderCustomerChatInterface = () => {
    if (!currentUserSession || !activeConversation?.id) {
      return <div className="flex-grow flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    return (
      <ChatInterface
        userSession={currentUserSession}
        conversations={conversations} // Only one conversation for customer
        activeConversation={activeConversation}
        messages={currentMessages}
        pinnedMessages={pinnedMessages}
        suggestedReplies={currentSuggestedReplies}
        onSendMessage={handleSendMessage}
        onSelectConversation={() => {}} // No conversation switching for customer
        isChatLoading={isChatLoading || isLoadingSession}
        viewerRole="customer_view" 
        onBookAppointmentClick={() => setIsBookingModalOpen(true)}
        onTyping={onTyping}
        onScrollToMessage={handleScrollToMessage}
        // Pinning actions are disabled for customer view at ChatInterface level
      />
    );
  };

  const handleDirectBookAppointment = async (formData: AppointmentBookingFormData) => {
    if (!currentUserSession || !activeConversation?.id) return;
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
        conversationId: activeConversation.id,
      };
      setCurrentMessages(prev => [...prev, systemMessage]);
      if (socket && isConnected) {
        socket.emit('sendMessage', { message: systemMessage, conversationId: activeConversation.id });
      }
      if(result.success) setIsBookingModalOpen(false);

    } catch (error: any) {
      toast({ title: "Lỗi đặt lịch", description: error.message || "Không thể đặt lịch hẹn.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  };

  const renderContent = () => {
    if (isLoadingSession || (!initialSessionFromStorage && (pathname && !pathname.startsWith('/enter-phone')))) {
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
        "flex-grow flex items-stretch w-full overflow-hidden pt-16", // pt-16 to account for fixed header
        currentUserSession?.role === 'customer' ? "h-[calc(100vh-4rem)]" : "h-auto items-center justify-center" 
      )}>
        {renderContent()}
      </main>
      {currentUserSession?.role === 'customer' && activeConversation?.id && (
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
