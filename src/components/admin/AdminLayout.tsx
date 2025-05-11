// src/components/admin/AdminLayout.tsx
'use client';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from './AdminSidebar';
import { AppHeader } from '@/components/layout/AppHeader'; 
import type { UserSession } from '@/lib/types';

type AdminLayoutProps = {
  children: ReactNode;
  currentSession: UserSession; // Session passed from the protected layout
};

export function AdminLayout({ children, currentSession }: AdminLayoutProps) {
  const router = useRouter();

  const handleLogout = () => {
    sessionStorage.removeItem('aetherChatUserSession');
    router.push('/login'); // Or '/' if you prefer homepage after logout
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader userSession={currentSession} onLogout={handleLogout} />
      <div className="flex flex-1"> {/* pt-16 removed as AppHeader is sticky now */}
        <AdminSidebar />
        <main className="flex-1 p-6 sm:ml-64 mt-16"> {/* Added mt-16 for AppHeader height */}
          {children}
        </main>
      </div>
    </div>
  );
}
