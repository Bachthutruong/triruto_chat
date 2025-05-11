import Link from 'next/link';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import type { UserSession } from '@/lib/types';
import { LogOut, UserCircle, LayoutDashboard } from 'lucide-react';

type AppHeaderProps = {
  userSession: UserSession | null;
  onLogout: () => void;
};

export function AppHeader({ userSession, onLogout }: AppHeaderProps) {
  return (
    <header className="py-4 px-6 border-b bg-card shadow-sm">
      <div className="container mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-2xl font-bold text-primary">AetherChat</h1>
            <p className="text-sm text-muted-foreground">Intelligent Live Support</p>
          </div>
        </Link>
        
        <nav className="flex items-center gap-4">
          {userSession && (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                <UserCircle className="inline mr-1 h-4 w-4" />
                {userSession.name || userSession.phoneNumber} ({userSession.role})
              </span>
              {userSession.role === 'admin' && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Admin
                  </Link>
                </Button>
              )}
              {userSession.role === 'staff' && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/staff/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Staff
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
