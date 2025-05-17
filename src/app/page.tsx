
// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
// import { AppFooter } from '@/components/layout/AppFooter'; // Footer removed for customer chat
import { ChatInterface } from '@/components/chat/ChatInterface';
import type { Message, UserSession, Conversation, MessageViewerRole, AppointmentBookingFormData } from '@/lib/types';
import { 
  handleCustomerAccess, 
  processUserMessage, 
  createNewConversationForUser, 
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
  handleBookAppointmentFromForm
} from './actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { getAppSettings } from './actions'; // Keep this for initial settings
import { AppointmentBookingForm } from '@/components/chat/AppointmentBookingForm';

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
  const appSettingsContext = useAppSettingsContext(); // For dynamic brandName
  const [brandName, setBrandName] = useState('AetherChat');

  // For polling messages
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Set brandName from context or fetch if context is null initially
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


  const loadConversation = useCallback(async (conversationId: string, customerId: string) => {
    if (!customerId) {
      console.warn("loadConversation called without customerId");
      return;
    }
    setIsChatLoading(true);
    try {
      const messages = await getConversationHistory(conversationId);
      setCurrentMessages(messages);
      setActiveConversationId(conversationId);

      const currentAppSettings = appSettingsContext || await getAppSettings();
      if (messages.length <= 1 && currentAppSettings?.suggestedQuestions && currentAppSettings.suggestedQuestions.length > 0) {
        setCurrentSuggestedReplies(currentAppSettings.suggestedQuestions);
      } else {
        setCurrentSuggestedReplies([]);
      }
      
      setCurrentUserSession(prev => {
        if (prev && prev.id === customerId) { // Check if prev exists
          const updatedSession = { ...prev, currentConversationId: conversationId };
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('aetherChatUserSession', JSON.stringify(updatedSession));
          }
          return updatedSession;
        }
        return prev; // Return previous state if no update needed or prev is null
      });

    } catch (error) {
      console.error("Lỗi tải cuộc trò chuyện:", error);
      toast({ title: "Lỗi", description: "Không thể tải cuộc trò chuyện.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  }, [toast, appSettingsContext, getConversationHistory]); // getConversationHistory is stable

  const loadInitialData = useCallback(async (session: UserSession) => {
    if (session.role !== 'customer' || !session.id) {
      setIsLoadingSession(false);
      return;
    }
    setIsLoadingSession(true);
    try {
      let userConversations = await getUserConversations(session.id);
      let targetConversation: Conversation | null = null;
      
      if (userConversations.length > 0) {
          targetConversation = userConversations[0]; // Customer has one primary conversation
      } else {
        const newConvDoc = await createNewConversationForUser(session.id, `Trò chuyện với ${session.name || session.phoneNumber}`);
        if (newConvDoc) {
          targetConversation = newConvDoc;
          userConversations = [newConvDoc]; // Update local list
        } else {
          toast({ title: "Lỗi", description: "Không thể tạo cuộc trò chuyện mới.", variant: "destructive" });
          setIsLoadingSession(false);
          return;
        }
      }
      setConversations(userConversations);

      if (targetConversation) {
        await loadConversation(targetConversation.id, session.id);
      } else {
        setCurrentMessages([]);
        const currentAppSettings = appSettingsContext || await getAppSettings();
        setCurrentSuggestedReplies(currentAppSettings?.suggestedQuestions || []);
        setActiveConversationId(null);
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu ban đầu:", error);
      toast({ title: "Lỗi", description: "Không thể tải dữ liệu trò chuyện.", variant: "destructive" });
    } finally {
      setIsLoadingSession(false);
    }
  }, [loadConversation, toast, appSettingsContext, getUserConversations, createNewConversationForUser, getAppSettings]);


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
      router.replace('/enter-phone');
    }
    // setIsLoadingSession(false); // Moved to the next effect's finally block
  }, [router]);

  useEffect(() => {
    if (initialSessionFromStorage) {
      setCurrentUserSession(initialSessionFromStorage);
      if (initialSessionFromStorage.role === 'customer') {
        loadInitialData(initialSessionFromStorage);
      } else {
        setIsLoadingSession(false); 
      }
    } else {
      // If initialSessionFromStorage is null after the first effect (e.g. user was redirected)
      // ensure loading state is false to prevent indefinite loading screen
      setIsLoadingSession(false);
    }
  }, [initialSessionFromStorage, loadInitialData]);

  // Polling for new messages
  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    if (currentUserSession && currentUserSession.role === 'customer' && activeConversationId) {
      const pollMessages = async () => {
        try {
          // console.log(`Polling messages for customer conv ${activeConversationId}`);
          const newMessages = await getConversationHistory(activeConversationId);
          setCurrentMessages(prevMessages => {
            if (JSON.stringify(newMessages) !== JSON.stringify(prevMessages)) {
              return newMessages;
            }
            return prevMessages;
          });
        } catch (err) {
          console.error(`Error polling messages for customer conv ${activeConversationId}:`, err);
        }
      };
      pollingIntervalRef.current = setInterval(pollMessages, 5000); // Poll every 5 seconds
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [currentUserSession, activeConversationId, getConversationHistory]);


  const handleLogout = () => {
    const currentSessionString = sessionStorage.getItem('aetherChatUserSession');
    let role: UserSession['role'] | null = null;
    if (currentSessionString) {
        try {
            role = JSON.parse(currentSessionString).role;
        } catch (e) { /* ignore */ }
    }
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setCurrentUserSession(null);
    setInitialSessionFromStorage(null);
    sessionStorage.removeItem('aetherChatUserSession');
    setCurrentMessages([]);
    setCurrentSuggestedReplies([]);
    setActiveConversationId(null);
    setConversations([]);

    if (role === 'admin' || role === 'staff') {
        router.push('/login');
    } else {
        router.push('/enter-phone');
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
    };

    setCurrentMessages((prevMessages) => [...prevMessages, userMessage]);
    setCurrentSuggestedReplies([]);
    setIsChatLoading(true);

    try {
      const { aiMessage, updatedAppointment } = await processUserMessage(
        messageContent,
        currentUserSession,
        activeConversationId,
        [...currentMessages, userMessage] 
      );

      setCurrentMessages((prevMessages) => {
        // Remove local user message and add AI's response and potentially updated user message from server
        // For simplicity here, just adding AI message. A more robust solution would match IDs if server returns user message.
        return [...prevMessages.filter(m => m.id !== userMessage.id), userMessage, aiMessage];
      });
      // setCurrentSuggestedReplies(newSuggestedReplies); // No longer generating new suggestions after initial

      if (updatedAppointment) {
        toast({
          title: "Cập nhật lịch hẹn",
          description: `Dịch vụ: ${updatedAppointment.service}, Ngày: ${updatedAppointment.date}, Giờ: ${updatedAppointment.time}, Trạng thái: ${updatedAppointment.status}`,
        });
        // Potentially update local appointments state if managing one
      }

    } catch (error) {
      console.error("Lỗi xử lý tin nhắn:", error);
      const errorMessage: Message = {
        id: `msg_error_${Date.now()}`,
        sender: 'system',
        content: 'Xin lỗi, tôi gặp lỗi. Vui lòng thử lại.',
        timestamp: new Date(),
        conversationId: activeConversationId,
      };
      setCurrentMessages((prevMessages) => [...prevMessages, errorMessage]);
       toast({
        title: "Lỗi tin nhắn",
        description: "Không thể xử lý tin nhắn của bạn. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSelectConversation = useCallback(async (conversationId: string) => {
    if (currentUserSession && currentUserSession.id) {
      await loadConversation(conversationId, currentUserSession.id);
    }
  }, [currentUserSession, loadConversation]);

  const handleCreateNewConversation = useCallback(async () => {
    if (!currentUserSession || !currentUserSession.id) return;
    setIsChatLoading(true);
    try {
      const newConv = await createNewConversationForUser(currentUserSession.id, `Cuộc trò chuyện mới ${new Date().toLocaleTimeString('vi-VN')}`);
      if (newConv) {
        setConversations(prev => [newConv, ...prev]);
        await handleSelectConversation(newConv.id);
        const currentAppSettings = appSettingsContext || await getAppSettings();
        setCurrentSuggestedReplies(currentAppSettings?.suggestedQuestions || []);
      }
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể tạo cuộc trò chuyện mới.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  }, [currentUserSession, handleSelectConversation, toast, appSettingsContext, createNewConversationForUser, getAppSettings]);

  const handleUpdateConversationTitle = async (conversationId: string, newTitle: string) => {
    if (!currentUserSession) return;
    try {
        const updatedConversation = await updateConversationTitle(conversationId, newTitle, currentUserSession.id);
        if (updatedConversation) {
            setConversations(prev => prev.map(c => c.id === conversationId ? updatedConversation : c));
            toast({ title: "Thành công", description: "Đã cập nhật tiêu đề cuộc trò chuyện." });
        }
    } catch (error: any) {
        toast({ title: "Lỗi", description: error.message || "Không thể cập nhật tiêu đề.", variant: "destructive" });
    }
  };

  const handlePinConversation = async (conversationId: string) => {
      if (!currentUserSession) return;
      try {
          const updatedProfile = await pinConversationForUser(currentUserSession.id, conversationId);
          if (updatedProfile && updatedProfile.pinnedConversationIds) {
              setCurrentUserSession(prev => prev ? {...prev, pinnedConversationIds: updatedProfile.pinnedConversationIds} : null);
              setConversations(prev => prev.map(c => c.id === conversationId ? {...c, isPinned: true} : c));
              toast({title: "Thành công", description: "Đã ghim cuộc trò chuyện."});
          }
      } catch (error: any) {
          toast({title: "Lỗi", description: error.message, variant: "destructive"});
      }
  };

  const handleUnpinConversation = async (conversationId: string) => {
      if (!currentUserSession) return;
      try {
          const updatedProfile = await unpinConversationForUser(currentUserSession.id, conversationId);
          if (updatedProfile && updatedProfile.pinnedConversationIds) {
              setCurrentUserSession(prev => prev ? {...prev, pinnedConversationIds: updatedProfile.pinnedConversationIds} : null);
              setConversations(prev => prev.map(c => c.id === conversationId ? {...c, isPinned: false} : c));
              toast({title: "Thành công", description: "Đã bỏ ghim cuộc trò chuyện."});
          }
      } catch (error: any) {
          toast({title: "Lỗi", description: error.message, variant: "destructive"});
      }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!activeConversationId || !currentUserSession) return;
    try {
        const updatedConversation = await pinMessageToConversation(activeConversationId, messageId, currentUserSession);
        if (updatedConversation) {
            setConversations(prev => prev.map(c => c.id === activeConversationId ? updatedConversation : c));
            // Also update currentMessages to reflect pinned status
            setCurrentMessages(prev => prev.map(m => m.id === messageId ? {...m, isPinned: true} : m));
            toast({title: "Thành công", description: "Đã ghim tin nhắn."});
        }
    } catch (error: any) {
        toast({title: "Lỗi ghim tin nhắn", description: error.message, variant: "destructive"});
    }
  };

  const handleUnpinMessage = async (messageId: string) => {
      if (!activeConversationId || !currentUserSession) return;
      try {
          const updatedConversation = await unpinMessageFromConversation(activeConversationId, messageId, currentUserSession);
           if (updatedConversation) {
            setConversations(prev => prev.map(c => c.id === activeConversationId ? updatedConversation : c));
            setCurrentMessages(prev => prev.map(m => m.id === messageId ? {...m, isPinned: false} : m));
            toast({title: "Thành công", description: "Đã bỏ ghim tin nhắn."});
        }
      } catch (error: any) {
          toast({title: "Lỗi bỏ ghim tin nhắn", description: error.message, variant: "destructive"});
      }
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
      if(result.success) setIsBookingModalOpen(false);

    } catch (error: any) {
      toast({ title: "Lỗi đặt lịch", description: error.message || "Không thể đặt lịch hẹn.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  };


  const renderContent = () => {
    if (isLoadingSession || !initialSessionFromStorage) {
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

      // Customer view
      return (
        <ChatInterface
          userSession={currentUserSession}
          conversations={conversations} // For customer, this list might be just one, or managed differently if multiple allowed
          activeConversationId={activeConversationId}
          messages={currentMessages}
          pinnedMessages={currentMessages.filter(m => m.isPinned)} // Dynamically filter from currentMessages
          suggestedReplies={currentSuggestedReplies}
          onSendMessage={handleSendMessage}
          onSelectConversation={handleSelectConversation}
          onCreateNewConversation={handleCreateNewConversation}
          isChatLoading={isChatLoading || isLoadingSession}
          viewerRole="customer_view" 
          onUpdateConversationTitle={handleUpdateConversationTitle}
          onPinConversation={handlePinConversation}
          onUnpinConversation={handleUnpinConversation}
          onPinMessage={handlePinMessage}
          onUnpinMessage={handleUnpinMessage}
          onBookAppointmentClick={() => setIsBookingModalOpen(true)}
        />
      );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full flex-grow">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Đang chuẩn bị...</p>
        </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader userSession={currentUserSession} onLogout={handleLogout}/>
      <main className="flex-grow flex items-stretch w-full overflow-hidden pt-16 h-[calc(100vh-4rem)]">
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
      {/* Footer removed to maximize chat space, as requested */}
    </div>
  );
}
    
