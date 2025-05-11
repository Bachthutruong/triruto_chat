import Link from 'next/link';
import { Logo } from '@/components/icons/Logo';

export function AppHeader() {
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
        {/* Navigation links can be added here if needed */}
      </div>
    </header>
  );
}
