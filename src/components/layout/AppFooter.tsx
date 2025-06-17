
'use client';

import Link from 'next/link';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

export function AppFooter() {
  const appSettings = useAppSettingsContext();
  const brandName = appSettings?.brandName || 'Live Chat';
  const footerText = appSettings?.footerText || `© ${new Date().getFullYear()} ${brandName}. Đã đăng ký Bản quyền.`;

  return (
    <footer className="py-6 px-6 border-t bg-card text-muted-foreground">
      <div className="container mx-auto text-center text-sm">
        <p>© 2023 Triruto Live Chat. Đã đăng ký Bản quyền.</p>
        <div className="mt-2 space-x-4">
          <Link href={`mailto:trirutohaircare@gmail.com`} className="hover:text-primary">
            trirutohaircare@gmail.com
          </Link>
          <span className="text-border">|</span>
          <Link href="tel:+84909097664" className="hover:text-primary">
            Hotline: 0909097664
          </Link>
          {/* <span className="text-border">|</span> */}
          {/* <Link href="/policies" className="hover:text-primary">
            Chính sách
          </Link> */}
        </div>
      </div>
    </footer>
  );
}

