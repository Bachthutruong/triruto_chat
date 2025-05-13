// src/app/admin/chat/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, MessageSquarePlus, Search, Filter, Loader2, AlertTriangle, Tag } from 'lucide-react';
import Link from 'next/link';
import type { CustomerProfile, UserSession } from '@/lib/types';
import { getCustomersForStaffView } from '@/app/actions';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function AdminLiveChatsPage() {
  const [activeCustomers, setActiveCustomers] = useState<CustomerProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [adminSession, setAdminSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      const session = JSON.parse(sessionString) as UserSession;
      if (session.role === 'admin') {
        setAdminSession(session);
      } else {
        setError("Truy cập bị từ chối. Yêu cầu quyền Admin.");
        setIsLoading(false);
      }
    } else {
      setError("Không tìm thấy phiên làm việc. Vui lòng đăng nhập lại.");
      setIsLoading(false);
    }
  }, []);

  const fetchCustomers = async () => {
    if (!adminSession) return;
    setIsLoading(true);
    setError(null);
    try {
      const tagsToFilter = filterTag.trim() ? filterTag.trim().split(',').map(t => t.trim()) : undefined;
      // Admin sees all customers, pass undefined for staffId, but pass role for clarity
      const customers = await getCustomersForStaffView(undefined, 'admin', tagsToFilter);
      setActiveCustomers(customers);
    } catch (err) {
      console.error("Không thể tải danh sách khách hàng (Admin):", err);
      setError("Không thể tải danh sách khách hàng. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (adminSession) {
      fetchCustomers();
    }
  }, [adminSession, filterTag]);

  const filteredCustomersBySearch = activeCustomers.filter(customer =>
    (customer.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (customer.internalName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    customer.phoneNumber.includes(searchTerm) ||
    (customer.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

   const handleFilterApply = () => {
    fetchCustomers();
  };

  if (isLoading && !error) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height,4rem)-2rem)]">
        <Card className="w-1/3 lg:w-1/4 h-full flex flex-col mr-4">
          <CardHeader>
            <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" /> Danh sách Khách hàng</CardTitle>
            <div className="pt-2"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          </CardHeader>
          <ScrollArea className="flex-grow"><CardContent><p className="p-4 text-muted-foreground">Đang tải...</p></CardContent></ScrollArea>
        </Card>
        <Card className="flex-grow h-full flex flex-col items-center justify-center">
           <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-var(--header-height,4rem)-2rem)]">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-xl text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Thử lại</Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-var(--header-height,4rem)-2rem)] gap-4">
      <Card className="w-full md:w-1/3 lg:w-1/4 h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" /> Danh sách Khách hàng</CardTitle>
          <CardDescription>Tất cả khách hàng trong hệ thống.</CardDescription>
           <div className="flex flex-col gap-2 pt-2">
            <Input 
              placeholder="Tìm theo tên, SĐT, nhãn..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
            <div className="flex gap-2">
              <Input 
                placeholder="Lọc theo nhãn (vd: VIP, Admin Attention)" 
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="h-9 flex-grow"
                icon={<Tag className="h-4 w-4 text-muted-foreground" />}
              />
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleFilterApply}>
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <ScrollArea className="flex-grow">
          <CardContent className="p-0">
            {filteredCustomersBySearch.length === 0 && <p className="p-4 text-muted-foreground">Không tìm thấy khách hàng phù hợp.</p>}
            <ul className="divide-y divide-border">
              {filteredCustomersBySearch.map(customer => (
                <li key={customer.id}>
                  <Button variant="ghost" className="w-full justify-start h-auto p-3 rounded-none" asChild>
                    <Link href={`/admin/chat/${customer.id}`}>
                       <div className="flex flex-col items-start text-left w-full">
                        <div className="flex justify-between w-full">
                           <span className="font-semibold truncate max-w-[calc(100%-50px)]">{customer.internalName || customer.name || customer.phoneNumber}</span>
                           {customer.assignedStaffId && <span className="text-xs text-blue-600 ml-1">({customer.assignedStaffName || 'NV được giao'})</span>}
                           {!customer.assignedStaffId && <span className="text-xs text-amber-600 ml-1">(Chưa giao)</span>}
                        </div>
                        { (customer.internalName && (customer.name || customer.phoneNumber !== customer.internalName)) && 
                            <span className="text-xs text-muted-foreground truncate max-w-full">({customer.name || customer.phoneNumber})</span>
                        }
                        <span className="text-xs text-muted-foreground">
                          Tương tác cuối: {format(new Date(customer.lastInteractionAt), 'HH:mm dd/MM', { locale: vi })}
                        </span>
                         {customer.tags && customer.tags.length > 0 && 
                            <div className="mt-1">
                                {customer.tags.slice(0,2).map(tag => (
                                    <span key={tag} className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full mr-1">{tag}</span>
                                ))}
                                {customer.tags.length > 2 && <span className="text-xs text-muted-foreground">...</span>}
                            </div>
                         }
                      </div>
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </ScrollArea>
      </Card>

      <Card className="hidden md:flex flex-grow h-full flex-col items-center justify-center bg-muted/30">
        <CardContent className="text-center">
          <MessageSquarePlus className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Chọn một cuộc trò chuyện</h2>
          <p className="text-muted-foreground">Chọn một khách hàng từ danh sách để xem và tương tác.</p>
        </CardContent>
      </Card>
    </div>
  );
}
