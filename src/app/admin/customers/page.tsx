// src/app/admin/customers/page.tsx
'use client';

// This page reuses the StaffCustomersPage component but is routed under /admin/customers
// The StaffLayout/AdminLayout and session checks will handle appropriate access.
// Modifications within StaffCustomersPage will handle role-specific data fetching.
import StaffCustomersPage from '@/app/staff/customers/page';

export default function AdminCustomersManagementPage() {
  return <StaffCustomersPage />;
}
