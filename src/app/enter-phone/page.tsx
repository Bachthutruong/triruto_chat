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
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { Logo } from '@/components/icons/Logo';
import Image from 'next/image';

export default function EnterPhonePage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const appSettings = useAppSettingsContext();
  const brandName = appSettings?.brandName || 'AetherChat';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập số điện thoại.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { userSession: custSession } = await handleCustomerAccess(phoneNumber.trim());
      if (custSession) {
        sessionStorage.setItem('aetherChatUserSession', JSON.stringify(custSession));
        toast({
          title: "Bắt đầu trò chuyện",
          description: custSession.name ? `Chào mừng quay trở lại, ${custSession.name}!` : `Chào mừng đến với ${brandName}!`,
        });
        router.push('/'); // Redirect to chat page
      } else {
        throw new Error("Không thể khởi tạo phiên.");
      }
    } catch (error: any) {
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
      return <Image src={logoDataUri} alt={`${brandName} Logo`} width={32} height={32} className="rounded-md h-8 w-8 md:h-10 md:w-10 object-contain" data-ai-hint="logo brand" />;
    }
    if (logoUrl) {
      return <Image src={logoUrl} alt={`${brandName} Logo`} width={32} height={32} className="rounded-md h-8 w-8 md:h-10 md:w-10 object-contain" data-ai-hint="logo brand" />;
    }
    return <Logo className="h-8 w-8 md:h-10 md:w-10" />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <AppHeader userSession={null} onLogout={() => { }} />
      <main className="flex-grow container mx-auto py-12 px-4 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto border shadow-sm p-3 rounded-full w-fit mb-3">
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
                  className="text-center text-lg h-12"
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
