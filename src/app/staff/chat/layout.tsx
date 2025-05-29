// src/app/staff/chat/layout.tsx
'use client';
import { useState, useEffect, type ReactNode, useCallback, useRef } from 'react'; // Added useRef
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Search, Filter, Loader2, AlertTriangle, Tag, CircleDot, Menu, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { CustomerProfile, UserSession, CustomerInteractionStatus } from '@/lib/types';
import { getCustomersForStaffView, getAllCustomerTags } from '@/app/actions';
import { DynamicTimeDisplay } from '@/components/layout/DynamicTimeDisplay';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';

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

export default function StaffChatLayout({ children }: { children: ReactNode }) {
  const [activeCustomers, setActiveCustomers] = useState<CustomerProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [staffSession, setStaffSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true); // For initial load
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [allAvailableTags, setAllAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const params = useParams();
  const router = useRouter();
  const currentCustomerId = params.customerId as string | undefined;

  // Polling interval ref
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [currentCustomerId]);

  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      const session = JSON.parse(sessionString) as UserSession;
      setStaffSession(session);
    } else {
      setError("Không tìm thấy phiên làm việc. Vui lòng đăng nhập lại.");
      setIsLoading(false); // Stop loading if no session
    }

    const fetchTags = async () => {
      try {
        const tags = await getAllCustomerTags();
        setAllAvailableTags(tags);
      } catch (err) {
        console.error("Không thể tải danh sách nhãn:", err);
      }
    };
    fetchTags();
  }, []);

  const fetchAndSetCustomers = useCallback(async (isInitialLoad = false) => {
    if (!staffSession) return;
    if (isInitialLoad) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const fetchedCustomers = await getCustomersForStaffView(
        staffSession.id,
        staffSession.role,
        selectedTags.length > 0 ? selectedTags : undefined
      );
      setActiveCustomers(prev => {
        if (JSON.stringify(fetchedCustomers) !== JSON.stringify(prev)) {
          return fetchedCustomers;
        }
        return prev;
      });
    } catch (err) {
      console.error("Không thể tải danh sách khách hàng:", err);
      if (isInitialLoad) setError("Không thể tải danh sách khách hàng. Vui lòng thử lại.");
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, [staffSession, selectedTags]);

  useEffect(() => {
    // Initial fetch
    if (staffSession) {
      fetchAndSetCustomers(true);
    }
  }, [staffSession, selectedTags, fetchAndSetCustomers]);

  useEffect(() => {
    // Polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (staffSession) {
      pollingIntervalRef.current = setInterval(() => {
        fetchAndSetCustomers(false); // Subsequent fetches are not "initial"
      }, 10000); // Poll every 10 seconds
    }
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [staffSession, fetchAndSetCustomers]);


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

  const handleBackToList = () => {
    router.push('/staff/chat');
  };

  if (isLoading && !error && !staffSession) { // Initial loading state
    return (
      <div className="flex h-[calc(100vh-var(--header-height,4rem)-2rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !staffSession) { // Critical error if session can't be established
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-var(--header-height,4rem)-2rem)] p-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-xl text-destructive text-center">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Thử lại</Button>
      </div>
    );
  }

  const sidebarContent = (
    <Card className="h-full flex flex-col rounded-none border-r border-border">
      <CardHeader className="border-b border-border p-3 sm:p-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-sm sm:text-base">
            <Users className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Hàng đợi Khách hàng</span>
            <span className="sm:hidden">Khách hàng</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Khách hàng đang chờ, được giao cho bạn, hoặc chưa được giao.
        </CardDescription>
        <div className="flex flex-col gap-2 pt-2">
          <Input
            placeholder="Tìm theo tên, SĐT, nhãn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 sm:h-9 text-sm"
            icon={<Search className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />}
          />
          <Popover open={isTagPopoverOpen} onOpenChange={setIsTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-8 sm:h-9 w-full justify-start text-left font-normal text-xs sm:text-sm">
                <Filter className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                {selectedTags.length > 0 ? `Đã chọn ${selectedTags.length} nhãn` : "Lọc theo Nhãn"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <div className="p-4">
                <h4 className="mb-2 font-medium leading-none text-sm">Chọn Nhãn để lọc</h4>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {allAvailableTags.map((tag) => (
                      <div key={tag} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tag-filter-${tag}`}
                          checked={selectedTags.includes(tag)}
                          onCheckedChange={(checked) => {
                            setSelectedTags(prev =>
                              checked ? [...prev, tag] : prev.filter(t => t !== tag)
                            );
                          }}
                        />
                        <Label htmlFor={`tag-filter-${tag}`} className="font-normal text-sm">
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
          {isLoading && <div className="p-4 text-center text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Đang tải danh sách...</div>}
          {!isLoading && error && <p className="p-4 text-destructive text-center text-sm">{error}</p>}
          {!isLoading && !error && filteredCustomersBySearch.length === 0 && <p className="p-4 text-muted-foreground text-center text-sm">Không tìm thấy khách hàng phù hợp.</p>}
          <ul className="divide-y divide-border">
            {filteredCustomersBySearch.map(customer => (
              <li key={customer.id} className={cn(
                customer.interactionStatus === 'unread' && 'bg-primary/5',
                currentCustomerId === customer.id && 'bg-accent'
              )}>
                <Button variant="ghost" className="w-full justify-start h-auto p-2 sm:p-3 rounded-none" asChild>
                  <Link href={staffSession?.role === 'admin' ? `/admin/chat/${customer.id}` : `/staff/chat/${customer.id}`}>
                    <div className="flex flex-col items-start text-left w-full">
                      <div className="flex justify-between w-full items-center">
                        <span className={cn("font-semibold truncate max-w-[calc(100%-80px)] sm:max-w-[calc(100%-100px)] text-sm", customer.interactionStatus === 'unread' && 'font-bold')}>
                          {customer.interactionStatus === 'unread' && <CircleDot className="inline-block h-2 w-2 sm:h-3 sm:w-3 mr-1 text-red-500" />}
                          {customer.internalName || customer.name || customer.phoneNumber}
                        </span>
                        <span className={cn("text-xs ml-1 shrink-0", getInteractionStatusColor(customer.interactionStatus))}>
                          {getInteractionStatusText(customer.interactionStatus)}
                        </span>
                      </div>
                      {(customer.internalName && (customer.name || customer.phoneNumber !== customer.internalName)) &&
                        <span className="text-xs text-muted-foreground truncate max-w-full">({customer.name || customer.phoneNumber})</span>
                      }
                      {customer.lastMessagePreview && (
                        <p className="text-xs text-muted-foreground truncate max-w-[100px] mt-0.5">
                          {customer.lastMessagePreview}
                        </p>
                      )}
                      <div className="flex justify-between w-full items-center mt-0.5">
                        <DynamicTimeDisplay
                          timestamp={customer.lastMessageTimestamp || customer.lastInteractionAt}
                          type={customer.lastMessageTimestamp ? "distance" : "format"}
                          className="text-xs text-muted-foreground"
                        />
                        {customer.assignedStaffId === staffSession?.id && <span className="text-xs text-green-600 hidden sm:inline">(Bạn)</span>}
                        {customer.assignedStaffId && customer.assignedStaffId !== staffSession?.id && <span className="text-xs text-blue-600 hidden sm:inline">({customer.assignedStaffName || 'NV khác'})</span>}
                        {!customer.assignedStaffId && <span className="text-xs text-amber-600 hidden sm:inline">(Chưa giao)</span>}
                      </div>
                      {customer.tags && customer.tags.length > 0 &&
                        <div className="mt-1 flex flex-wrap gap-1">
                          {customer.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full">{tag}</span>
                          ))}
                          {customer.tags.length > 2 && <span className="text-xs text-muted-foreground">+{customer.tags.length - 2}</span>}
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
  );

  return (
    <div className="flex h-full relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-1/3 lg:w-1/4",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent}
      </div>

      {/* Main Content */}
      <div className="flex-1 h-full overflow-hidden flex flex-col">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-3 border-b border-border bg-background">
          <div className="flex items-center gap-2">
            {currentCustomerId ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToList}
                className="p-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(true)}
                className="p-1"
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <h1 className="font-semibold text-sm">
              {currentCustomerId ? 'Chat' : 'Hàng đợi khách hàng'}
            </h1>
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

