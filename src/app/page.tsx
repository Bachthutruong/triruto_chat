// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { ChatWindow } from '@/components/chat/ChatWindow';
import type { Message, UserSession } from '@/lib/types';
import { handleCustomerAccess, processUserMessage } from './actions'; 
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

export default function HomePage() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); 
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false); 
  
  const { toast } = useToast();
  const router = useRouter();
  const appSettings = useAppSettingsContext();
  const brandName = appSettings?.brandName || 'AetherChat';

  useEffect(() => {
    const storedSessionString = sessionStorage.getItem('aetherChatUserSession');
    if (storedSessionString) {
      try {
        const session: UserSession = JSON.parse(storedSessionString);
        if (session.role === 'customer') {
          setUserSession(session);
          initializeCustomerChat(session.phoneNumber); 
        } else if (session.role === 'admin' || session.role === 'staff') {
          setUserSession(session); 
          setIsLoading(false);
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

  const initializeCustomerChat = async (phoneNumber: string) => {
    setIsLoading(true); 
    try {
      const { initialMessages, initialSuggestedReplies, userSession: updatedSession } = await handleCustomerAccess(phoneNumber);
      
      setUserSession(updatedSession); 
      sessionStorage.setItem('aetherChatUserSession', JSON.stringify(updatedSession));

      setMessages(initialMessages || []);
      setSuggestedReplies(initialSuggestedReplies || []);
    } catch (error) {
      console.error("Lỗi khởi tạo phiên khách hàng:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu trò chuyện. Vui lòng thử lại.",
        variant: "destructive",
      });
      sessionStorage.removeItem('aetherChatUserSession');
      setUserSession(null);
      router.replace('/enter-phone');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    const currentSessionString = sessionStorage.getItem('aetherChatUserSession');
    let role: UserSession['role'] | null = null;
    if (currentSessionString) {
        try {
            role = JSON.parse(currentSessionString).role;
        } catch (e) { /* ignore */ }
    }

    setUserSession(null);
    sessionStorage.removeItem('aetherChatUserSession');
    setMessages([]);
    setSuggestedReplies([]);
    
    if (role === 'admin' || role === 'staff') {
        router.push('/login');
    } else {
        router.push('/enter-phone'); 
    }
  };

  const handleSendMessage = async (messageContent: string) => {
    if (!userSession || userSession.role !== 'customer') return;

    const userMessage: Message = {
      id: `msg_local_user_${Date.now()}`, 
      sender: 'user',
      content: messageContent,
      timestamp: new Date(),
      name: userSession.name || 'Khách',
    };
    
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setSuggestedReplies([]); 
    setIsChatLoading(true); 

    try {
      const { aiMessage, newSuggestedReplies, updatedAppointment } = await processUserMessage(
        messageContent,
        userSession, 
        [...messages, userMessage] 
      );
      
      setMessages((prevMessages) => [...prevMessages, aiMessage]);
      setSuggestedReplies(newSuggestedReplies);

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
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
       toast({
        title: "Lỗi tin nhắn",
        description: "Không thể xử lý tin nhắn của bạn. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Đang tải {brandName}...</p>
        </div>
      );
    }

    if (userSession) {
      if (userSession.role === 'admin') {
        return (
          <Card className="w-full max-w-md text-center shadow-xl">
            <CardHeader>
              <CardTitle>Truy cập Admin</CardTitle>
              <CardDescription>Chào mừng, {userSession.name || 'Admin'}.</CardDescription>
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

      if (userSession.role === 'staff') {
        return (
          <Card className="w-full max-w-md text-center shadow-xl">
            <CardHeader>
              <CardTitle>Truy cập Nhân viên</CardTitle>
              <CardDescription>Chào mừng, {userSession.name || 'Nhân viên'}.</CardDescription>
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
      
      return (
        <Card className="w-full max-w-2xl h-[70vh] shadow-2xl rounded-lg flex flex-col">
          <CardContent className="p-0 flex-grow flex flex-col overflow-hidden">
            <ChatWindow
              userSession={userSession}
              messages={messages}
              suggestedReplies={suggestedReplies}
              onSendMessage={handleSendMessage}
              onSuggestedReplyClick={handleSendMessage} 
              isLoading={isChatLoading}
              viewerRole="customer_view" // Customer is always 'customer_view'
            />
          </CardContent>
        </Card>
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
    <div className="flex flex-col min-h-screen bg-muted/40">
      <AppHeader userSession={userSession} onLogout={handleLogout}/>
      <main className="flex-grow container mx-auto py-8 px-4 flex justify-center items-center">
        {renderContent()}
      </main>
      <AppFooter />
    </div>
  );
}