import type { ReactNode } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';

// This layout applies to all routes starting with /admin

export default function Layout({ children }: { children: ReactNode }) {
  // Here you would typically add authentication checks to ensure only admins can access
  // For example, redirect if not admin.
  // if (!isUserAdmin()) { redirect('/login'); }

  return <AdminLayout>{children}</AdminLayout>;
}
