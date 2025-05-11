import type { ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AppHeader } from '@/components/layout/AppHeader'; // Re-use AppHeader for consistency
import { useToast } from '@/hooks/use-toast'; // For potential notifications
// In a real app, you'd fetch user session here or use a context
// For now, we assume if you're in AdminLayout, you're an admin

type AdminLayoutProps = {
  children: ReactNode;
};

export function AdminLayout({ children }: AdminLayoutProps) {
  // Mock user session for header display, replace with actual session logic
  const mockAdminSession = {
    id: 'admin_001_user',
    phoneNumber: 'admin001',
    role: 'admin' as const, // Use 'as const' for type safety
    name: 'Admin User',
  };

  return (
    <div className="flex flex-col min-h-screen">
       {/* Header can be shared or specific. For now, re-using AppHeader. 
           A more robust solution would involve a global session context.
           The onLogout function for Admin/Staff layouts would redirect to a login page or main page.
       */}
      <AppHeader userSession={mockAdminSession} onLogout={() => { console.log('Admin logout'); window.location.href = '/'; }} />
      <div className="flex flex-1 pt-16"> {/* Adjust pt-16 based on AppHeader height */}
        <AdminSidebar />
        <main className="flex-1 p-6 sm:ml-64"> {/* Adjust sm:ml-64 based on AdminSidebar width */}
          {children}
        </main>
      </div>
    </div>
  );
}
