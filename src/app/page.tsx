// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { PhoneNumberModal } from '@/components/chat/PhoneNumberModal';
import { ChatWindow } from '@/components/chat/ChatWindow';
import type { Message, UserSession } from '@/lib/types';
import { handleCustomerAccess, processUserMessage } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export default function HomePage() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPhoneModal, setShowPhoneModal] = useState<boolean>(true); 
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const storedSessionString = sessionStorage.getItem('aetherChatUserSession');
    if (storedSessionString) {
      try {
        const session: UserSession = JSON.parse(storedSessionString);
        setUserSession(session);
        setShowPhoneModal(false); 

        if (session.role === 'customer') {
          initializeCustomerSession(session.phoneNumber, true);
        }
      } catch (error) {
        console.error("Lỗi phân tích cú pháp session từ sessionStorage:", error);
        sessionStorage.removeItem('aetherChatUserSession'); 
        setShowPhoneModal(true); 
      }
    } else {
      setShowPhoneModal(true); 
    }
  }, []); // Removed router from dependencies as it caused re-initialization on navigation

  const initializeCustomerSession = async (phoneNumber: string, isSessionRestore = false) => {
    setIsLoading(true);
    try {
      const { userSession: custSession, initialMessages, initialSuggestedReplies } = await handleCustomerAccess(phoneNumber);
      
      setUserSession(custSession); 
      sessionStorage.setItem('aetherChatUserSession', JSON.stringify(custSession)); 
      
      setMessages(initialMessages || []);
      setSuggestedReplies(initialSuggestedReplies || []);
      setShowPhoneModal(false);

      if (!isSessionRestore) {
        toast({
          title: "Bắt đầu trò chuyện",
          description: custSession.name ? `Chào mừng quay trở lại, ${custSession.name}!` : "Chào mừng đến với AetherChat!",
        });
      }
    } catch (error) {
      console.error("Lỗi khởi tạo phiên khách hàng:", error);
      toast({
        title: "Lỗi",
        description: "Không thể bắt đầu phiên trò chuyện. Vui lòng thử lại.",
        variant: "destructive",
      });
      sessionStorage.removeItem('aetherChatUserSession');
      setUserSession(null);
      setShowPhoneModal(true);
    } finally {
      setIsLoading(false);
    }
  };


  const handlePhoneNumberSubmit = async (phoneNumber: string) => {
    await initializeCustomerSession(phoneNumber);
  };

  const handleLogout = () => {
    setUserSession(null);
    sessionStorage.removeItem('aetherChatUserSession');
    setMessages([]);
    setSuggestedReplies([]);
    setShowPhoneModal(true); 
    router.push('/'); 
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
    setIsLoading(true); 

    try {
      const { aiMessage, newSuggestedReplies, updatedAppointment } = await processUserMessage(
        messageContent,
        userSession, 
        [...messages, userMessage] 
      );
      
      setMessages((prevMessages) => {
        return [...prevMessages, aiMessage];
      });
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
      setIsLoading(false);
    }
  };

  const renderContent = () => {
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
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      );
    }

    if (showPhoneModal) {
      return (
        <PhoneNumberModal
          isOpen={showPhoneModal}
          onSubmit={handlePhoneNumberSubmit} 
          isLoading={isLoading}
        />
      );
    }
    
    return <p>Đang tải AetherChat...</p>; 
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

