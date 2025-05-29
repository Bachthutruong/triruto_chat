// src/app/admin/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Users, MessageSquare, Settings, ListChecks, CalendarPlus, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { AdminDashboardStats, AppointmentDetails, CustomerProfile } from '@/lib/types';
import { getAdminDashboardStats } from '@/app/actions';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function AdminDashboardPage() {
  const appSettings = useAppSettingsContext();
  const brandName = appSettings?.brandName || 'Live Chat';
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAdminDashboardStats();
        setStats(data);
      } catch (err) {
        console.error("Failed to load admin dashboard stats:", err);
        setError("Không thể tải dữ liệu bảng điều khiển. Vui lòng thử lại.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Đang tải dữ liệu bảng điều khiển...</p>
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
    return <p className="text-center text-muted-foreground">Không có dữ liệu để hiển thị.</p>;
  }


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Bảng điều khiển Admin</h1>
      <p className="text-muted-foreground">Tổng quan về ứng dụng {brandName} của bạn.</p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Người dùng hoạt động (7 ngày)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUserCount}</div>
            <p className="text-xs text-muted-foreground">Tổng số khách tương tác gần đây</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tin nhắn hôm nay</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.chatsTodayCount}</div>
            <p className="text-xs text-muted-foreground">Tổng số tin nhắn đã gửi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vấn đề cần hỗ trợ</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openIssuesCount}</div>
            <p className="text-xs text-muted-foreground">Khách được gắn thẻ "Cần hỗ trợ"</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trạng thái hệ thống</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.systemStatus === 'Optimal' ? 'text-green-600' : 'text-destructive'}`}>
              {stats.systemStatus === 'Optimal' ? 'Tối ưu' : 'Có vấn đề'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.systemStatus === 'Optimal' ? 'Tất cả hệ thống đang chạy' : 'Kiểm tra nhật ký hệ thống'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lịch hẹn gần đây</CardTitle>
            <CardDescription>5 lịch hẹn được tạo hoặc cập nhật gần nhất.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentAppointments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dịch vụ</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Giờ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentAppointments.map((appt) => (
                    <TableRow key={appt.appointmentId}>
                      <TableCell>{appt.service}</TableCell>
                      <TableCell>{appt.customerName || `Người dùng ${appt.userId}`}</TableCell>
                      <TableCell>{format(new Date(appt.date), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                      <TableCell>{appt.time}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">Không có lịch hẹn gần đây.</p>
            )}
            <div className="mt-4 text-right">
              <Button asChild variant="link"><Link href="/admin/appointments/view">Xem tất cả lịch hẹn</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Khách hàng mới gần đây</CardTitle>
            <CardDescription>5 khách hàng mới nhất được tạo.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentCustomers.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>SĐT</TableHead><TableHead>Ngày tạo</TableHead></TableRow></TableHeader>
                <TableBody>
                  {stats.recentCustomers.map((cust) => (
                    <TableRow key={cust.id}>
                      <TableCell>{cust.name || `Người dùng ${cust.phoneNumber}`}</TableCell>
                      <TableCell>{cust.phoneNumber}</TableCell>
                      <TableCell>{format(new Date(cust.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">Không có khách hàng mới.</p>
            )}
            {/* Placeholder for a link to full customer list if/when available in admin */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
