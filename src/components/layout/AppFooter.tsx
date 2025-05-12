
'use client';

import Link from 'next/link';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

export function AppFooter() {
  const appSettings = useAppSettingsContext();
  const footerText = appSettings?.footerText || `© ${new Date().getFullYear()} AetherChat. Đã đăng ký Bản quyền.`;

  return (
    <footer className="py-6 px-6 border-t bg-card text-muted-foreground">
      <div className="container mx-auto text-center text-sm">
        <p>{footerText}</p>
        <div className="mt-2 space-x-4">
          <Link href="mailto:hotro@aetherchat.com" className="hover:text-primary">
            hotro@aetherchat.com
          </Link>
          <span className="text-border">|</span>
          <Link href="tel:+84123456789" className="hover:text-primary">
            Hotline: (0123) 456 789
          </Link>
          <span className="text-border">|</span>
          <Link href="/policies" className="hover:text-primary">
            Chính sách
          </Link>
        </div>
      </div>
    </footer>
  );
}
