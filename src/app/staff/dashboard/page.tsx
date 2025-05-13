'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, Users, CalendarCheck, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';
import type { CustomerProfile, StaffDashboardStats, UserSession } from '@/lib/types';
import { getCustomersForStaffView, getStaffDashboardStats } from '@/app/actions';
import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function StaffDashboardPage() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [stats, setStats] = useState<StaffDashboardStats | null>(null);
  const [staffSession, setStaffSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      const session = JSON.parse(sessionString) as UserSession;
      setStaffSession(session);
    } else {
      setError("Không tìm thấy phiên làm việc. Vui lòng đăng nhập lại.");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (staffSession) {
      const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const [fetchedCustomers, fetchedStats] = await Promise.all([
            getCustomersForStaffView(staffSession.id), // Pass staffId here
            getStaffDashboardStats(staffSession.id)
          ]);
          setCustomers(fetchedCustomers);
          setStats(fetchedStats);
        } catch (err) {
          console.error("Không thể tải dữ liệu bảng điều khiển nhân viên:", err);
          setError("Không thể tải dữ liệu. Vui lòng thử lại.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [staffSession]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (error) {
     return (
      <div className="space-y-6 text-center">
         <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold text-destructive">Đã xảy ra lỗi</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => window.location.reload()}>Thử lại</Button>
      </div>
    );
  }

  if (!stats) {
    return <p className="text-center text-muted-foreground">Không có dữ liệu thống kê để hiển thị.</p>;
  }

  return (
    <div className="space-y-6 px-2 sm:px-4">
      <h1 className="text-3xl font-bold">Bảng điều khiển Nhân viên</h1>
      <p className="text-muted-foreground">Quản lý tương tác khách hàng và lịch hẹn của bạn.</p>

       <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chat của bạn hôm nay</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeChatsAssignedToMeCount}</div>
            <p className="text-xs text-muted-foreground">Khách hàng được giao cho bạn, có tương tác hôm nay</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lịch hẹn của bạn hôm nay</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.myAppointmentsTodayCount}</div>
             <Link href="/staff/appointments" className="text-xs text-primary hover:underline">Xem chi tiết</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng khách được giao</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssignedToMeCount}</div>
            <p className="text-xs text-muted-foreground">Tổng số khách hàng đang do bạn phụ trách</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hàng đợi Khách hàng & Tương tác Gần đây</CardTitle>
          <CardDescription>Khách hàng được giao cho bạn hoặc chưa được giao, cần chú ý.</CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-muted-foreground">Không có khách hàng nào trong hàng đợi của bạn.</p>
          ) : (
            <>
              {/* Mobile: Stacked cards */}
              <div className="block md:hidden space-y-4">
                {customers.slice(0, 10).map((customer) => (
                  <div key={customer.id} className="border rounded-lg p-4 flex flex-col gap-2 bg-muted/50">
                    <div><span className="font-semibold">Tên: </span>{customer.name || `Người dùng ${customer.phoneNumber}`}</div>
                    <div><span className="font-semibold">Điện thoại: </span>{customer.phoneNumber}</div>
                    <div><span className="font-semibold">Tương tác cuối: </span>{format(new Date(customer.lastInteractionAt), 'dd/MM/yyyy HH:mm', { locale: vi })}</div>
                    <div><span className="font-semibold">Được giao cho: </span>{customer.assignedStaffName || <span className="italic text-muted-foreground">Chưa giao</span>}</div>
                    <div className="mt-2 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/staff/chat/${customer.id}`} className="flex items-center justify-end">
                          Mở Chat <ArrowRight className="ml-2 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên</TableHead>
                      <TableHead>Điện thoại</TableHead>
                      <TableHead>Tương tác cuối</TableHead>
                      <TableHead>Được giao cho</TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.slice(0, 10).map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium max-w-[120px] truncate">{customer.name || `Người dùng ${customer.phoneNumber}`}</TableCell>
                        <TableCell className="max-w-[110px] truncate">{customer.phoneNumber}</TableCell>
                        <TableCell className="whitespace-nowrap">{format(new Date(customer.lastInteractionAt), 'dd/MM/yyyy HH:mm', { locale: vi })}</TableCell>
                        <TableCell className="max-w-[110px] truncate">{customer.assignedStaffName || <span className="italic text-muted-foreground">Chưa giao</span>}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/staff/chat/${customer.id}`} className="flex items-center">
                              Mở Chat <ArrowRight className="ml-2 h-3 w-3" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
           {customers.length > 10 && (
             <div className="mt-4 text-center">
                <Button variant="link" asChild><Link href="/staff/chat">Xem tất cả trong hàng đợi</Link></Button>
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
