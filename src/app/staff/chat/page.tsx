// src/app/staff/chat/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, MessageSquarePlus, Search, Filter, Loader2, AlertTriangle, Tag } from 'lucide-react';
import Link from 'next/link';
import type { CustomerProfile, UserSession } from '@/lib/types';
import { getCustomersForStaffView, getAllCustomerTags } from '@/app/actions';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog'; // For Popover footer styling

export default function StaffChatPage() {
  const [activeCustomers, setActiveCustomers] = useState<CustomerProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [staffSession, setStaffSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [allAvailableTags, setAllAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);


  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      const session = JSON.parse(sessionString) as UserSession;
      setStaffSession(session);
    } else {
      setError("Không tìm thấy phiên làm việc. Vui lòng đăng nhập lại.");
      setIsLoading(false);
    }

    const fetchTags = async () => {
      try {
        const tags = await getAllCustomerTags();
        setAllAvailableTags(tags);
      } catch (err) {
        console.error("Không thể tải danh sách nhãn:", err);
        // Optionally show a toast or small error message for tags
      }
    };
    fetchTags();
  }, []);

  const fetchCustomers = async () => {
    if (!staffSession) return;
    setIsLoading(true);
    setError(null);
    try {
      // Use selectedTags directly as it's already string[]
      const customers = await getCustomersForStaffView(
        staffSession.id, 
        staffSession.role,
        selectedTags.length > 0 ? selectedTags : undefined
      );
      setActiveCustomers(customers);
    } catch (err) {
      console.error("Không thể tải danh sách khách hàng:", err);
      setError("Không thể tải danh sách khách hàng. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (staffSession) {
      fetchCustomers(); // Initial fetch and fetch when selectedTags change via "Apply"
    }
  }, [staffSession, selectedTags]); // Re-fetch when selectedTags change. Note: fetchCustomers itself is stable.

  const filteredCustomersBySearch = activeCustomers.filter(customer =>
    (customer.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (customer.internalName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    customer.phoneNumber.includes(searchTerm) ||
    (customer.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleApplyTagFilter = () => {
    fetchCustomers(); // This will use the current `selectedTags` state
    setIsTagPopoverOpen(false);
  };
  
  const handleClearTagFilter = () => {
    setSelectedTags([]);
    // fetchCustomers will be called by useEffect due to selectedTags change
    setIsTagPopoverOpen(false);
  };


  if (isLoading && !error && !staffSession) { // Show full loading if session is not yet loaded
    return (
       <div className="flex h-[calc(100vh-var(--header-height,4rem)-2rem)] items-center justify-center">
           <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" /> Hàng đợi Khách hàng</CardTitle>
          <CardDescription>Khách hàng đang chờ, được giao cho bạn, hoặc chưa được giao.</CardDescription>
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
             {isLoading && <div className="p-4 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2"/>Đang tải danh sách...</div>}
            {!isLoading && filteredCustomersBySearch.length === 0 && <p className="p-4 text-muted-foreground">Không tìm thấy khách hàng phù hợp.</p>}
            <ul className="divide-y divide-border">
              {filteredCustomersBySearch.map(customer => (
                <li key={customer.id}>
                  <Button variant="ghost" className="w-full justify-start h-auto p-3 rounded-none" asChild>
                    <Link href={staffSession?.role === 'admin' ? `/admin/chat/${customer.id}` : `/staff/chat/${customer.id}`}>
                      <div className="flex flex-col items-start text-left w-full">
                        <div className="flex justify-between w-full">
                           <span className="font-semibold truncate max-w-[calc(100%-50px)]">{customer.internalName || customer.name || customer.phoneNumber}</span>
                           {customer.assignedStaffId === staffSession?.id && <span className="text-xs text-green-600 ml-1">(Bạn)</span>}
                           {customer.assignedStaffId && customer.assignedStaffId !== staffSession?.id && <span className="text-xs text-blue-600 ml-1">({customer.assignedStaffName || 'NV khác'})</span>}
                           {!customer.assignedStaffId && <span className="text-xs text-amber-600 ml-1">(Chưa giao)</span>}
                        </div>
                        { (customer.internalName && (customer.name || customer.phoneNumber !== customer.internalName)) && 
                            <span className="text-xs text-muted-foreground truncate max-w-full">({customer.name || customer.phoneNumber})</span>
                        }
                        <span className="text-xs text-muted-foreground">
                          Tương tác cuối: {format(new Date(customer.lastInteractionAt), 'HH:mm dd/MM', { locale: vi })}
                        </span>
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

      <Card className="hidden md:flex flex-grow h-full  flex-col items-center justify-center bg-muted/30">
        <CardContent className="text-center">
          <MessageSquarePlus className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Chọn một cuộc trò chuyện</h2>
          <p className="text-muted-foreground">Chọn một khách hàng từ danh sách để bắt đầu hoặc tiếp tục cuộc trò chuyện.</p>
        </CardContent>
      </Card>
    </div>
  );
}

