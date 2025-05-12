'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Phone, User, Tag, AlertCircle, BellRing, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getCustomersWithProductsAndReminders } from '@/app/actions';

export default function StaffCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setIsLoading(true);
        const data = await getCustomersWithProductsAndReminders();
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
  }, [toast]);

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
    router.push(`/staff/chat/${customerId}`);
  };

  const formatDate = (date: Date) => {
    try {
      return format(new Date(date), 'dd/MM/yyyy HH:mm');
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Quản lý Khách hàng</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Xem và quản lý danh sách khách hàng.</p>
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
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.internalName || customer.name || 'Chưa có tên'}
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