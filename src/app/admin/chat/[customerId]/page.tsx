// src/app/admin/chat/[customerId]/page.tsx
'use client';

// This page reuses the StaffIndividualChatPage component but is routed under /admin/chat/[customerId]
// The StaffLayout/AdminLayout and session checks will handle appropriate access.
// The StaffIndividualChatPage component will use the staffSession.role to determine behavior (e.g. 'admin' vs 'staff')
import StaffIndividualChatPage from '@/app/staff/chat/[customerId]/page';

export default function AdminIndividualCustomerChatPage() {
  // The StaffIndividualChatPage component itself handles session role.
  // No specific props needed here to differentiate admin from staff view,
  // as the page will read the session from sessionStorage.
  return <StaffIndividualChatPage />;
}