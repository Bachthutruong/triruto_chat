// src/app/enter-phone/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { Phone, LogIn, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleCustomerAccess } from '@/app/actions';
import type { UserSession } from '@/lib/types';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { Logo } from '@/components/icons/Logo';
import Image from 'next/image';
import { validatePhoneNumber } from '@/lib/validator';

export default function EnterPhonePage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const appSettings = useAppSettingsContext();
  const brandName = appSettings?.brandName || 'AetherChat';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhoneNumber(phoneNumber.trim())) {
      toast({ title: "Lỗi", description: "Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    console.log("EnterPhonePage: Bắt đầu handleCustomerAccess với SĐT:", phoneNumber.trim());
    try {
      // handleCustomerAccess now returns an object with all necessary initial data
      const result = await handleCustomerAccess(phoneNumber.trim());
      console.log("EnterPhonePage: Kết quả từ handleCustomerAccess:", result);

      if (result.userSession) {
        sessionStorage.setItem('aetherChatUserSession', JSON.stringify(result.userSession));

        // Store all pre-fetched data for the main chat page
        sessionStorage.setItem('aetherChatPrefetchedData', JSON.stringify({
          userSession: result.userSession, // Include session here for verification on next page
          initialMessages: result.initialMessages,
          initialSuggestedReplies: result.initialSuggestedReplies,
          activeConversationId: result.activeConversationId,
          conversations: result.conversations,
        }));

        toast({
          title: "Bắt đầu trò chuyện",
          description: result.userSession.name ? `Chào mừng quay trở lại, ${result.userSession.name}!` : `Chào mừng đến với ${brandName}!`,
        });
        router.push('/'); // Redirect to chat page
      } else {
        console.error("EnterPhonePage: handleCustomerAccess không trả về userSession.");
        throw new Error("Không thể khởi tạo phiên.");
      }
    } catch (error: any) {
      console.error("EnterPhonePage: Lỗi trong handleSubmit:", error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể bắt đầu phiên trò chuyện. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  const logoDataUri = appSettings?.logoDataUri;
  const logoUrl = appSettings?.logoUrl;

  const renderLogo = () => {
    if (logoDataUri) {
      return <Image src={logoDataUri} alt={`${brandName} Logo`} width={100} height={100} className="h-16 w-16 md:h-40 md:w-40 object-contain" data-ai-hint="logo brand" />;
    }
    if (logoUrl) {
      return <Image src={logoUrl} alt={`${brandName} Logo`} width={100} height={100} className="h-16 w-16 md:h-40 md:w-40 object-contain" data-ai-hint="logo brand" />;
    }
    return <Logo className="h-16 w-16 md:h-20 md:w-20" />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader userSession={null} onLogout={() => { }} />
      <main className="flex-grow container mx-auto py-12 px-4 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md shadow-none border-none rounded-none">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3">
              {renderLogo()}
            </div>
            <CardTitle className="text-2xl">Chào mừng đến {brandName}!</CardTitle>
            <CardDescription>
              Nhập số điện thoại để bắt đầu hoặc tiếp tục cuộc trò chuyện của bạn.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone-number" className="sr-only">Số điện thoại</Label>
                <Input
                  id="phone-number"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Nhập số điện thoại của bạn"
                  required
                  disabled={isLoading}
                  className="text-center text-lg h-12 w-full"
                  autoComplete="tel"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button type="submit" className="w-full h-11 text-base" disabled={isLoading || !phoneNumber.trim()}>
                {isLoading ? 'Đang xử lý...' : (
                  <>
                    <MessageSquare className="mr-2 h-5 w-5" /> Bắt đầu Chat
                  </>
                )}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Bạn là Nhân viên hoặc Admin?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  Đăng nhập tại đây <LogIn className="inline ml-1 h-4 w-4" />
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}
