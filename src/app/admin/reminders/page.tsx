// src/app/admin/reminders/page.tsx
'use client';

// This page reuses the StaffRemindersPage component but is routed under /admin/reminders
// The StaffLayout/AdminLayout and session checks will handle appropriate access.
// Modifications within StaffRemindersPage will handle role-specific data fetching.
import StaffRemindersPage from '@/app/staff/reminders/page';

export default function AdminRemindersManagementPage() {
  return <StaffRemindersPage />;
}