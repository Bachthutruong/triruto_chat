'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutDashboard, MessageSquare, User, CalendarDays, Package, BellRing } from 'lucide-react';
import { Logo } from '@/components/icons/Logo';

const staffNavItems = [
  { href: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/staff/chat', label: 'Live Chats', icon: MessageSquare },
  { href: '/staff/customers', label: 'Customers', icon: User },
  { href: '/staff/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/staff/products', label: 'Products/Services', icon: Package },
  { href: '/staff/reminders', label: 'Care Reminders', icon: BellRing },
];

export function StaffSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 z-40 w-64 h-screen pt-20 transition-transform -translate-x-full bg-card border-r sm:translate-x-0">
      <ScrollArea className="h-full py-4 px-3 overflow-y-auto">
        <div className="flex items-center mb-6 px-2">
          <Logo />
          <h2 className="ml-2 text-xl font-semibold text-primary">Staff Panel</h2>
        </div>
        <ul className="space-y-2 font-medium">
          {staffNavItems.map((item) => (
            <li key={item.href}>
              <Button
                asChild
                variant={pathname.startsWith(item.href) ? 'secondary' : 'ghost'}
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
