// src/app/staff/layout.tsx
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StaffLayout as StaffLayoutComponent } from '@/components/staff/StaffLayout';
import type { UserSession } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton'; // For loading state
import { getUserSession, extendSession } from '@/lib/utils/auth';

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    // Sử dụng auth utility để lấy session (check cả localStorage và sessionStorage)
    const currentSession = getUserSession();
    if (currentSession) {
      try {
        // Staff or Admin can access staff area (Admin might have more permissions within staff pages)
        if (currentSession.role === 'staff' || currentSession.role === 'admin') {
          setSession(currentSession);
          // Extend session nếu đang dùng remember me
          extendSession();
        } else {
          router.replace('/login?error=unauthorized_staff');
        }
      } catch(e) {
        console.error("Error with session for staff layout:", e);
        router.replace('/login?error=session_error');
      }
    } else {
      router.replace('/login?error=no_session_staff');
    }
    setIsLoading(false);
  }, [router]);

  if (isLoading || !session) {
     // Basic full-page loading skeleton
    return (
      <div className="flex flex-col min-h-screen">
        <Skeleton className="h-16 w-full" /> {/* Header placeholder */}
        <div className="flex flex-1 pt-16">
          <Skeleton className="fixed top-0 left-0 z-40 w-64 h-screen pt-20 hidden sm:block" /> {/* Sidebar placeholder */}
          <main className="flex-1 p-6 sm:ml-64">
            <Skeleton className="h-32 w-full mb-4" />
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </div>
    );
  }
  
  return <StaffLayoutComponent currentSession={session}>{children}</StaffLayoutComponent>;
}
