
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import type { UserSession } from '@/lib/types';
import { LogOut, UserCircle, LayoutDashboard, LogIn } from 'lucide-react'; 
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

type AppHeaderProps = {
  userSession: UserSession | null;
  onLogout: () => void;
};

export function AppHeader({ userSession, onLogout }: AppHeaderProps) {
  const appSettings = useAppSettingsContext();

  const brandName = appSettings?.brandName || 'AetherChat';
  const logoUrl = appSettings?.logoUrl;

  return (
    <header className="py-4 px-6 border-b bg-card shadow-sm sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          {logoUrl ? (
            <Image src={logoUrl} alt={`${brandName} Logo`} width={40} height={40} className="rounded-md" data-ai-hint="logo brand" />
          ) : (
            <Logo />
          )}
          <div>
            <h1 className="text-2xl font-bold text-primary">{brandName}</h1>
            <p className="text-sm text-muted-foreground">Hỗ trợ trực tuyến thông minh</p>
          </div>
        </Link>
        
        <nav className="flex items-center gap-4">
          {userSession ? ( 
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                <UserCircle className="inline mr-1 h-4 w-4" />
                {userSession.name || userSession.phoneNumber} 
                {userSession.role !== 'customer' && ` (${userSession.role === 'admin' ? 'Quản trị' : 'Nhân viên'})`}
              </span>
              {userSession.role === 'admin' && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Admin
                  </Link>
                </Button>
              )}
              {userSession.role === 'staff' && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/staff/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Nhân viên
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
              </Button>
            </>
          ) : ( 
             <Button variant="outline" size="sm" asChild>
               <Link href="/login">
                 <LogIn className="mr-2 h-4 w-4" /> Đăng nhập Nhân viên/Admin
               </Link>
             </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
