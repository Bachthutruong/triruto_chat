
// src/app/admin/chat/layout.tsx
'use client';
import { useState, useEffect, type ReactNode, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Search, Filter, Loader2, AlertTriangle, Tag, CircleDot } from 'lucide-react';
import Link from 'next/link';
import type { CustomerProfile, UserSession, CustomerInteractionStatus } from '@/lib/types';
import { getCustomersForStaffView, getAllCustomerTags } from '@/app/actions';
import { DynamicTimeDisplay } from '@/components/layout/DynamicTimeDisplay'; 
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';

const getInteractionStatusText = (status?: CustomerInteractionStatus) => {
  switch (status) {
    case 'unread': return 'Chưa đọc';
    case 'read': return 'Đã xem';
    case 'replied_by_staff': return 'NV đã trả lời';
    default: return '';
  }
};

const getInteractionStatusColor = (status?: CustomerInteractionStatus) => {
  switch (status) {
    case 'unread': return 'text-red-500';
    case 'read': return 'text-blue-500';
    case 'replied_by_staff': return 'text-green-500';
    default: return 'text-muted-foreground';
  }
};

export default function AdminChatLayout({ children }: { children: ReactNode }) {
  const [activeCustomers, setActiveCustomers] = useState<CustomerProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [adminSession, setAdminSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true); // For initial load
  const [error, setError] = useState<string | null>(null);

  const [allAvailableTags, setAllAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const params = useParams();
  const currentCustomerId = params.customerId as string | undefined;

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

    const fetchTags = async () => {
        try {
          const tags = await getAllCustomerTags();
          setAllAvailableTags(tags);
        } catch (err) {
          console.error("Không thể tải danh sách nhãn (Admin):", err);
        }
      };
    fetchTags();
  }, []);

  const fetchAndSetCustomers = useCallback(async (isInitialLoad = false) => {
    if (!adminSession) return;
    if (isInitialLoad) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const fetchedCustomers = await getCustomersForStaffView(undefined, 'admin', selectedTags.length > 0 ? selectedTags : undefined);
      setActiveCustomers(prev => {
        if (JSON.stringify(fetchedCustomers) !== JSON.stringify(prev)) {
          return fetchedCustomers;
        }
        return prev;
      });
    } catch (err) {
      console.error("Không thể tải danh sách khách hàng (Admin):", err);
      if (isInitialLoad) setError("Không thể tải danh sách khách hàng. Vui lòng thử lại.");
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, [adminSession, selectedTags]);

  useEffect(() => {
    // Initial fetch
    if (adminSession) {
      fetchAndSetCustomers(true);
    }
  }, [adminSession, selectedTags, fetchAndSetCustomers]);

  useEffect(() => {
    // Polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (adminSession) {
      pollingIntervalRef.current = setInterval(() => {
        fetchAndSetCustomers(false);
      }, 10000); // Poll every 10 seconds
    }
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [adminSession, fetchAndSetCustomers]);


  const filteredCustomersBySearch = activeCustomers.filter(customer =>
    (customer.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (customer.internalName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    customer.phoneNumber.includes(searchTerm) ||
    (customer.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

   const handleApplyTagFilter = () => {
    // fetchCustomers will be re-run by its own useEffect due to selectedTags change
    setIsTagPopoverOpen(false);
  };

  const handleClearTagFilter = () => {
    setSelectedTags([]);
    setIsTagPopoverOpen(false);
  };


   if (isLoading && !error && !adminSession) {
    return (
       <div className="flex h-[calc(100vh-var(--header-height,4rem)-2rem)] items-center justify-center">
           <Loader2 className="h-12 w-12 animate-spin text-primary" />
       </div>
    );
  }

  if (error && !adminSession) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-var(--header-height,4rem)-2rem)]">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-xl text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Thử lại</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-0"> 
      <Card className="w-full md:w-1/3 lg:w-1/4 h-full flex flex-col rounded-none border-r border-border"> 
        <CardHeader className="border-b border-border"> 
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
            <Popover open={isTagPopoverOpen} onOpenChange={setIsTagPopoverOpen}>
              <PopoverTrigger asChild>
                 <Button variant="outline" className="h-9 w-full justify-start text-left font-normal">
                  <Filter className="mr-2 h-4 w-4" />
                  {selectedTags.length > 0 ? `Đã chọn ${selectedTags.length} nhãn` : "Lọc theo Nhãn"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <div className="p-4">
                  <h4 className="mb-2 font-medium leading-none">Chọn Nhãn để lọc</h4>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {allAvailableTags.map((tag) => (
                        <div key={tag} className="flex items-center space-x-2">
                          <Checkbox
                            id={`admin-tag-filter-${tag}`}
                            checked={selectedTags.includes(tag)}
                            onCheckedChange={(checked) => {
                              setSelectedTags(prev =>
                                checked ? [...prev, tag] : prev.filter(t => t !== tag)
                              );
                            }}
                          />
                          <Label htmlFor={`admin-tag-filter-${tag}`} className="font-normal text-sm">
                            {tag}
                          </Label>
                        </div>
                      ))}
                      {allAvailableTags.length === 0 && <p className="text-sm text-muted-foreground">Không có nhãn nào.</p>}
                    </div>
                  </ScrollArea>
                </div>
                <DialogFooter className="p-2 border-t">
                  <Button variant="ghost" size="sm" onClick={handleClearTagFilter}>Xóa lọc</Button>
                  <Button size="sm" onClick={handleApplyTagFilter}>Áp dụng</Button>
                </DialogFooter>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <ScrollArea className="flex-grow">
          <CardContent className="p-0">
            {isLoading && <div className="p-4 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2"/>Đang tải danh sách...</div>}
            {!isLoading && error && <p className="p-4 text-destructive text-center">{error}</p>}
            {!isLoading && !error && filteredCustomersBySearch.length === 0 && <p className="p-4 text-muted-foreground text-center">Không tìm thấy khách hàng phù hợp.</p>}
            <ul className="divide-y divide-border">
              {filteredCustomersBySearch.map(customer => (
                 <li key={customer.id} className={cn(
                     customer.interactionStatus === 'unread' && 'bg-primary/5',
                     currentCustomerId === customer.id && 'bg-accent'
                    )}>
                  <Button variant="ghost" className="w-full justify-start h-auto p-3 rounded-none" asChild>
                    <Link href={`/admin/chat/${customer.id}`}>
                       <div className="flex flex-col items-start text-left w-full">
                        <div className="flex justify-between w-full items-center">
                           <span className={cn("font-semibold truncate max-w-[calc(100%-100px)]", customer.interactionStatus === 'unread' && 'font-bold')}>
                            {customer.interactionStatus === 'unread' && <CircleDot className="inline-block h-3 w-3 mr-1 text-red-500" />}
                            {customer.internalName || customer.name || customer.phoneNumber}
                           </span>
                           <span className={cn("text-xs ml-1 shrink-0", getInteractionStatusColor(customer.interactionStatus))}>
                             {getInteractionStatusText(customer.interactionStatus)}
                           </span>
                        </div>
                        { (customer.internalName && (customer.name || customer.phoneNumber !== customer.internalName)) &&
                            <span className="text-xs text-muted-foreground truncate max-w-full">({customer.name || customer.phoneNumber})</span>
                        }
                         {customer.lastMessagePreview && (
                           <p className="text-xs text-muted-foreground truncate max-w-full mt-0.5">
                                {customer.lastMessagePreview}
                           </p>
                        )}
                        <div className="flex justify-between w-full items-center mt-0.5">
                            <DynamicTimeDisplay 
                              timestamp={customer.lastMessageTimestamp || customer.lastInteractionAt} 
                              type={customer.lastMessageTimestamp ? "distance" : "format"}
                              className="text-xs text-muted-foreground"
                            />
                           {customer.assignedStaffId && <span className="text-xs text-blue-600">({customer.assignedStaffName || 'NV được giao'})</span>}
                           {!customer.assignedStaffId && <span className="text-xs text-amber-600">(Chưa giao)</span>}
                        </div>
                         {customer.tags && customer.tags.length > 0 &&
                            <div className="mt-1 flex flex-wrap gap-1">
                                {customer.tags.slice(0,3).map(tag => (
                                    <span key={tag} className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full">{tag}</span>
                                ))}
                                {customer.tags.length > 3 && <span className="text-xs text-muted-foreground">...</span>}
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
      <div className="flex-grow h-full">
        {children}
      </div>
    </div>
  );
}

