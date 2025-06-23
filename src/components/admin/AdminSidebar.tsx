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
  MessageSquare,
  User,
  Package,
  BellRing,
  MapPin, // Added for Branches
  Zap, // Icon for Quick Replies
  Receipt, // Icon for Invoices
  ShoppingCart, // Icon for Customer Products
  CalendarDays // Icon for Appointments
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

type AdminSidebarProps = {
  userRole: 'admin' | 'staff';
};

export function AdminSidebar({ userRole }: AdminSidebarProps) {
  const pathname = usePathname();
  const appSettings = useAppSettingsContext();
  const { setOpenMobile, isMobile } = useSidebar();
  
  const isAdmin = userRole === 'admin';
  const rolePrefix = isAdmin ? '/admin' : '/staff';
  const brandName = appSettings?.brandName || (isAdmin ? 'Admin Panel' : 'Staff Panel');

  // Base navigation items available to both admin and staff
  const baseNavItems = [
    { href: `${rolePrefix}/dashboard`, label: 'Bảng điều khiển', icon: LayoutDashboard },
    { href: `${rolePrefix}/chat`, label: 'Live Chats', icon: MessageSquare },
    { href: `${rolePrefix}/customers`, label: 'Khách hàng', icon: User },
    { href: `${rolePrefix}/products`, label: 'Sản phẩm/Dịch vụ', icon: Package },
  ];



  // Common bottom items
  const commonBottomItems = [
    { href: `${rolePrefix}/reminders`, label: 'Nhắc nhở Chăm sóc', icon: BellRing },
  ];

  // Build the final navigation items based on role - Staff có đầy đủ như Admin trừ Users
  const navItems = [
    ...baseNavItems,
    // Common items for both admin and staff
    { href: `${rolePrefix}/invoices`, label: 'Hóa đơn & Gán SP', icon: Receipt },
    { href: `${rolePrefix}/branches`, label: 'Quản lý Chi nhánh', icon: MapPin },
    // Staff-specific item (only for staff)
    ...(isAdmin ? [] : [
      { href: `${rolePrefix}/customer-products`, label: 'SP Khách hàng', icon: ShoppingCart },
    ]),
    // Appointments - staff có cả appointments thường và appointments/view, appointments/rules
    ...(isAdmin ? [] : [
      { href: `${rolePrefix}/appointments`, label: 'Lịch hẹn', icon: CalendarDays },
    ]),
    { href: `${rolePrefix}/appointments/view`, label: 'Xem Lịch hẹn', icon: Eye },
    { href: `${rolePrefix}/appointments/rules`, label: 'Quy tắc Đặt lịch', icon: CalendarCog },
    ...commonBottomItems,
    // Common items for both
    { href: `${rolePrefix}/quick-replies`, label: 'Câu trả lời nhanh', icon: Zap },
    { href: `${rolePrefix}/qna`, label: 'Hỏi & Đáp / Từ khóa', icon: MessageSquareText },
    { href: `${rolePrefix}/settings`, label: 'Cài đặt Chung', icon: Settings },
    // Admin-only items (Users management)
    ...(isAdmin ? [
      { href: `${rolePrefix}/users`, label: 'Quản lý Người dùng', icon: Users },
    ] : []),
  ];

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <>
      <SidebarHeader className="border-b">
        <div className="flex items-center h-14 px-3 gap-2">
          <Logo className="w-7 h-7 shrink-0" />
          <h2 className="ml-1 text-lg font-semibold text-primary group-data-[collapsible=icon]:hidden truncate">
            {brandName}
          </h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
          <SidebarMenu className="!py-2 !px-2 md:group-data-[state=collapsed]:gap-4">
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton
                    className="w-full justify-start md:group-data-[state=collapsed]:!px-1"
                    isActive={pathname.startsWith(item.href) && (item.href.endsWith('/dashboard') ? pathname === item.href : true)}
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
