
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
  handleBookAppointmentFromForm // Added this
} from './actions'; 
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { getAppSettings } from './actions'; 
import { AppointmentBookingForm } from '@/components/chat/AppointmentBookingForm'; // Added this

export default function HomePage() {
  const [currentUserSession, setCurrentUserSession] = useState<UserSession | null>(null);
  const [initialSessionFromStorage, setInitialSessionFromStorage] = useState<UserSession | null>(null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [currentSuggestedReplies, setCurrentSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true); 
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false); 
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false); // State for booking modal
  
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
      router.push(`/?conversationId=${conversationId}`, { scroll: false });

    } catch (error) {
      console.error("Lỗi tải cuộc trò chuyện:", error);
      toast({ title: "Lỗi", description: "Không thể tải cuộc trò chuyện.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  }, [router, toast, appSettingsContext]); 

  const loadInitialData = useCallback(async (session: UserSession) => {
    if (session.role !== 'customer') {
      setIsLoadingSession(false);
      return;
    }
    setIsLoadingSession(true);
    try {
      // For customer, there's only one conversation. Get it.
      let userConversations = await getUserConversations(session.id);
      let targetConversation: Conversation | null = null;

      if (userConversations.length > 0) {
        targetConversation = userConversations[0]; // Assume first one is the active one for customer
      } else {
        // If no conversation exists, create one
        const newConv = await createNewConversationForUser(session.id, `Trò chuyện với ${session.name || session.phoneNumber}`);
        if (newConv) {
          targetConversation = newConv;
          userConversations = [newConv]; // Update local list
        } else {
          toast({ title: "Lỗi", description: "Không thể tạo cuộc trò chuyện mới.", variant: "destructive" });
          setIsLoadingSession(false);
          return;
        }
      }
      setConversations(userConversations); // Set conversations list (will be an array of 1 for customer)
      
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
  }, [loadConversation, toast, appSettingsContext]);

  useEffect(() => {
    setIsLoadingSession(true); 
    const storedSessionString = sessionStorage.getItem('aetherChatUserSession');
    if (storedSessionString) {
      try {
        const session: UserSession = JSON.parse(storedSessionString);
        if (session.role === 'customer' || session.role === 'admin' || session.role === 'staff') {
          setInitialSessionFromStorage(session);
        } else {
           sessionStorage.removeItem('aetherChatUserSession');
           router.replace('/enter-phone');
        }
      } catch (error) {
        console.error("Lỗi phân tích cú pháp session từ sessionStorage:", error);
        sessionStorage.removeItem('aetherChatUserSession');
        router.replace('/enter-phone');
      }
    } else {
      router.replace('/enter-phone'); 
    }
  }, [router]);

  useEffect(() => {
    if (initialSessionFromStorage) {
      setCurrentUserSession(initialSessionFromStorage);
      if (initialSessionFromStorage.role === 'customer') {
        loadInitialData(initialSessionFromStorage);
      } else {
        setIsLoadingSession(false);
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
    setConversations([]);
    setActiveConversationId(null);
    
    if (role === 'admin' || role === 'staff') {
        router.push('/login');
    } else {
        router.push('/enter-phone'); 
    }
  };

  const handleSendMessage = async (messageContent: string) => {
    if (!currentUserSession || currentUserSession.role !== 'customer' || !activeConversationId) return;

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
        return [...prevMessages.filter(m => m.id !== userMessage.id), userMessage, aiMessage];
      });
      setCurrentSuggestedReplies([]); 

      if (updatedAppointment) {
        toast({
          title: "Cập nhật lịch hẹn",
          description: `Dịch vụ: ${updatedAppointment.service}, Ngày: ${updatedAppointment.date}, Giờ: ${updatedAppointment.time}, Trạng thái: ${updatedAppointment.status}`,
        });
      }

      setConversations(prevConvs => 
        prevConvs.map(conv => 
          conv.id === activeConversationId 
          ? { ...conv, lastMessagePreview: aiMessage.content.substring(0, 50), lastMessageTimestamp: aiMessage.timestamp }
          : conv
        ).sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.lastMessageTimestamp || 0).getTime() - new Date(a.lastMessageTimestamp || 0).getTime())
      );

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
  
  const handleCreateNewConversation = async () => {
    if (!currentUserSession || currentUserSession.role !== 'customer') return;
    setIsChatLoading(true);
    try {
      const newConversation = await createNewConversationForUser(currentUserSession.id, `Cuộc trò chuyện mới`);
      if (newConversation) {
        setConversations(prev => [newConversation, ...prev].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.lastMessageTimestamp || 0).getTime() - new Date(a.lastMessageTimestamp || 0).getTime()));
        await loadConversation(newConversation.id, currentUserSession.id);
      } else {
        toast({ title: "Lỗi", description: "Không thể tạo cuộc trò chuyện mới.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Lỗi tạo cuộc trò chuyện mới:", error);
      toast({ title: "Lỗi", description: "Không thể tạo cuộc trò chuyện mới.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    if (conversationId !== activeConversationId && currentUserSession?.id) {
      loadConversation(conversationId, currentUserSession.id);
    }
  };
  
  const handleUpdateConversationTitle = async (conversationId: string, newTitle: string) => {
    if (!currentUserSession) return;
    try {
      const updatedConversation = await updateConversationTitle(conversationId, newTitle, currentUserSession.id);
      if (updatedConversation) {
        setConversations(prevConvs => 
          prevConvs.map(c => c.id === conversationId ? updatedConversation : c)
                   .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.lastMessageTimestamp || 0).getTime() - new Date(a.lastMessageTimestamp || 0).getTime())
        );
        if (activeConversationId === conversationId && currentUserSession.currentConversationId === conversationId) {
          //  setCurrentUserSession(prev => prev ? {...prev, currentConversationTitle: newTitle } : null); 
        }
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
      if (updatedProfile) {
        setConversations(prevConvs => 
          prevConvs.map(c => c.id === conversationId ? { ...c, isPinned: true } : c)
                   .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.lastMessageTimestamp || 0).getTime() - new Date(a.lastMessageTimestamp || 0).getTime())
        );
        if (updatedProfile.pinnedConversationIds?.includes(conversationId)) {
            setCurrentUserSession(prev => prev ? {...prev, pinnedConversationIds: updatedProfile.pinnedConversationIds } : null);
        }
        toast({ title: "Thành công", description: "Đã ghim cuộc trò chuyện." });
      }
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể ghim cuộc trò chuyện.", variant: "destructive" });
    }
  };
  
  const handleUnpinConversation = async (conversationId: string) => {
    if (!currentUserSession) return;
    try {
      const updatedProfile = await unpinConversationForUser(currentUserSession.id, conversationId);
      if (updatedProfile) {
         setConversations(prevConvs => 
          prevConvs.map(c => c.id === conversationId ? { ...c, isPinned: false } : c)
                   .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.lastMessageTimestamp || 0).getTime() - new Date(a.lastMessageTimestamp || 0).getTime())
        );
        if (updatedProfile.pinnedConversationIds && !updatedProfile.pinnedConversationIds.includes(conversationId)) {
            setCurrentUserSession(prev => prev ? {...prev, pinnedConversationIds: updatedProfile.pinnedConversationIds } : null);
        }
        toast({ title: "Thành công", description: "Đã bỏ ghim cuộc trò chuyện." });
      }
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể bỏ ghim cuộc trò chuyện.", variant: "destructive" });
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
            <Card className="w-full max-w-md text-center shadow-xl">
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
            <Card className="w-full max-w-md text-center shadow-xl">
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
      
      return (
        <ChatInterface
          userSession={currentUserSession}
          conversations={conversations} 
          activeConversationId={activeConversationId}
          messages={currentMessages}
          pinnedMessages={messages.filter(m => m.isPinned)} 
          suggestedReplies={currentSuggestedReplies}
          onSendMessage={handleSendMessage}
          onSelectConversation={handleSelectConversation}
          onCreateNewConversation={handleCreateNewConversation}
          isChatLoading={isChatLoading || isLoadingSession}
          viewerRole="customer_view"
          onUpdateConversationTitle={handleUpdateConversationTitle}
          onPinConversation={handlePinConversation}
          onUnpinConversation={handleUnpinConversation}
          onBookAppointmentClick={() => setIsBookingModalOpen(true)} // Pass handler to open modal
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
      <main className="flex-grow flex items-stretch w-full overflow-hidden pt-16">
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

    