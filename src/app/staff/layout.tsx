import type { ReactNode } from 'react';
import { StaffLayout } from '@/components/staff/StaffLayout';

// This layout applies to all routes starting with /staff

export default function Layout({ children }: { children: ReactNode }) {
  // Here you would typically add authentication checks to ensure only staff can access
  // For example, redirect if not staff.
  // if (!isUserStaff()) { redirect('/login'); }
  
  return <StaffLayout>{children}</StaffLayout>;
}
