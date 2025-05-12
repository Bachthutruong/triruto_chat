'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import type { UserSession } from '@/lib/types';
import { LogOut, UserCircle, LayoutDashboard, LogIn } from 'lucide-react'; 
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import type { ReactNode } from 'react';

type AppHeaderProps = {
  userSession: UserSession | null;
  onLogout: () => void;
  sidebarTrigger?: ReactNode; // Changed from boolean to ReactNode
};

export function AppHeader({ userSession, onLogout, sidebarTrigger }: AppHeaderProps) {
  const appSettings = useAppSettingsContext();

  const brandName = appSettings?.brandName || 'AetherChat';
  const logoUrl = appSettings?.logoUrl;

  return (
    <header className="py-3 px-4 md:px-6 border-b bg-card shadow-sm fixed top-0 left-0 right-0 z-50 h-16 flex items-center">
      <div className="container mx-auto flex items-center justify-between h-full">
        <div className="flex items-center gap-2">
          {sidebarTrigger && <div className="sm:hidden">{sidebarTrigger}</div>}
          <Link href="/" className="flex items-center gap-2 md:gap-3">
            {logoUrl ? (
              <Image src={logoUrl} alt={`${brandName} Logo`} width={32} height={32} className="rounded-md h-8 w-8 md:h-10 md:w-10" data-ai-hint="logo brand" />
            ) : (
              <Logo className="h-8 w-8 md:h-10 md:w-10" />
            )}
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-primary">{brandName}</h1>
              <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Hỗ trợ trực tuyến thông minh</p>
            </div>
          </Link>
        </div>
        
        <nav className="flex items-center gap-2 md:gap-4">
          {userSession ? ( 
            <>
              <span className="text-xs sm:text-sm text-muted-foreground hidden md:flex items-center">
                <UserCircle className="inline mr-1 h-4 w-4" />
                {userSession.name || userSession.phoneNumber} 
                {userSession.role !== 'customer' && ` (${userSession.role === 'admin' ? 'Quản trị' : 'Nhân viên'})`}
              </span>
              {userSession.role === 'admin' && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/dashboard">
                    <LayoutDashboard className="mr-0 md:mr-2 h-4 w-4" /> <span className="hidden md:inline">Admin</span>
                  </Link>
                </Button>
              )}
              {userSession.role === 'staff' && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/staff/dashboard">
                    <LayoutDashboard className="mr-0 md:mr-2 h-4 w-4" /> <span className="hidden md:inline">Nhân viên</span>
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onLogout}>
                <LogOut className="mr-0 md:mr-2 h-4 w-4" /> <span className="hidden md:inline">Đăng xuất</span>
              </Button>
            </>
          ) : ( 
             <Button variant="outline" size="sm" asChild>
               <Link href="/login">
                 <LogIn className="mr-2 h-4 w-4" /> Đăng nhập
               </Link>
             </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

