// src/app/admin/chat/page.tsx
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Filter, Loader2, Users, MessageSquarePlus, CircleDot } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { getCustomersForStaffView, getAllCustomerTags } from '@/app/actions';
import type { CustomerInteractionStatus, CustomerProfile, UserSession } from '@/lib/types';
import { DynamicTimeDisplay } from '@/components/layout/DynamicTimeDisplay';
import { DialogFooter } from '@/components/ui/dialog';

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
// This page now renders the placeholder content when no specific customer is selected.
// The actual customer list and chat details are handled by the layout and [customerId] page.
export default function AdminChatListPage() {
  const [activeCustomers, setActiveCustomers] = useState<CustomerProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [allAvailableTags, setAllAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [staffSession, setStaffSession] = useState<UserSession | null>(null);
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
    if (isInitialLoad) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const fetchedCustomers = await getCustomersForStaffView(undefined, 'admin', selectedTags.length > 0 ? selectedTags : undefined);
      setActiveCustomers(fetchedCustomers);
    } catch (err) {
      console.error("Không thể tải danh sách khách hàng:", err);
      setError("Không thể tải danh sách khách hàng. Vui lòng thử lại.");
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, [selectedTags]);
  const handleApplyTagFilter = () => {
    // fetchCustomers will be re-run by its own useEffect due to selectedTags change
    setIsTagPopoverOpen(false);
  };

  const handleClearTagFilter = () => {
    setSelectedTags([]);
    setIsTagPopoverOpen(false);
  };
  const filteredCustomersBySearch = activeCustomers.filter(customer =>
    (customer.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (customer.internalName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    customer.phoneNumber.includes(searchTerm) ||
    (customer.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const tags = await getAllCustomerTags();
        setAllAvailableTags(tags);
      } catch (err) {
        console.error("Không thể tải danh sách nhãn:", err);
      }
    };
    fetchTags();
    fetchAndSetCustomers(true);
  }, [fetchAndSetCustomers]);

  const filteredCustomers = activeCustomers.filter(customer =>
    (customer.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    customer.phoneNumber.includes(searchTerm) ||
    (customer.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      {/* Mobile View - Danh sách khách hàng */}
      <Card style={{ width: '400px' }} className="h-full w-full flex flex-col rounded-none border-border md:hidden">
        <CardHeader className="border-b border-border md:rounded-t-lg">
          <CardTitle className="flex items-center text-lg">
            <Users className="mr-2 h-5 w-5" />
            Danh sách Khách hàng
          </CardTitle>
          <CardDescription className="text-sm">
            Tìm kiếm và quản lý tất cả khách hàng
          </CardDescription>
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
                <li key={customer.id}>
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
                          <p className="text-xs text-muted-foreground truncate max-w-[300px] mt-0.5">
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

      {/* Desktop View - Placeholder */}
      <Card className="hidden md:flex h-full flex-col items-center justify-center bg-muted/30">
        <CardContent className="text-center">
          <MessageSquarePlus className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Chọn một cuộc trò chuyện</h2>
          <p className="text-muted-foreground">Chọn một khách hàng từ danh sách để xem và tương tác.</p>
        </CardContent>
      </Card>
    </>
  );
}