'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutDashboard, Users, Settings, MessageSquareText, CalendarCog, ShieldAlert, Eye } from 'lucide-react'; 
import { Logo } from '@/components/icons/Logo';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

const adminNavItems = [
  { href: '/admin/dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Quản lý Người dùng', icon: Users },
  { href: '/admin/qna', label: 'Hỏi & Đáp / Từ khóa', icon: MessageSquareText },
  { href: '/admin/appointments/view', label: 'Xem Lịch hẹn', icon: Eye },
  { href: '/admin/appointments/rules', label: 'Quy tắc Đặt lịch', icon: CalendarCog },
  { href: '/admin/settings', label: 'Cài đặt', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const appSettings = useAppSettingsContext();
  const brandName = appSettings?.brandName || 'Admin';


  return (
    <aside className="fixed top-16 left-0 z-30 w-64 h-[calc(100vh-4rem)] transition-transform -translate-x-full bg-card border-r sm:translate-x-0"> 
      <ScrollArea className="h-full py-4 px-3 overflow-y-auto">
        <div className="flex items-center mb-6 px-2 mt-2"> 
          <Logo />
          <h2 className="ml-2 text-xl font-semibold text-primary">{brandName} Admin</h2>
        </div>
        <ul className="space-y-2 font-medium">
          {adminNavItems.map((item) => (
            <li key={item.href}>
              <Button
                asChild
                variant={pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/admin/dashboard' && item.href.split('/').length > 2 ) ? 'secondary' : 'ghost'}
                className="w-full justify-start"
              >
                <Link href={item.href}>
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </aside>
  );
}