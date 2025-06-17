// src/components/staff/StaffLayout.tsx
'use client';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/layout/AppHeader';
import type { UserSession } from '@/lib/types';
import { StaffSidebar as StaffSidebarContent } from './StaffSidebar';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';

type StaffLayoutProps = {
  children: ReactNode;
  currentSession: UserSession;
};

export function StaffLayout({ children, currentSession }: StaffLayoutProps) {
  const router = useRouter();
  
  const handleLogout = () => {
    sessionStorage.removeItem('aetherChatUserSession');
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
          <Sidebar className="hidden sm:block fixed h-[calc(100vh-4rem)] z-[1000001]" collapsible="icon" side="left" variant="sidebar" style={{ '--sidebar-width-icon': '2rem' } as React.CSSProperties}> {/* Ensure sidebar doesn't overlap content */}
            <StaffSidebarContent />
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
