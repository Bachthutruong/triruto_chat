
// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
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
  deleteStaffMessage, // Assuming customers can't delete, but staff actions might be routed here if page is reused
  editStaffMessage,   // Assuming customers can't edit,
  handleBookAppointmentFromForm
} from './actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { getAppSettings } from './actions';
import { AppointmentBookingForm } from '@/components/chat/AppointmentBookingForm';

export default function HomePage() {
  const [currentUserSession, setCurrentUserSession] = useState<UserSession | null>(null);
  const [initialSessionFromStorage, setInitialSessionFromStorage] = useState<UserSession | null>(null);

  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  // Suggested replies are now handled mostly at the start of a new conversation
  const [currentSuggestedReplies, setCurrentSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appSettingsContext = useAppSettingsContext();
  const brandName = appSettingsContext?.brandName || 'AetherChat';


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
        if (prev && prev.id === customerId) {
          const updatedSession = { ...prev, currentConversationId: conversationId };
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('aetherChatUserSession', JSON.stringify(updatedSession));
          }
          return updatedSession;
        }
        return prev;
      });
      // No router.push here to avoid re-triggering effects unnecessarily
    } catch (error) {
      console.error("Lỗi tải cuộc trò chuyện:", error);
      toast({ title: "Lỗi", description: "Không thể tải cuộc trò chuyện.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  }, [toast, appSettingsContext]);


  const loadInitialData = useCallback(async (session: UserSession) => {
    if (session.role !== 'customer') {
      setIsLoadingSession(false);
      return;
    }
    setIsLoadingSession(true);
    try {
      // For customers, there's only one conversation.
      let userConversations = await getUserConversations(session.id);
      let targetConversation: Conversation | null = null;

      if (userConversations.length > 0) {
        targetConversation = userConversations[0]; // Get the first (and only) conversation
      } else {
        // If no conversation exists, create one.
        const newConv = await createNewConversationForUser(session.id, `Trò chuyện với ${session.name || session.phoneNumber}`);
        if (newConv) {
          targetConversation = newConv;
        } else {
          toast({ title: "Lỗi", description: "Không thể tạo cuộc trò chuyện mới.", variant: "destructive" });
          setIsLoadingSession(false);
          return;
        }
      }
      
      if (targetConversation) {
        await loadConversation(targetConversation.id, session.id);
         setActiveConversationId(targetConversation.id); // Set active conversation ID
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
  }, [loadConversation, toast, appSettingsContext]);


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
      router.replace('/enter-phone');
    }
  }, [router]); // Run once on mount or if router changes

  useEffect(() => {
    if (initialSessionFromStorage) {
      setCurrentUserSession(initialSessionFromStorage);
      if (initialSessionFromStorage.role === 'customer') {
        loadInitialData(initialSessionFromStorage);
      } else {
        setIsLoadingSession(false); // For staff/admin, main loading is done.
      }
    }
  }, [initialSessionFromStorage, loadInitialData]);


  const handleLogout = () => {
    const currentSessionString = sessionStorage.getItem('aetherChatUserSession');
    let role: UserSession['role'] | null = null;
    if (currentSessionString) {
        try {
            role = JSON.parse(currentSessionString).role;
        } catch (e) { /* ignore */ }
    }
    setCurrentUserSession(null);
    setInitialSessionFromStorage(null);
    sessionStorage.removeItem('aetherChatUserSession');
    setCurrentMessages([]);
    setCurrentSuggestedReplies([]);
    setActiveConversationId(null);

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
      const { aiMessage, newSuggestedReplies, updatedAppointment } = await processUserMessage(
        messageContent,
        currentUserSession,
        activeConversationId,
        [...currentMessages, userMessage]
      );

      setCurrentMessages((prevMessages) => {
        const existingUserMsgIndex = prevMessages.findIndex(m => m.id === userMessage.id);
        if (existingUserMsgIndex !== -1) {
          const updatedMessages = [...prevMessages];
          updatedMessages.push(aiMessage);
          return updatedMessages;
        }
        return [...prevMessages, aiMessage];
      });
      setCurrentSuggestedReplies([]);

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
          conversations={[]} // Customer has one implicit conversation, so no list to show
          activeConversationId={activeConversationId}
          messages={currentMessages}
          pinnedMessages={currentMessages.filter(m => m.isPinned)}
          suggestedReplies={currentSuggestedReplies}
          onSendMessage={handleSendMessage}
          onSelectConversation={() => {}} // No-op for customer
          isChatLoading={isChatLoading || isLoadingSession}
          viewerRole="customer_view"
          onBookAppointmentClick={() => setIsBookingModalOpen(true)}
        />
      );
    }

    // Fallback if no session (should ideally be caught by initial redirect)
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
      <main className="flex-grow flex items-stretch w-full overflow-hidden pt-16"> {/* pt-16 to offset fixed AppHeader */}
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
      {/* Footer removed for customer chat to maximize chat space */}
      {/* <AppFooter /> */}
    </div>
  );
}
    