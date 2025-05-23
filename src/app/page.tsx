
// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { ChatInterface } from '@/components/chat/ChatInterface';
import type { Message, UserSession, Conversation, MessageViewerRole } from '@/lib/types';
import { 
  handleCustomerAccess, 
  processUserMessage, 
  // createNewConversationForUser, // Removed as it's not exported from actions
  // getConversationHistory, // Use socket for history or initial load provides enough
  getUserConversations,
  getMessagesByIds,
  updateConversationTitle,
  pinConversationForUser,
  unpinConversationForUser,
  pinMessageToConversation, 
  unpinMessageFromConversation, 
  deleteStaffMessage, 
  editStaffMessage, 
  getAppSettings
} from './actions'; 
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { AppointmentBookingForm } from '@/components/chat/AppointmentBookingForm';
import { useSocket } from '@/contexts/SocketContext'; 
import { cn } from '@/lib/utils';
import { ChatWindow } from '@/components/chat/ChatWindow';


export default function HomePage() {
  const [currentUserSession, setCurrentUserSession] = useState<UserSession | null>(null);
  const [initialSessionFromStorage, setInitialSessionFromStorage] = useState<UserSession | null>(null);

  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [currentSuggestedReplies, setCurrentSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
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
    // Ensure activeConversation is used if it matches convId, otherwise try to find in conversations list
    const currentConv = activeConversation?.id === convId ? activeConversation : conversations.find(c => c.id === convId);
    
    if (currentConv && currentConv.pinnedMessageIds && currentConv.pinnedMessageIds.length > 0) {
        try {
            console.log("HomePage: Fetching pinned messages for convId:", convId, "IDs:", currentConv.pinnedMessageIds);
            const fetchedPinned = await getMessagesByIds(currentConv.pinnedMessageIds);
            setPinnedMessages(fetchedPinned);
        } catch (error) {
            console.error("HomePage: Error fetching pinned messages:", error);
            setPinnedMessages([]);
        }
    } else {
        console.log("HomePage: No pinned messages or conversation not found for convId:", convId);
        setPinnedMessages([]);
    }
  }, [activeConversation, conversations]);

  useEffect(() => {
    if (activeConversation?.id) {
        fetchPinnedMessages(activeConversation.id);
    }
  }, [activeConversation?.id, activeConversation?.pinnedMessageIds, fetchPinnedMessages]);


  // This effect reads the basic session from sessionStorage
  useEffect(() => {
    console.log("HomePage: useEffect for initial session check triggered.");
    setIsLoadingSession(true);
    const storedSessionString = sessionStorage.getItem('aetherChatUserSession');
    if (storedSessionString) {
      try {
        const session: UserSession = JSON.parse(storedSessionString);
        console.log("HomePage: Session found in sessionStorage:", session);
        setInitialSessionFromStorage(session);
      } catch (error) {
        console.error("HomePage: Lỗi phân tích cú pháp session từ sessionStorage:", error);
        sessionStorage.removeItem('aetherChatUserSession');
        sessionStorage.removeItem('aetherChatPrefetchedData'); // Clear pre-fetched data too
        router.replace('/enter-phone');
      }
    } else {
      console.log("HomePage: No session found in sessionStorage.");
      if (pathname !== '/enter-phone') {
        router.replace('/enter-phone');
      } else {
        setIsLoadingSession(false);
      }
    }
  }, [router, pathname]);


  // This effect processes initialSessionFromStorage to set up the chat or redirect
  useEffect(() => {
    console.log("HomePage: useEffect for processing initialSessionFromStorage. Current initialSession:", initialSessionFromStorage, "hasLoadedInitialData:", hasLoadedInitialData);
    if (initialSessionFromStorage) {
      if (initialSessionFromStorage.role === 'customer') {
        setCurrentUserSession(initialSessionFromStorage); // Set current session for UI elements like header

        const prefetchedDataRaw = sessionStorage.getItem('aetherChatPrefetchedData');
        if (prefetchedDataRaw && !hasLoadedInitialData) {
          try {
            const prefetchedData = JSON.parse(prefetchedDataRaw);
            // Verify if the pre-fetched data belongs to the current session
            if (prefetchedData.userSession && prefetchedData.userSession.id === initialSessionFromStorage.id) {
              console.log("HomePage: Using pre-fetched data from enter-phone page for session:", initialSessionFromStorage.id);
              
              setCurrentMessages((prefetchedData.initialMessages || []).map((m: Message) => ({...m, timestamp: new Date(m.timestamp)})));
              setCurrentSuggestedReplies(prefetchedData.initialSuggestedReplies || []);
              
              const custConvs: Conversation[] = (prefetchedData.conversations || []).map((c: Conversation) => ({
                ...c,
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt),
                lastMessageTimestamp: c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp) : undefined,
              }));
              setConversations(custConvs);
              
              const primaryConv = custConvs.find(c => c.id === prefetchedData.activeConversationId) || custConvs[0] || null;
              setActiveConversation(primaryConv);

              if (primaryConv?.id) {
                fetchPinnedMessages(primaryConv.id);
              }
              
              setHasLoadedInitialData(true); // Mark data as loaded for this session
              sessionStorage.removeItem('aetherChatPrefetchedData'); // Clear after use
              setIsLoadingSession(false);
              return; // Data successfully loaded from prefetch, skip further loading
            } else {
               console.warn("HomePage: Prefetched data session ID mismatch or missing userSession. Clearing pre-fetched data.");
               sessionStorage.removeItem('aetherChatPrefetchedData'); // Clear stale/invalid data
            }
          } catch (e) {
            console.error("HomePage: Error parsing pre-fetched data. Clearing and will load fresh.", e);
            sessionStorage.removeItem('aetherChatPrefetchedData'); // Clear corrupted data
          }
        }
        
        // If no valid pre-fetched data was used, and data hasn't been loaded yet for this session
        if (!hasLoadedInitialData) {
          console.log("HomePage: No valid pre-fetched data or initial load pending for session:", initialSessionFromStorage.id, "Calling loadInitialData.");
          loadInitialData(initialSessionFromStorage); // This calls handleCustomerAccess
        } else {
           console.log("HomePage: Data already marked as loaded for session:", initialSessionFromStorage.id);
           setIsLoadingSession(false);
        }

      } else if (initialSessionFromStorage.role === 'admin' || initialSessionFromStorage.role === 'staff') {
        setCurrentUserSession(initialSessionFromStorage);
        setIsLoadingSession(false);
      } else {
        console.warn("HomePage: Unrecognized role in initialSessionFromStorage:", initialSessionFromStorage.role);
        setIsLoadingSession(false);
      }
    } else if (router && router.pathname && !router.pathname.startsWith('/enter-phone')) {
      // No session, and not on the entry page, so stop loading.
      // This case is mostly handled by the first useEffect redirecting to /enter-phone.
      setIsLoadingSession(false);
    }
  }, [initialSessionFromStorage, router, hasLoadedInitialData, fetchPinnedMessages]); // Removed loadInitialData from here to avoid loop

  // loadInitialData is now only called if pre-fetched data is NOT available.
  const loadInitialData = useCallback(async (session: UserSession) => {
    if (session.role !== 'customer' || !session.id) {
      setIsLoadingSession(false);
      return;
    }
    setIsLoadingSession(true);
    setHasLoadedInitialData(false); // Reset before loading
    console.log("HomePage: Bắt đầu loadInitialData (network call) cho session:", session.id);
    try {
      const {
        userSession: updatedSession,
        initialMessages,
        initialSuggestedReplies,
        activeConversationId: primaryConvId,
        conversations: customerConversations
      } = await handleCustomerAccess(session.phoneNumber); // Network call

      setCurrentUserSession(updatedSession); // This might re-trigger the outer effect if not careful
      setCurrentMessages(initialMessages.map((m: Message) => ({...m, timestamp: new Date(m.timestamp)})));
      setCurrentSuggestedReplies(initialSuggestedReplies);

      const custConvs = customerConversations.map((c: Conversation) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        lastMessageTimestamp: c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp) : undefined,
      }));
      setConversations(custConvs);
      const primaryConversation = custConvs.find(c => c.id === primaryConvId) || custConvs[0] || null;
      setActiveConversation(primaryConversation);

      if (primaryConversation?.id) {
        fetchPinnedMessages(primaryConversation.id);
      }
      setHasLoadedInitialData(true); // Mark that data has been loaded for this session
      console.log("HomePage: loadInitialData (network call) hoàn thành.");
    } catch (error) {
      console.error("HomePage: Lỗi loadInitialData (network call):", error);
      toast({ title: "Lỗi", description: "Không thể tải dữ liệu trò chuyện.", variant: "destructive" });
      sessionStorage.removeItem('aetherChatUserSession');
      sessionStorage.removeItem('aetherChatPrefetchedData');
      router.replace('/enter-phone');
    } finally {
      setIsLoadingSession(false);
    }
  }, [toast, router, fetchPinnedMessages]); // Dependencies for useCallback

  // Effect to reset hasLoadedInitialData when session is cleared (e.g., on logout)
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
          if (prev.find(m => m.id === newMessage.id)) return prev; // Avoid duplicates
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
            console.log("HomePage: Received pinnedMessagesUpdated from socket", newPinnedIds);
            setActiveConversation(prev => prev ? { ...prev, pinnedMessageIds: newPinnedIds } : null);
        }
    };
    
    const handleMessageDeleted = ({ messageId, conversationId: convId }: { messageId: string, conversationId: string }) => {
      if (convId === activeConversation?.id) {
        setCurrentMessages(prev => prev.filter(m => m.id !== messageId));
        setPinnedMessages(prev => prev.filter(pm => pm.id !== messageId)); // Also update pinned messages state
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
    sessionStorage.removeItem('aetherChatPrefetchedData'); // Clear pre-fetched data on logout
    setCurrentMessages([]);
    setPinnedMessages([]);
    setCurrentSuggestedReplies([]);
    setActiveConversation(null);
    setConversations([]);
    setTypingUsers({});
    setHasLoadedInitialData(false); // Reset loading flag

    if (role === 'admin' || role === 'staff') {
      router.push('/login');
    } else {
      router.push('/enter-phone');
    }
  };

  const onTyping = (isTypingStatus: boolean) => {
    if (!socket || !isConnected || !activeConversation?.id || !currentUserSession) return;
    if (isTypingStatus) {
      socket.emit('typing', { conversationId: activeConversation.id, userName: currentUserSession.name || `Người dùng ${currentUserSession.id.slice(-4)}` });
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
      id: `msg_local_user_${Date.now()}`, // Temporary ID
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

      // Replace local message with saved one, and add AI message
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
      // Remove the optimistic user message if there was an error
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
    if (currentUserSession.role === 'customer') {
        toast({ title: "Thông báo", description: "Bạn không có quyền ghim tin nhắn.", variant: "default" });
        return;
    }
    console.log("HomePage: Emitting pinMessageRequested", { conversationId: activeConversation.id, messageId });
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
    console.log("HomePage: Emitting unpinMessageRequested", { conversationId: activeConversation.id, messageId });
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
      <ChatWindow
        userSession={currentUserSession}
        messages={currentMessages}
        pinnedMessages={pinnedMessages} 
        suggestedReplies={currentSuggestedReplies}
        onSendMessage={handleSendMessage}
        onSuggestedReplyClick={handleSendMessage} 
        isLoading={isChatLoading || isLoadingSession}
        viewerRole="customer_view" 
        onBookAppointmentClick={() => setIsBookingModalOpen(true)}
        onTyping={onTyping}
        onScrollToMessage={handleScrollToMessage}
        activeConversationId={activeConversation?.id}
        activeConversationPinnedMessageIds={activeConversation?.pinnedMessageIds || []}
        onPinRequested={handlePinRequested}
        onUnpinRequested={handleUnpinRequested}
      />
    );
  };

  const handleDirectBookAppointment = async (formData: any) => { // Type should be AppointmentBookingFormData
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
    // If not loading and no session, but not on enter-phone, means something went wrong or direct access to /
    // This should ideally be handled by the redirect in the first useEffect.
    // If on /enter-phone, that page handles its own rendering.
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
        "flex-grow flex items-stretch w-full overflow-hidden pt-16",
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
