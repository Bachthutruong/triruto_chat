'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Phone, User, Tag, AlertCircle, BellRing, CalendarDays, CalendarX } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getCustomersWithProductsAndReminders, updateCustomerAppointmentStatus } from '@/app/actions';
import type { UserSession } from '@/lib/types';

export default function StaffCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingCustomers, setUpdatingCustomers] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const router = useRouter();
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null);

  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      setCurrentSession(JSON.parse(sessionString));
    }
  }, []);

  useEffect(() => {
    if (!currentSession) return;

    const fetchCustomers = async () => {
      try {
        setIsLoading(true);
        // If admin, fetch all customers by passing undefined for staffId.
        // Otherwise, fetch customers assigned to the staff.
        const data = await getCustomersWithProductsAndReminders(currentSession.role === 'admin' ? undefined : currentSession.id);
        setCustomers(data);
        setFilteredCustomers(data);
      } catch (error) {
        console.error('Error fetching customers:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải danh sách khách hàng.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [toast, currentSession]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCustomers(customers);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = customers.filter(
      (customer) =>
        customer.name?.toLowerCase().includes(lowerQuery) ||
        customer.phoneNumber.includes(lowerQuery) ||
        customer.internalName?.toLowerCase().includes(lowerQuery) ||
        customer.tags?.some((tag: string) => tag.toLowerCase().includes(lowerQuery))
    );

    setFilteredCustomers(filtered);
  }, [customers, searchQuery]);

  const handleViewCustomer = (customerId: string) => {
    if (currentSession?.role === 'admin') {
      router.push(`/admin/chat/${customerId}`);
    } else {
      router.push(`/staff/chat/${customerId}`);
    }
  };

  const handleToggleAppointmentAccess = async (customerId: string, currentStatus: boolean) => {
    if (currentSession?.role !== 'admin') {
      toast({
        title: 'Không có quyền',
        description: 'Chỉ admin mới có thể thay đổi cài đặt này.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUpdatingCustomers(prev => new Set(prev).add(customerId));
      
      const newStatus = !currentStatus;
      await updateCustomerAppointmentStatus(customerId, newStatus);
      
      // Cập nhật state local
      setCustomers(prev => prev.map(customer => 
        customer.id === customerId 
          ? { ...customer, isAppointmentDisabled: newStatus }
          : customer
      ));
      
      toast({
        title: 'Thành công',
        description: newStatus 
          ? 'Đã tắt tính năng đặt lịch hẹn cho khách hàng này.'
          : 'Đã bật tính năng đặt lịch hẹn cho khách hàng này.',
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Error updating appointment status:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật cài đặt đặt lịch hẹn.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingCustomers(prev => {
        const newSet = new Set(prev);
        newSet.delete(customerId);
        return newSet;
      });
    }
  };

  const formatDate = (date: Date) => {
    try {
      return format(new Date(date), 'dd/MM/yyyy HH:mm');
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-6 md:w-[1500px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Quản lý Khách hàng</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Xem và quản lý danh sách khách hàng.
            {currentSession?.role === 'admin' && (
              <span className="block mt-1">Admin có thể bật/tắt tính năng đặt lịch hẹn cho từng khách hàng.</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm theo tên, số điện thoại, tag..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">Tất cả Khách hàng</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Danh sách tất cả khách hàng trong hệ thống.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-6">
              <User className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Không tìm thấy khách hàng nào.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Tên Khách hàng</TableHead>
                    <TableHead>Số điện thoại</TableHead>
                    <TableHead className="hidden md:table-cell">Lần tương tác cuối</TableHead>
                    <TableHead className="hidden md:table-cell">Tags</TableHead>
                    <TableHead className="text-center">Nhắc nhở</TableHead>
                    {currentSession?.role === 'admin' && (
                      <TableHead className="text-center">Đặt lịch hẹn</TableHead>
                    )}
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.internalName || customer.name || `Người dùng ${customer.phoneNumber}`}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {customer.phoneNumber}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatDate(customer.lastInteractionAt)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {customer.tags && customer.tags.length > 0 ? (
                            customer.tags.map((tag: string, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-xs">Không có tag</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {customer.pendingRemindersCount > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            {customer.pendingRemindersCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">0</span>
                        )}
                      </TableCell>
                      {currentSession?.role === 'admin' && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={!customer.isAppointmentDisabled}
                              onCheckedChange={() => handleToggleAppointmentAccess(customer.id, !!customer.isAppointmentDisabled)}
                              disabled={updatingCustomers.has(customer.id)}
                              className="data-[state=checked]:bg-green-600"
                            />
                                                         {customer.isAppointmentDisabled ? (
                               <div title="Đặt lịch hẹn bị tắt">
                                 <CalendarX className="h-4 w-4 text-red-500" />
                               </div>
                             ) : (
                               <div title="Đặt lịch hẹn được phép">
                                 <CalendarDays className="h-4 w-4 text-green-600" />
                               </div>
                             )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleViewCustomer(customer.id)}>
                          Xem
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 
