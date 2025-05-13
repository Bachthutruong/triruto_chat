// src/app/admin/chat/[customerId]/page.tsx
'use client';

// This page reuses the StaffIndividualChatPage component but is routed under /admin/chat/[customerId]
// The StaffLayout/AdminLayout and session checks will handle appropriate access.
// Modifications within StaffIndividualChatPage might be needed for admin-specific actions if any.
import StaffIndividualChatPage from '@/app/staff/chat/[customerId]/page';

export default function AdminIndividualCustomerChatPage() {
  return <StaffIndividualChatPage />;
}