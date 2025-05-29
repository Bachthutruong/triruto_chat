// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { ChatWindow } from '@/components/chat/ChatWindow';
import type { Message, UserSession, Conversation, MessageViewerRole, AppointmentBookingFormData, AppointmentDetails } from '@/lib/types';
import {
  handleCustomerAccess,
  processUserMessage,
  getUserConversations, // For fetching all conversations for a user if needed later
  getMessagesByIds,     // For fetching pinned messages
  updateConversationTitle,
  pinMessageToConversation, // Renamed
  unpinMessageFromConversation, // Renamed
  getAppSettings,
  handleBookAppointmentFromForm, // For direct booking
  getAppointments,
  deleteExistingAppointment,
  createSystemMessage,
  getConversationHistory
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

  const [appointments, setAppointments] = useState<AppointmentDetails[]>([]);

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

  const fetchPinnedMessages = useCallback(async (conversation: Conversation | null) => {
    if (!conversation || !conversation.pinnedMessageIds || conversation.pinnedMessageIds.length === 0) {
      setPinnedMessages([]);
      return;
    }
    try {
      console.log(`[Customer] Fetching pinned messages for conv ${conversation.id}:`, conversation.pinnedMessageIds);
      const fetchedPinned = await getMessagesByIds(conversation.pinnedMessageIds);
      setPinnedMessages(fetchedPinned);
    } catch (error) {
      console.error("HomePage: Error fetching pinned messages:", error);
      setPinnedMessages([]);
      // toast({ title: "Lỗi", description: "Không thể tải tin nhắn đã ghim.", variant: "destructive" }); // Can be noisy
    }
  }, []);

  const loadInitialData = useCallback(async (session: UserSession) => {
    if (session.role !== 'customer' || !session.id) {
      setIsLoadingSession(false);
      return;
    }
    setIsLoadingSession(true);
    setHasLoadedInitialData(false);
    console.log("HomePage: Starting loadInitialData for session:", session.id);
    try {
      const result = await handleCustomerAccess(session.phoneNumber);

      setCurrentUserSession(result.userSession);
      setCurrentMessages((result.initialMessages || []).map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) })));
      setCurrentSuggestedReplies(result.initialSuggestedReplies || []);

      const primaryConversation = (result.conversations && result.conversations.length > 0) ?
        result.conversations.map((c: Conversation) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          lastMessageTimestamp: c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp) : undefined,
          pinnedMessageIds: c.pinnedMessageIds || [], // Ensure pinnedMessageIds is always an array
        }))[0]
        : null;

      setActiveConversation(primaryConversation);

      if (primaryConversation) {
        fetchPinnedMessages(primaryConversation);
      }
      setHasLoadedInitialData(true);
      console.log("HomePage: loadInitialData completed. Active conversation ID:", primaryConversation?.id);
    } catch (error) {
      console.error("HomePage: Error in loadInitialData:", error);
      toast({ title: "Lỗi", description: "Không thể tải dữ liệu trò chuyện.", variant: "destructive" });
      sessionStorage.removeItem('aetherChatUserSession');
      sessionStorage.removeItem('aetherChatPrefetchedData');
      if (router && router.replace) router.replace('/enter-phone'); else window.location.pathname = '/enter-phone';
    } finally {
      setIsLoadingSession(false);
    }
  }, [toast, router, fetchPinnedMessages]);

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
        console.error("HomePage: Error parsing session from sessionStorage:", error);
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

              setCurrentMessages((prefetchedData.initialMessages || []).map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) })));
              setCurrentSuggestedReplies(prefetchedData.initialSuggestedReplies || []);

              const custConvs: Conversation[] = (prefetchedData.conversations || []).map((c: Conversation) => ({
                ...c,
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt),
                lastMessageTimestamp: c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp) : undefined,
                pinnedMessageIds: c.pinnedMessageIds || [],
              }));
              const primaryConv = custConvs.find(c => c.id === prefetchedData.activeConversationId) || custConvs[0] || null;
              setActiveConversation(primaryConv);

              if (primaryConv) {
                fetchPinnedMessages(primaryConv);
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
    } else if (router && pathname && !pathname.startsWith('/enter-phone')) {
      setIsLoadingSession(false);
    }
  }, [initialSessionFromStorage, loadInitialData, router, hasLoadedInitialData, fetchPinnedMessages, pathname]);

  useEffect(() => {
    if (!currentUserSession) {
      setHasLoadedInitialData(false);
    }
  }, [currentUserSession]);


  const handlePinnedMessagesUpdated = useCallback(({ conversationId: updatedConvId, pinnedMessageIds: newPinnedIds }: { conversationId: string, pinnedMessageIds: string[] }) => {
    console.log(`[Customer] Received pinnedMessagesUpdated for conv ${updatedConvId}. New IDs:`, newPinnedIds, "Current active conv ID:", activeConversation?.id);
    if (updatedConvId === activeConversation?.id) {
      setActiveConversation(prev => {
        if (prev && prev.id === updatedConvId) {
          console.log(`[Customer] Updating pinned IDs for conv ${updatedConvId} from`, prev.pinnedMessageIds, "to", newPinnedIds);
          return { ...prev, pinnedMessageIds: newPinnedIds || [] };
        }
        return prev;
      });
    }
  }, [activeConversation]);

  useEffect(() => {
    if (activeConversation) { // This effect will run when activeConversation itself changes (e.g., its pinnedMessageIds array)
      fetchPinnedMessages(activeConversation);
    }
  }, [activeConversation, fetchPinnedMessages]);


  useEffect(() => {
    if (!socket) {
      console.log("Socket not initialized");
      return;
    }

    const handleConnect = () => {
      console.log("Socket connected");
    };

    const handleDisconnect = () => {
      console.log("Socket disconnected");
    };

    const handleConnectError = (error: Error) => {
      console.error("Socket connection error:", error);
      toast({
        title: "Lỗi kết nối",
        description: "Không thể kết nối đến máy chủ. Đang thử kết nối lại...",
        variant: "destructive",
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket, toast]);

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
          return [...prev, { ...newMessage, timestamp: new Date(newMessage.timestamp) }];
        });
      }
    };

    const handleUserTyping = ({ userId: typingUserId, userName, conversationId: incomingConvId }: { userId: string, userName: string, conversationId: string }) => {
      if (incomingConvId === activeConversation?.id && typingUserId !== currentUserSession?.id) {
        usersTypingMapRef.current = { ...usersTypingMapRef.current, [typingUserId]: userName };
        setTypingUsers({ ...usersTypingMapRef.current });
      }
    };

    const handleUserStopTyping = ({ userId: typingUserId, conversationId: incomingConvId }: { userId: string, conversationId: string }) => {
      if (incomingConvId === activeConversation?.id && typingUserId !== currentUserSession?.id) {
        const { [typingUserId]: _, ...rest } = usersTypingMapRef.current;
        usersTypingMapRef.current = rest;
        setTypingUsers({ ...usersTypingMapRef.current });
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
        setCurrentMessages(prev => prev.map(m => m.id === editedMessage.id ? { ...editedMessage, timestamp: new Date(editedMessage.timestamp) } : m));
        setPinnedMessages(prev => prev.map(pm => pm.id === editedMessage.id ? { ...editedMessage, timestamp: new Date(editedMessage.timestamp) } : pm));
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
  }, [socket, isConnected, activeConversation, currentUserSession, handlePinnedMessagesUpdated]);

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
    if (socket && isConnected && activeConversation?.id && currentUserSession?.id && onTyping) {
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

      setCurrentMessages((prevMessages) =>
        prevMessages.map(m => m.id === userMessage.id ? { ...savedUserMessage, timestamp: new Date(savedUserMessage.timestamp) } : m)
      );
      setCurrentMessages(prev => [...prev, { ...aiMessage, timestamp: new Date(aiMessage.timestamp) }]);


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

  const handlePinRequested = useCallback((messageId: string) => {
    console.log("Pin requested for message:", messageId, {
      socket: !!socket,
      isConnected,
      activeConversation: activeConversation?.id,
      currentUserSession: !!currentUserSession,
      userRole: currentUserSession?.role
    });

    if (!socket) {
      console.error("Cannot pin message: Socket is not initialized");
      toast({
        title: "Lỗi kết nối",
        description: "Đang khởi tạo kết nối. Vui lòng thử lại sau.",
        variant: "destructive",
      });
      return;
    }

    if (!isConnected) {
      console.error("Cannot pin message: Socket is not connected");
      // Try to reconnect with timeout
      const reconnectTimeout = setTimeout(() => {
        if (!socket.connected) {
          toast({
            title: "Lỗi kết nối",
            description: "Không thể kết nối đến máy chủ. Vui lòng tải lại trang.",
            variant: "destructive",
          });
        }
      }, 5000);

      socket.connect();
      toast({
        title: "Đang kết nối lại",
        description: "Đang thử kết nối lại đến máy chủ...",
        variant: "default",
      });
      return;
    }

    if (!activeConversation?.id) {
      console.error("Cannot pin message: No active conversation");
      toast({
        title: "Lỗi",
        description: "Không tìm thấy cuộc trò chuyện hiện tại.",
        variant: "destructive",
      });
      return;
    }

    if (!currentUserSession) {
      console.error("Cannot pin message: No user session");
      toast({
        title: "Lỗi",
        description: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
        variant: "destructive",
      });
      return;
    }

    if (currentUserSession.role !== 'customer') {
      console.error("Cannot pin message: Invalid user role");
      toast({
        title: "Lỗi",
        description: "Bạn không có quyền thực hiện thao tác này.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`[Customer] Requesting to pin message ${messageId} in conv ${activeConversation.id}`);
      socket.emit('pinMessageRequested', {
        conversationId: activeConversation.id,
        messageId,
        userSessionJsonString: JSON.stringify(currentUserSession)
      }, (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          console.error("Server error pinning message:", response.error);
          toast({
            title: "Lỗi",
            description: response.error || "Không thể ghim tin nhắn. Vui lòng thử lại.",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error("Error pinning message:", error);
      toast({
        title: "Lỗi",
        description: "Không thể ghim tin nhắn. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  }, [socket, isConnected, activeConversation, currentUserSession, toast]);

  const handleUnpinRequested = useCallback(async (messageId: string) => {
    // Use server action to persist unpin and refresh pinned messages
    if (!activeConversation?.id) {
      toast({ title: "Lỗi", description: "Không tìm thấy cuộc trò chuyện hiện tại.", variant: "destructive" });
      return;
    }
    if (!currentUserSession) {
      toast({ title: "Lỗi", description: "Phiên đăng nhập không hợp lệ.", variant: "destructive" });
      return;
    }
    try {
      const updatedConv = await unpinMessageFromConversation(activeConversation.id, messageId, currentUserSession);
      if (updatedConv) {
        setActiveConversation(updatedConv);
        fetchPinnedMessages(updatedConv);
      }
    } catch (error: any) {
      console.error("Error unpinning message via action:", error);
      toast({ title: "Lỗi bỏ ghim", description: error.message || "Không thể bỏ ghim tin nhắn.", variant: "destructive" });
    }
  }, [activeConversation, currentUserSession, fetchPinnedMessages, toast]);

  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(messageId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('bg-yellow-200', 'dark:bg-yellow-700', 'transition-all', 'duration-1000');
      setTimeout(() => {
        element.classList.remove('bg-yellow-200', 'dark:bg-yellow-700');
      }, 2000);
    }
  };

  const handleDirectBookAppointment = async (formData: AppointmentBookingFormData) => {
    if (!currentUserSession || !activeConversation?.id) return;
    setIsChatLoading(true);
    try {
      const result = await handleBookAppointmentFromForm({ ...formData, customerId: currentUserSession.id });
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

      if (activeConversation.id) {
        await createSystemMessage({ conversationId: activeConversation.id, content: systemMessageContent });
        // Fetch lại messages từ server để cập nhật giao diện
        if (activeConversation.id) {
          const updatedMessages = await getConversationHistory(activeConversation.id);
          setCurrentMessages(updatedMessages);
        }
      }

      if (result.success) {
        setIsBookingModalOpen(false);
        // Refresh appointments after successful booking
        const updatedAppointments = await getAppointments({ customerId: currentUserSession.id });
        setAppointments(updatedAppointments);
      }

    } catch (error: any) {
      toast({ title: "Lỗi đặt lịch", description: error.message || "Không thể đặt lịch hẹn.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  };

  const refreshAppointments = async () => {
    if (currentUserSession?.id) {
      const updatedAppointments = await getAppointments({ customerId: currentUserSession.id });
      setAppointments(updatedAppointments);
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
        suggestedReplies={currentMessages.length <= 1 ? currentSuggestedReplies : []}
        onSendMessage={handleSendMessage}
        onSuggestedReplyClick={handleSendMessage}
        isLoading={isChatLoading || isLoadingSession}
        viewerRole="customer"
        onBookAppointmentClick={() => setIsBookingModalOpen(true)}
        onTyping={onTyping}
        typingUsers={typingUsers}
        onScrollToMessage={handleScrollToMessage}
        activeConversationId={activeConversation?.id}
        activeConversationPinnedMessageIds={activeConversation?.pinnedMessageIds || []}
        onPinRequested={handlePinRequested}
        onUnpinRequested={handleUnpinRequested}
        appointments={appointments}
        onCancelAppointment={handleCancelAppointment}
        onAppointmentBooked={refreshAppointments}
      />
    );
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      await deleteExistingAppointment(appointmentId);
      // Refresh appointments list
      const updatedAppointments = await getAppointments({ customerId: currentUserSession?.id || '' });
      setAppointments(updatedAppointments);
      toast({
        title: "Hủy lịch thành công",
        description: "Lịch hẹn đã được hủy thành công.",
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể hủy lịch hẹn. Vui lòng thử lại sau.",
        variant: "destructive",
      });
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

  useEffect(() => {
    if (currentUserSession?.id) {
      getAppointments({ customerId: currentUserSession.id }).then(setAppointments);
    }
  }, [currentUserSession?.id, activeConversation?.id]);
  console.log('activeConversation', activeConversation);

  return (
    <div className="flex flex-col min-h-screen bg-background h-screen">
      <AppHeader userSession={currentUserSession} onLogout={handleLogout} />
      <main className={cn(
        "flex-grow flex items-stretch w-full overflow-hidden pt-16",
        currentUserSession?.role === 'customer' ? "h-[calc(100vh-4rem)] md:max-w-screen-lg md:mx-auto" : "h-auto items-center justify-center"
      )}>
        {renderContent()}
      </main>
      {currentUserSession?.role === 'customer' && activeConversation?.id && (
        <AppointmentBookingForm
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          onSubmit={handleDirectBookAppointment}
          currentUserSession={currentUserSession}
          currentChatCustomerId={currentUserSession.id}
        />
      )}
    </div>
  );
}
