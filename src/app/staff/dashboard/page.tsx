'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, Users, CalendarCheck, ArrowRight } from 'lucide-react';
import type { CustomerProfile } from '@/lib/types';
import { getCustomersForStaffView } from '@/app/actions';
import Link from 'next/link';

export default function StaffDashboardPage() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        const fetchedCustomers = await getCustomersForStaffView();
        setCustomers(fetchedCustomers);
      } catch (error) {
        console.error("Không thể tải danh sách khách hàng:", error);
        // Thêm thông báo toast
      } finally {
        setIsLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Bảng điều khiển Nhân viên</h1>
      <p className="text-muted-foreground">Quản lý tương tác khách hàng và lịch hẹn.</p>

       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chat đang hoạt động</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div> {/* Placeholder */}
            <p className="text-xs text-muted-foreground">2 đang chờ phản hồi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lịch hẹn hôm nay</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div> {/* Placeholder */}
            <p className="text-xs text-muted-foreground">3 sắp tới</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Khách hàng được giao</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div> {/* Placeholder */}
            <p className="text-xs text-muted-foreground">Tổng số khách hàng</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hàng đợi Khách hàng / Tương tác Gần đây</CardTitle>
          <CardDescription>Khách hàng cần chú ý hoặc đã tương tác gần đây.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Đang tải khách hàng...</p>
          ) : customers.length === 0 ? (
            <p>Không có khách hàng nào để hiển thị.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Điện thoại</TableHead>
                  <TableHead>Tương tác cuối</TableHead>
                  <TableHead>Nhãn</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.slice(0, 5).map((customer) => ( // Hiển thị 5 khách hàng đầu cho dashboard
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name || 'Chưa có'}</TableCell>
                    <TableCell>{customer.phoneNumber}</TableCell>
                    <TableCell>{new Date(customer.lastInteractionAt).toLocaleString('vi-VN')}</TableCell>
                    <TableCell>{customer.tags?.join(', ') || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/staff/chat/${customer.id}`}>
                          Mở Chat <ArrowRight className="ml-2 h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
           {customers.length > 5 && (
             <div className="mt-4 text-center">
                <Button variant="link" asChild><Link href="/staff/customers">Xem tất cả Khách hàng</Link></Button>
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}

