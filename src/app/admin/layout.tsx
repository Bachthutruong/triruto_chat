// src/app/admin/layout.tsx
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout as AdminLayoutComponent } from '@/components/admin/AdminLayout';
import type { UserSession } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton'; // For loading state

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      try {
        const parsedSession: UserSession = JSON.parse(sessionString);
        // Allow both admin and staff to access routes under /admin
        // This is a broad permission. For more fine-grained control,
        // consider moving shared functionalities to a different path segment
        // or implementing a more detailed role/permission system.
        if (parsedSession && (parsedSession.role === 'admin' || parsedSession.role === 'staff')) {
          setSession(parsedSession);
        } else {
          // If not admin or staff, redirect to login.
          router.replace('/login?error=unauthorized_admin_area');
        }
      } catch (e) {
        console.error("Error parsing session for admin layout:", e);
        router.replace('/login?error=session_error');
      }
    } else {
      router.replace('/login?error=no_session_admin_area');
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

  return <AdminLayoutComponent currentSession={session}>{children}</AdminLayoutComponent>;
}
