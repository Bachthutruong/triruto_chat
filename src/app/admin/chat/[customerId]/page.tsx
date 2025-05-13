// src/app/admin/chat/[customerId]/page.tsx
'use client';

// This page reuses the StaffIndividualChatPage component but is routed under /admin/chat/[customerId]
// The StaffLayout/AdminLayout and session checks will handle appropriate access.
// The StaffIndividualChatPage component will use the staffSession.role to determine behavior (e.g. 'admin' vs 'staff')
import StaffIndividualChatPage from '@/app/staff/chat/[customerId]/page';
import { useState, useEffect } from 'react';
import type { UserSession } from '@/lib/types';

export default function AdminIndividualCustomerChatPage() {
  const [adminSession, setAdminSession] = useState<UserSession | null>(null);

  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      const session = JSON.parse(sessionString) as UserSession;
      if (session.role === 'admin') {
        setAdminSession(session);
      }
    }
  }, []);
  
  // StaffIndividualChatPage now internally uses sessionStorage to get the session,
  // and also handles pinning logic internally.
  return <StaffIndividualChatPage />;
}
