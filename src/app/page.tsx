// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; 
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { ChatInterface } from '@/components/chat/ChatInterface';
import type { Message, UserSession, Conversation, MessageViewerRole } from '@/lib/types';
import { 
  handleCustomerAccess, 
  processUserMessage, 
  createNewConversationForUser, 
  getConversationHistory, 
  getUserConversations,
  getMessagesByIds,
  updateConversationTitle,
  pinConversationForUser,
  unpinConversationForUser
} from './actions'; 
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

export default function HomePage() {
  const [currentUserSession, setCurrentUserSession] = useState<UserSession | null>(null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [currentSuggestedReplies, setCurrentSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true); 
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false); 
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appSettings = useAppSettingsContext();
  const brandName = appSettings?.brandName || 'AetherChat';

  const loadConversation = useCallback(async (conversationId: string) => {
    if (!currentUserSession) return;
    setIsChatLoading(true);
    try {
      const messages = await getConversationHistory(conversationId);
      setCurrentMessages(messages);
      setActiveConversationId(conversationId);
      
      // Only show configured suggested replies if it's a new or very short conversation
      const appSettings = await getAppSettings(); // Re-fetch or use context if available globally
      if (messages.length <= 1 && appSettings?.suggestedQuestions && appSettings.suggestedQuestions.length > 0) {
        setCurrentSuggestedReplies(appSettings.suggestedQuestions);
      } else {
        setCurrentSuggestedReplies([]);
      }

      // Update user session with the new active conversation
      setCurrentUserSession(prev => prev ? { ...prev, currentConversationId: conversationId } : null);
      if (typeof window !== 'undefined' && sessionStorage.getItem('aetherChatUserSession')) {
        const sessionData = JSON.parse(sessionStorage.getItem('aetherChatUserSession')!);
        sessionStorage.setItem('aetherChatUserSession', JSON.stringify({ ...sessionData, currentConversationId: conversationId }));
      }
      router.push(`/?conversationId=${conversationId}`, { scroll: false });

    } catch (error) {
      console.error("Lỗi tải cuộc trò chuyện:", error);
      toast({ title: "Lỗi", description: "Không thể tải cuộc trò chuyện.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  }, [currentUserSession, router, toast]);

  const loadInitialData = useCallback(async (session: UserSession) => {
    setIsLoadingSession(true);
    try {
      const fetchedConversations = await getUserConversations(session.id);
      setConversations(fetchedConversations.sort((a, b) => new Date(b.lastMessageTimestamp || 0).getTime() - new Date(a.lastMessageTimestamp || 0).getTime()));

      const conversationIdFromUrl = searchParams.get('conversationId');
      let targetConversationId = conversationIdFromUrl;

      if (targetConversationId && fetchedConversations.some(c => c.id === targetConversationId)) {
        // A specific conversation is requested and exists
      } else if (session.currentConversationId && fetchedConversations.some(c => c.id === session.currentConversationId)) {
        // Use last active conversation from session if valid
        targetConversationId = session.currentConversationId;
      } else if (fetchedConversations.length > 0) {
        // Fallback to the most recent conversation
        targetConversationId = fetchedConversations[0].id;
      } else {
        // No conversations, create a new one
        const newConv = await createNewConversationForUser(session.id, `Cuộc trò chuyện mới`);
        if (newConv) {
          setConversations([newConv]);
          targetConversationId = newConv.id;
        } else {
          toast({ title: "Lỗi", description: "Không thể tạo cuộc trò chuyện mới.", variant: "destructive" });
          setIsLoadingSession(false);
          return;
        }
      }
      
      if (targetConversationId) {
        await loadConversation(targetConversationId);
      } else {
        // Handle case where still no targetConversationId (should be rare after creating new)
        setCurrentMessages([]);
        setCurrentSuggestedReplies(appSettings?.suggestedQuestions || []);
        setActiveConversationId(null);
      }

    } catch (error) {
      console.error("Lỗi tải dữ liệu ban đầu:", error);
      toast({ title: "Lỗi", description: "Không thể tải dữ liệu trò chuyện.", variant: "destructive" });
      router.replace('/enter-phone');
    } finally {
      setIsLoadingSession(false);
    }
  }, [loadConversation, searchParams, toast, router, appSettings]);


  useEffect(() => {
    const storedSessionString = sessionStorage.getItem('aetherChatUserSession');
    if (storedSessionString) {
      try {
        const session: UserSession = JSON.parse(storedSessionString);
        if (session.role === 'customer') {
          setCurrentUserSession(session);
          loadInitialData(session);
        } else if (session.role === 'admin' || session.role === 'staff') {
          setCurrentUserSession(session); 
          setIsLoadingSession(false); // Admin/staff don't load customer chat here
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
  }, [router, loadInitialData]); // Only run once on mount or when router changes. loadInitialData is memoized.

  const handleLogout = () => {
    const currentSessionString = sessionStorage.getItem('aetherChatUserSession');
    let role: UserSession['role'] | null = null;
    if (currentSessionString) {
        try {
            role = JSON.parse(currentSessionString).role;
        } catch (e) { /* ignore */ }
    }

    setCurrentUserSession(null);
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
      
      setCurrentMessages((prevMessages) => [...prevMessages, aiMessage]);
      // newSuggestedReplies should be empty now based on previous change
      setCurrentSuggestedReplies(newSuggestedReplies);

      if (updatedAppointment) {
        toast({
          title: "Cập nhật lịch hẹn",
          description: `Dịch vụ: ${updatedAppointment.service}, Ngày: ${updatedAppointment.date}, Giờ: ${updatedAppointment.time}, Trạng thái: ${updatedAppointment.status}`,
        });
      }

      // Update conversation list with new last message info
      setConversations(prevConvs => 
        prevConvs.map(conv => 
          conv.id === activeConversationId 
          ? { ...conv, lastMessagePreview: aiMessage.content.substring(0, 50), lastMessageTimestamp: aiMessage.timestamp }
          : conv
        ).sort((a, b) => new Date(b.lastMessageTimestamp || 0).getTime() - new Date(a.lastMessageTimestamp || 0).getTime())
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
    if (!currentUserSession) return;
    setIsChatLoading(true);
    try {
      const newConversation = await createNewConversationForUser(currentUserSession.id, `Cuộc trò chuyện mới`);
      if (newConversation) {
        setConversations(prev => [newConversation, ...prev].sort((a, b) => new Date(b.lastMessageTimestamp || 0).getTime() - new Date(a.lastMessageTimestamp || 0).getTime()));
        await loadConversation(newConversation.id); // Load the new conversation
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
    if (conversationId !== activeConversationId) {
      loadConversation(conversationId);
    }
  };
  
  const handleUpdateConversationTitle = async (conversationId: string, newTitle: string) => {
    if (!currentUserSession) return;
    try {
      const updatedConversation = await updateConversationTitle(conversationId, newTitle, currentUserSession.id);
      if (updatedConversation) {
        setConversations(prevConvs => 
          prevConvs.map(c => c.id === conversationId ? updatedConversation : c)
        );
        if (activeConversationId === conversationId) {
          // Optionally update active conversation's title in state if needed elsewhere
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
        toast({ title: "Thành công", description: "Đã bỏ ghim cuộc trò chuyện." });
      }
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể bỏ ghim cuộc trò chuyện.", variant: "destructive" });
    }
  };


  const renderContent = () => {
    if (isLoadingSession) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
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
      
      // Customer view
      return (
        <ChatInterface
          userSession={currentUserSession}
          conversations={conversations}
          activeConversationId={activeConversationId}
          messages={currentMessages}
          suggestedReplies={currentSuggestedReplies}
          onSendMessage={handleSendMessage}
          onSelectConversation={handleSelectConversation}
          onCreateNewConversation={handleCreateNewConversation}
          isChatLoading={isChatLoading || isLoadingSession}
          viewerRole="customer_view"
          onUpdateConversationTitle={handleUpdateConversationTitle}
          onPinConversation={handlePinConversation}
          onUnpinConversation={handleUnpinConversation}
        />
      );
    }
    
    return (
        <div className="flex flex-col items-center justify-center h-full">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Đang chuyển hướng...</p>
        </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader userSession={currentUserSession} onLogout={handleLogout}/>
      <main className="flex-grow flex items-stretch w-full overflow-hidden pt-16"> {/* pt-16 for fixed header */}
        {renderContent()}
      </main>
      {/* Footer might be conditionally rendered or removed for chat interface if it takes full height */}
      {/* <AppFooter /> */}
    </div>
  );
}

