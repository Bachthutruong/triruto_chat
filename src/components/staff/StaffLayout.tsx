import type { ReactNode } from 'react';
import { StaffSidebar } from './StaffSidebar';
import { AppHeader } from '@/components/layout/AppHeader';

type StaffLayoutProps = {
  children: ReactNode;
};

export function StaffLayout({ children }: StaffLayoutProps) {
  // Mock user session for header display, replace with actual session logic
  const mockStaffSession = {
    id: 'staff_001_user',
    phoneNumber: 'staff001',
    role: 'staff' as const,
    name: 'Staff User Alice',
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader userSession={mockStaffSession} onLogout={() => { console.log('Staff logout'); window.location.href = '/'; }} />
      <div className="flex flex-1 pt-16"> {/* Adjust pt-16 based on AppHeader height */}
        <StaffSidebar />
        <main className="flex-1 p-6 sm:ml-64"> {/* Adjust sm:ml-64 based on StaffSidebar width */}
          {children}
        </main>
      </div>
    </div>
  );
}
