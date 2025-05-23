
// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { ChatInterface } from '@/components/chat/ChatInterface';
import type { Message, UserSession, Conversation, MessageViewerRole } from '@/lib/types';
import { 
  handleCustomerAccess, 
  processUserMessage, 
  // createNewConversationForUser, // Removed as it's not exported from actions
  getUserConversations, 
  getMessagesByIds,
  updateConversationTitle,
  pinConversationForUser,
  unpinConversationForUser,
  pinMessageToConversation, // New for pinning messages
  unpinMessageFromConversation, // New for unpinning messages
  deleteStaffMessage, // For consistency, even if not used by customer
  editStaffMessage, // For consistency
  getAppSettings,
  createNewConversationForUser,
} from './actions'; 
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { AppointmentBookingForm } from '@/components/chat/AppointmentBookingForm';
import { useSocket } from '@/contexts/SocketContext'; 
import { cn } from '@/lib/utils';


export default function HomePage() {
  const [currentUserSession, setCurrentUserSession] = useState<UserSession | null>(null);
  const [initialSessionFromStorage, setInitialSessionFromStorage] = useState<UserSession | null>(null);

  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [currentSuggestedReplies, setCurrentSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname(); 
  const appSettingsContext = useAppSettingsContext();
  const [brandName, setBrandName] = useState('AetherChat');

  const usersTypingMapRef = useRef<Record<string, string>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

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
    const currentConv = activeConversation?.id === convId ? activeConversation : null;
    
    if (currentConv && currentConv.pinnedMessageIds && currentConv.pinnedMessageIds.length > 0) {
        try {
            const fetchedPinned = await getMessagesByIds(currentConv.pinnedMessageIds);
            setPinnedMessages(fetchedPinned);
        } catch (error) {
            console.error("HomePage: Error fetching pinned messages:", error);
            setPinnedMessages([]);
        }
    } else {
        setPinnedMessages([]);
    }
  }, [activeConversation]);

  useEffect(() => {
    if (activeConversation?.id) {
        fetchPinnedMessages(activeConversation.id);
    }
  }, [activeConversation, fetchPinnedMessages]);


  useEffect(() => {
    console.log("HomePage: Initial session check effect running. Pathname:", pathname);
    setIsLoadingSession(true);
    const storedSessionString = sessionStorage.getItem('aetherChatUserSession');
    if (storedSessionString) {
      try {
        const session: UserSession = JSON.parse(storedSessionString);
        console.log("HomePage: Found session in storage:", session);
        setInitialSessionFromStorage(session);
      } catch (error) {
        console.error("HomePage: Lỗi phân tích cú pháp session từ sessionStorage:", error);
        sessionStorage.removeItem('aetherChatUserSession');
        sessionStorage.removeItem('aetherChatPrefetchedData');
        if (router && router.replace) router.replace('/enter-phone'); else window.location.pathname = '/enter-phone';
      }
    } else {
      console.log("HomePage: No session in storage. Current path:", pathname);
      if (pathname !== '/enter-phone' && pathname !== '/login' && pathname !== '/register') {
        if (router && router.replace) router.replace('/enter-phone'); else window.location.pathname = '/enter-phone';
      } else {
        setIsLoadingSession(false);
      }
    }
  }, [router, pathname]);


  const loadInitialData = useCallback(async (session: UserSession) => {
    if (session.role !== 'customer' || !session.id) {
      setIsLoadingSession(false);
      return;
    }
    setIsLoadingSession(true);
    setHasLoadedInitialData(false); 
    console.log("HomePage: Bắt đầu loadInitialData cho session:", session.id);
    try {
      const {
        userSession: updatedSession,
        initialMessages,
        initialSuggestedReplies,
        activeConversationId: primaryConvId,
        conversations: customerConversations 
      } = await handleCustomerAccess(session.phoneNumber); 

      setCurrentUserSession(updatedSession); 
      setCurrentMessages(initialMessages.map((m: Message) => ({...m, timestamp: new Date(m.timestamp)})));
      setCurrentSuggestedReplies(initialSuggestedReplies);
      
      const primaryConversation = customerConversations && customerConversations.length > 0 ? 
        customerConversations.map((c: Conversation) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          lastMessageTimestamp: c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp) : undefined,
        }))[0] 
        : null;
      setActiveConversation(primaryConversation);

      if (primaryConversation?.id) {
        fetchPinnedMessages(primaryConversation.id);
      }
      setHasLoadedInitialData(true);
      console.log("HomePage: loadInitialData hoàn thành.");
    } catch (error) {
      console.error("HomePage: Lỗi loadInitialData:", error);
      toast({ title: "Lỗi", description: "Không thể tải dữ liệu trò chuyện.", variant: "destructive" });
      sessionStorage.removeItem('aetherChatUserSession');
      sessionStorage.removeItem('aetherChatPrefetchedData');
      if (router && router.replace) router.replace('/enter-phone'); else window.location.pathname = '/enter-phone';
    } finally {
      setIsLoadingSession(false);
    }
  }, [toast, router, fetchPinnedMessages]); 

  useEffect(() => {
    if (initialSessionFromStorage) {
      if (initialSessionFromStorage.role === 'customer') {
        setCurrentUserSession(initialSessionFromStorage); 

        const prefetchedDataRaw = sessionStorage.getItem('aetherChatPrefetchedData');
        if (prefetchedDataRaw && !hasLoadedInitialData) {
          try {
            const prefetchedData = JSON.parse(prefetchedDataRaw);
            if (prefetchedData.userSession && prefetchedData.userSession.id === initialSessionFromStorage.id) {
              console.log("HomePage: Using pre-fetched data for session:", initialSessionFromStorage.id);
              
              setCurrentMessages((prefetchedData.initialMessages || []).map((m: Message) => ({...m, timestamp: new Date(m.timestamp)})));
              setCurrentSuggestedReplies(prefetchedData.initialSuggestedReplies || []);
              
              const custConvs: Conversation[] = (prefetchedData.conversations || []).map((c: Conversation) => ({
                ...c,
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt),
                lastMessageTimestamp: c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp) : undefined,
              }));
              const primaryConv = custConvs.find(c => c.id === prefetchedData.activeConversationId) || custConvs[0] || null;
              setActiveConversation(primaryConv);

              if (primaryConv?.id) {
                fetchPinnedMessages(primaryConv.id);
              }
              
              setHasLoadedInitialData(true);
              sessionStorage.removeItem('aetherChatPrefetchedData');
              setIsLoadingSession(false);
              return; 
            } else {
               sessionStorage.removeItem('aetherChatPrefetchedData');
            }
          } catch (e) {
            console.error("HomePage: Error parsing pre-fetched data. Clearing.", e);
            sessionStorage.removeItem('aetherChatPrefetchedData');
          }
        }
        
        if (!hasLoadedInitialData) {
          loadInitialData(initialSessionFromStorage);
        } else {
           setIsLoadingSession(false);
        }

      } else if (initialSessionFromStorage.role === 'admin' || initialSessionFromStorage.role === 'staff') {
        setCurrentUserSession(initialSessionFromStorage);
        setIsLoadingSession(false);
      } else {
        setIsLoadingSession(false);
      }
    } else if (router && router.pathname && !router.pathname.startsWith('/enter-phone')) { 
      setIsLoadingSession(false);
    }
  }, [initialSessionFromStorage, loadInitialData, router, hasLoadedInitialData, fetchPinnedMessages, pathname]);

  useEffect(() => {
    if (!currentUserSession) {
      setHasLoadedInitialData(false);
    }
  }, [currentUserSession]);


  useEffect(() => {
    if (!socket || !isConnected || !activeConversation?.id || !currentUserSession || currentUserSession.role !== 'customer') {
      return;
    }

    console.log(`HomePage: Customer ${currentUserSession.id} joining room: ${activeConversation.id}`);
    socket.emit('joinRoom', activeConversation.id);

    const handleNewMessage = (newMessage: Message) => {
      console.log('HomePage: Customer received new message via socket:', newMessage);
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
            // fetchPinnedMessages will be called by its own useEffect
        }
    };
    
    const handleMessageDeleted = ({ messageId, conversationId: convId }: { messageId: string, conversationId: string }) => {
      if (convId === activeConversation?.id) {
        setCurrentMessages(prev => prev.filter(m => m.id !== messageId));
        setPinnedMessages(prev => prev.filter(pm => pm.id !== messageId));
      }
    };

    const handleMessageEdited = ({ message: editedMessage, conversationId: convId }: { message: Message, conversationId: string }) => {
       if (convId === activeConversation?.id) {
        setCurrentMessages(prev => prev.map(m => m.id === editedMessage.id ? {...editedMessage, timestamp: new Date(editedMessage.timestamp)} : m));
        setPinnedMessages(prev => prev.map(pm => pm.id === editedMessage.id ? {...editedMessage, timestamp: new Date(editedMessage.timestamp)} : pm));
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);
    socket.on('pinnedMessagesUpdated', handlePinnedMessagesUpdated);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('messageEdited', handleMessageEdited);


    return () => {
      if (socket && activeConversation?.id && currentUserSession) {
        console.log(`HomePage: Customer ${currentUserSession.id} leaving room: ${activeConversation.id}`);
        socket.emit('leaveRoom', activeConversation.id);
        socket.off('newMessage', handleNewMessage);
        socket.off('userTyping', handleUserTyping);
        socket.off('userStopTyping', handleUserStopTyping);
        socket.off('pinnedMessagesUpdated', handlePinnedMessagesUpdated);
        socket.off('messageDeleted', handleMessageDeleted);
        socket.off('messageEdited', handleMessageEdited);
      }
    };
  }, [socket, isConnected, activeConversation, currentUserSession]);


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
    if(socket && isConnected && activeConversation?.id && currentUserSession?.id && onTyping) {
        onTyping(false); 
    }

    setCurrentUserSession(null);
    setInitialSessionFromStorage(null);
    sessionStorage.removeItem('aetherChatUserSession');
    sessionStorage.removeItem('aetherChatPrefetchedData');
    setCurrentMessages([]);
    setPinnedMessages([]);
    setCurrentSuggestedReplies([]);
    setActiveConversation(null);
    setTypingUsers({});
    setHasLoadedInitialData(false); 

    if (role === 'admin' || role === 'staff') {
      router.push('/login');
    } else {
      router.push('/enter-phone');
    }
  };

  const onTyping = (isTypingStatus: boolean) => {
    if (!socket || !isConnected || !activeConversation?.id || !currentUserSession) return;
    if (isTypingStatus) {
      socket.emit('typing', { conversationId: activeConversation.id, userName: currentUserSession.name || `Người dùng ${currentUserSession.phoneNumber}`, userId: currentUserSession.id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (socket && isConnected && activeConversation?.id && currentUserSession?.id) {
            socket.emit('stopTyping', { conversationId: activeConversation.id, userId: currentUserSession.id });
        }
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
        currentMessages 
      );

      setCurrentMessages((prevMessages) => [
        ...prevMessages.filter(m => m.id !== userMessage.id), 
        {...savedUserMessage, timestamp: new Date(savedUserMessage.timestamp)}, 
        {...aiMessage, timestamp: new Date(aiMessage.timestamp)}
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
    socket.emit('requestPinMessage', { 
        conversationId: activeConversation.id, 
        messageId,
        userSessionJsonString: JSON.stringify(currentUserSession) 
    });
  };

  const handleUnpinRequested = (messageId: string) => {
    if (!socket || !isConnected || !activeConversation?.id || !currentUserSession) return;
    socket.emit('requestUnpinMessage', { 
        conversationId: activeConversation.id, 
        messageId,
        userSessionJsonString: JSON.stringify(currentUserSession)
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
      <ChatWindow
        userSession={currentUserSession}
        messages={currentMessages}
        pinnedMessages={pinnedMessages} 
        suggestedReplies={currentMessages.length <=1 ? currentSuggestedReplies : []}
        onSendMessage={handleSendMessage}
        onSuggestedReplyClick={handleSendMessage} 
        isLoading={isChatLoading || isLoadingSession}
        viewerRole="customer_view" 
        onBookAppointmentClick={() => setIsBookingModalOpen(true)}
        onTyping={onTyping}
        typingUsers={typingUsers}
        onScrollToMessage={handleScrollToMessage}
        activeConversationId={activeConversation?.id}
        activeConversationPinnedMessageIds={activeConversation?.pinnedMessageIds || []}
        onPinRequested={handlePinRequested}
        onUnpinRequested={handleUnpinRequested}
        currentUserSessionId={currentUserSession.id}
      />
    );
  };

  const handleDirectBookAppointment = async (formData: any) => { 
    if (!currentUserSession || !activeConversation?.id) return;
    setIsChatLoading(true);
    try {
      const result = await handleBookAppointmentFromForm({...formData, customerId: currentUserSession.id });
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
    if (isLoadingSession || (!initialSessionFromStorage && (pathname && !pathname.startsWith('/enter-phone') && !pathname.startsWith('/login') && !pathname.startsWith('/register')))) {
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
        );
      }

      if (currentUserSession.role === 'staff') {
        return (
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
                <p className="text-muted-foreground">Đang chuyển hướng hoặc có lỗi xảy ra...</p>
             </div>
        )
    }
    return null; 
  };

  return (
    <div className="flex flex-col min-h-screen bg-background h-screen">
      <AppHeader userSession={currentUserSession} onLogout={handleLogout} />
      <main className={cn(
        "flex-grow flex items-stretch w-full overflow-hidden pt-16 md:max-w-screen-lg md:mx-auto",
        (currentUserSession?.role === 'customer' || !currentUserSession) ? "h-[calc(100vh-4rem)]" : "h-auto items-center justify-center" 
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
