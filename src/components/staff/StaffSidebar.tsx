'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutDashboard, MessageSquare, User, CalendarDays, Package, BellRing, ShoppingCart } from 'lucide-react';
import { Logo } from '@/components/icons/Logo';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';

const staffNavItems = [
  { href: '/staff/dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
  { href: '/staff/chat', label: 'Live Chats', icon: MessageSquare },
  { href: '/staff/customers', label: 'Khách hàng', icon: User },
  { href: '/staff/customer-products', label: 'SP Khách hàng', icon: ShoppingCart },
  { href: '/staff/appointments', label: 'Lịch hẹn', icon: CalendarDays },
  { href: '/staff/products', label: 'Sản phẩm/Dịch vụ', icon: Package },
  { href: '/staff/reminders', label: 'Nhắc nhở Chăm sóc', icon: BellRing },
];

export function StaffSidebar() {
  const pathname = usePathname();
  const appSettings = useAppSettingsContext();
  const { setOpenMobile, isMobile } = useSidebar();
  const brandName = appSettings?.brandName || 'Staff Panel';


  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <>
      <SidebarHeader className="border-b">
        <div className="flex items-center h-14 px-3 gap-2"> {/* Consistent height */}
          <Logo className="w-7 h-7 shrink-0" />
          <h2 className="ml-1 text-lg font-semibold text-primary group-data-[collapsible=icon]:hidden truncate">
            {brandName}
          </h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
        <SidebarMenu className="!py-2 !px-2 md:group-data-[state=collapsed]:gap-4">
            {staffNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton
                    className="w-full justify-start md:group-data-[state=collapsed]:!px-1"
                    isActive={pathname.startsWith(item.href) && (item.href === '/admin/dashboard' ? pathname === item.href : true)}
                    tooltip={{ children: item.label, side: 'top', align: 'center', hidden: false }}
                    onClick={handleLinkClick}
                  >
                    <item.icon className="shrink-0 h-5 w-5 md:!h-6 md:!w-6" />
                    <span className="md:hidden truncate">{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </ScrollArea>
      </SidebarContent>
    </>
  );
}
