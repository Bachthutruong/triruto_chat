// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { loginUser } from '@/app/actions';
import type { UserSession } from '@/lib/types';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { LogIn } from 'lucide-react';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const appSettings = useAppSettingsContext();
  const brandName = appSettings?.brandName || 'Live Chat';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const session = await loginUser(phoneNumber, password);
      if (session) {
        sessionStorage.setItem('aetherChatUserSession', JSON.stringify(session));
        toast({
          title: 'Đăng nhập thành công',
          description: `Chào mừng quay trở lại, ${session.name || session.phoneNumber}!`,
        });
        if (session.role === 'admin') {
          router.push('/admin/chat');
        } else if (session.role === 'staff') {
          router.push('/staff/chat');
        } else {
          router.push('/');
        }
      } else {
        throw new Error('Thông tin đăng nhập không hợp lệ hoặc người dùng không tồn tại.');
      }
    } catch (error: any) {
      toast({
        title: 'Đăng nhập thất bại',
        description: error.message || 'Đã xảy ra lỗi không mong muốn.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <AppHeader userSession={null} onLogout={() => { }} />
      <main className="flex-grow container mx-auto py-12 px-4 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center">
              <LogIn className="mr-2 h-6 w-6 text-primary" /> Đăng nhập Nhân viên & Admin
            </CardTitle>
            <CardDescription>Truy cập bảng điều khiển {brandName} của bạn.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Nhập số điện thoại của bạn"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu của bạn"
                  required
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
              {/* <p className="text-sm text-muted-foreground">
                Chưa có tài khoản? <Link href="/register" className="text-primary hover:underline">Đăng ký tại đây</Link>
              </p> */}
              <p className="text-sm text-muted-foreground">
                Bạn là khách hàng? <Link href="/enter-phone" className="text-primary hover:underline">Đến trang Chat</Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}
