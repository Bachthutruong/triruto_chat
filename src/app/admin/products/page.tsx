// src/app/admin/products/page.tsx
'use client';

// This page reuses the StaffProductsPage component but is routed under /admin/products
// The StaffLayout/AdminLayout and session checks will handle appropriate access.
// Product management is typically role-agnostic for viewing, CRUD ops will be permissioned by actions.
import StaffProductsPage from '@/app/staff/products/page';

export default function AdminProductsManagementPage() {
  return <StaffProductsPage />;
}