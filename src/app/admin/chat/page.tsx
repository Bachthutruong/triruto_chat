// src/app/admin/chat/page.tsx
'use client';

// This page reuses the StaffChatPage component but is routed under /admin/chat
// The StaffLayout/AdminLayout and session checks will handle appropriate access.
// Modifications within StaffChatPage will handle role-specific data fetching.
import StaffChatPage from '@/app/staff/chat/page';

export default function AdminLiveChatsPage() {
  return <StaffChatPage />;
}