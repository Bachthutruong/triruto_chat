// src/app/admin/chat/[customerId]/page.tsx
'use client';

// This page reuses the StaffIndividualChatPage component but is routed under /admin/chat/[customerId]
// The StaffLayout/AdminLayout and session checks will handle appropriate access.
// The StaffIndividualChatPage component will use the staffSession.role to determine behavior (e.g. 'admin' vs 'staff')
import StaffIndividualChatPage from '@/app/staff/chat/[customerId]/page'; // Reusing the detailed chat view component

export default function AdminIndividualCustomerChatPage() {
  // StaffIndividualChatPage internally uses useParams to get customerId and sessionStorage for staff/admin session.
  // The AdminChatLayout will provide the customer list on the left.
  return <StaffIndividualChatPage />;
}