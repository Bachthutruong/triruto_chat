'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    LayoutDashboard, 
    Users, 
    Settings, 
    MessageSquareText, 
    CalendarCog, 
    Eye,
    MessageSquare, // For Live Chats
    User,          // For Khách hàng (Customers)
    Package,       // For Sản phẩm/Dịch vụ
    BellRing       // For Nhắc nhở Chăm sóc
} from 'lucide-react'; 
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

const adminNavItems = [
  { href: '/admin/dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
  // Operational Tools (from staff, adapted for admin)
  { href: '/admin/chat', label: 'Live Chats', icon: MessageSquare },
  { href: '/admin/customers', label: 'Khách hàng', icon: User },
  { href: '/admin/products', label: 'Sản phẩm/Dịch vụ', icon: Package },
  { href: '/admin/reminders', label: 'Nhắc nhở Chăm sóc', icon: BellRing },
  // Appointment Management
  { href: '/admin/appointments/view', label: 'Xem Lịch hẹn', icon: Eye },
  { href: '/admin/appointments/rules', label: 'Quy tắc Đặt lịch', icon: CalendarCog },
  // User & System Management
  { href: '/admin/users', label: 'Quản lý Người dùng', icon: Users }, // Staff/Admin users
  { href: '/admin/qna', label: 'Hỏi & Đáp / Từ khóa', icon: MessageSquareText },
  { href: '/admin/settings', label: 'Cài đặt Chung', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const appSettings = useAppSettingsContext();
  const brandName = appSettings?.brandName || 'Admin Panel';
  const { setOpenMobile, isMobile } = useSidebar();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <>
      <SidebarHeader className="border-b">
        <div className="flex items-center h-14 px-3 gap-2"> {/* Consistent height with AppHeader elements */}
          <Logo className="w-7 h-7 shrink-0" />
          <h2 className="ml-1 text-lg font-semibold text-primary group-data-[collapsible=icon]:hidden truncate">
            {brandName}
          </h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
          <SidebarMenu className="py-2 px-2">
            {adminNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton
                    className="w-full justify-start"
                    isActive={pathname.startsWith(item.href) && (item.href === '/admin/dashboard' ? pathname === item.href : true)}
                    tooltip={{content: item.label, side: 'right', align: 'center', className: 'sm:hidden'}}
                    onClick={handleLinkClick}
                  >
                    <item.icon className="shrink-0" /> {/* mr-3 removed, relying on gap from parent */}
                    <span className="group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
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
