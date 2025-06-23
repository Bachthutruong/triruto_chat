// src/components/staff/StaffLayout.tsx
'use client';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/layout/AppHeader';
import type { UserSession } from '@/lib/types';
import { AdminSidebar as SharedSidebarContent } from '../admin/AdminSidebar';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { clearUserSession } from '@/lib/utils/auth';
import { useNotification } from '@/hooks/use-notification';

type StaffLayoutProps = {
  children: ReactNode;
  currentSession: UserSession;
};

export function StaffLayout({ children, currentSession }: StaffLayoutProps) {
  const router = useRouter();
  
  // Initialize notification system for staff users
  useNotification();
  
  const handleLogout = () => {
    // Sử dụng auth utility để xóa toàn bộ session data
    clearUserSession();
    router.push('/login');
  };

  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen bg-muted/40">
        <AppHeader
          userSession={currentSession}
          onLogout={handleLogout}
          sidebarTrigger={<SidebarTrigger className="sm:hidden" />}
        />
        <div className="flex flex-1 mt-16"> {/* mt-16 for fixed AppHeader */}
          <Sidebar
            className="hidden sm:block fixed h-[calc(100vh-4rem)] z-[1000001]"
            collapsible="icon"
            side="left"
            variant="sidebar"
            style={{ '--sidebar-width-icon': '2rem' } as React.CSSProperties}
          >
            <SharedSidebarContent userRole={currentSession.role as 'admin' | 'staff'} />
          </Sidebar>
          <SidebarInset> {/* Manages margin based on desktop sidebar state */}
            <main className="flex-1 p-4 md:p-6 overflow-y-auto">
              {children}
            </main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
