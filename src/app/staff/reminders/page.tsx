'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Edit, Trash2, CheckCircle, Clock, AlertCircle, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isToday, formatDistanceToNow, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  getAllReminders, 
  createReminder, 
  updateReminder, 
  deleteReminder,
  getCustomerListForSelect
} from '@/app/actions';
import type { Reminder, ReminderStatus, ReminderPriority, UserSession } from '@/lib/types';

type CustomerOption = {
  id: string;
  name: string;
  phoneNumber: string;
};

export default function StaffRemindersPage() {
  const [reminderMode, setReminderMode] = useState<'all' | 'upcoming' | 'overdue'>('all');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<Reminder[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  // Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentReminder, setCurrentReminder] = useState<Reminder | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formCustomerId, setFormCustomerId] = useState(''); // Renamed to avoid conflict
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<ReminderPriority>('medium');
  const [status, setStatus] = useState<ReminderStatus>('pending');
  
  // Load session data
  const [currentUserSession, setCurrentUserSession] = useState<UserSession | null>(null);
  
  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      try {
        const session = JSON.parse(sessionString);
        setCurrentUserSession(session);
      } catch (error) {
        console.error('Error parsing session:', error);
      }
    }
  }, []);
  
  useEffect(() => {
    if (!currentUserSession) return;
    
    const fetchReminders = async () => {
      try {
        setIsLoading(true);
        let data: Reminder[] = [];
        
        const filters: Parameters<typeof getAllReminders>[0] = {};
        if (currentUserSession.role !== 'admin') {
            filters.staffId = currentUserSession.id;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfNextWeek = new Date(today);
        endOfNextWeek.setDate(today.getDate() + 7);
        endOfNextWeek.setHours(23, 59, 59, 999);

        switch (reminderMode) {
          case 'upcoming':
            filters.status = 'pending';
            filters.dueAfter = today;
            filters.dueBefore = endOfNextWeek;
            data = await getAllReminders(filters);
            break;
          case 'overdue':
            filters.status = 'pending';
            filters.dueBefore = today; 
            data = await getAllReminders(filters);
            break;
          default: // 'all'
            data = await getAllReminders(filters);
            break;
        }
        
        setReminders(data);
        setFilteredReminders(data);
      } catch (error) {
        console.error('Error fetching reminders:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải danh sách nhắc nhở.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchReminders();
  }, [currentUserSession, reminderMode, toast]);
  
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const data = await getCustomerListForSelect();
        setCustomers(data);
      } catch (error) {
        console.error('Error fetching customers:', error);
      }
    };
    
    fetchCustomers();
  }, []);
  
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredReminders(reminders);
      return;
    }
    
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = reminders.filter(
      (reminder) =>
        reminder.title.toLowerCase().includes(lowerQuery) ||
        reminder.description.toLowerCase().includes(lowerQuery) ||
        (reminder.customerName && reminder.customerName.toLowerCase().includes(lowerQuery))
    );
    
    setFilteredReminders(filtered);
  }, [reminders, searchQuery]);
  
  const resetForm = () => {
    setCurrentReminder(null);
    setTitle('');
    setDescription('');
    setFormCustomerId('');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    setDueDate(tomorrow);
    setPriority('medium');
    setStatus('pending');
  };
  
  const handleOpenModal = (reminder: Reminder | null = null) => {
    resetForm();
    if (reminder) {
      setCurrentReminder(reminder);
      setTitle(reminder.title);
      setDescription(reminder.description);
      setFormCustomerId(reminder.customerId);
      setDueDate(format(new Date(reminder.dueDate), 'yyyy-MM-dd'));
      setPriority(reminder.priority);
      setStatus(reminder.status);
    } else {
      // Set tomorrow as default due date for new reminders
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      setDueDate(tomorrow);
    }
    setIsModalOpen(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserSession) {
      toast({
        title: 'Lỗi',
        description: 'Không tìm thấy phiên đăng nhập, vui lòng đăng nhập lại.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const reminderData = {
        title,
        description,
        customerId: formCustomerId,
        staffId: currentUserSession.id, // Creator is current staff/admin
        dueDate: new Date(dueDate),
        priority,
        status,
      };
      
      if (currentReminder) {
        // Update existing reminder
        const updatedReminder = await updateReminder(currentReminder.id, reminderData);
        if (updatedReminder) {
          setReminders((prevReminders) =>
            prevReminders.map((r) => (r.id === updatedReminder.id ? updatedReminder : r))
          );
          toast({ title: 'Thành công', description: 'Nhắc nhở đã được cập nhật.' });
        }
      } else {
        // Create new reminder
        const newReminder = await createReminder(reminderData);
        setReminders((prevReminders) => [newReminder, ...prevReminders]);
        toast({ title: 'Thành công', description: 'Nhắc nhở mới đã được tạo.' });
      }
      
      resetForm();
      setIsModalOpen(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu nhắc nhở.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteReminder = async (reminderId: string) => {
    try {
      const result = await deleteReminder(reminderId);
      if (result.success) {
        setReminders((prevReminders) => prevReminders.filter((r) => r.id !== reminderId));
        toast({ title: 'Thành công', description: 'Nhắc nhở đã được xóa.' });
      }
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa nhắc nhở.',
        variant: 'destructive',
      });
    }
  };
  
  const handleMarkAsComplete = async (reminderId: string) => {
    try {
      const updatedReminder = await updateReminder(reminderId, {
        status: 'completed',
        completedAt: new Date(),
      });
      
      if (updatedReminder) {
        setReminders((prevReminders) =>
          prevReminders.map((r) => (r.id === updatedReminder.id ? updatedReminder : r))
        );
        toast({ title: 'Thành công', description: 'Nhắc nhở đã được đánh dấu hoàn thành.' });
      }
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật trạng thái nhắc nhở.',
        variant: 'destructive',
      });
    }
  };
  
  const formatReminderDate = (date: Date) => {
    return format(new Date(date), 'dd/MM/yyyy');
  };
  
  const formatRelativeDate = (date: Date) => {
    const now = new Date();
    try {
      if (isToday(new Date(date))) {
        return 'Hôm nay';
      } else if (isPast(new Date(date))) {
        return `Quá hạn ${formatDistanceToNow(new Date(date), { addSuffix: true, locale: vi })}`;
      } else {
        return formatDistanceToNow(new Date(date), { addSuffix: true, locale: vi });
      }
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  const getReminderStatusBadge = (status: ReminderStatus, dueDate: Date) => {
    if (status === 'completed') {
      return <Badge variant="outline" className="bg-green-100 text-green-800">Hoàn thành</Badge>;
    } else if (status === 'cancelled') {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800">Đã hủy</Badge>;
    } else if (isPast(new Date(dueDate)) && !isToday(new Date(dueDate))) {
      return <Badge variant="destructive">Quá hạn</Badge>;
    } else if (isToday(new Date(dueDate))) {
      return <Badge variant="default" className="bg-yellow-500">Hôm nay</Badge>;
    } else {
      return <Badge variant="outline" className="bg-blue-100 text-blue-800">Đang chờ</Badge>;
    }
  };
  
  const getPriorityBadge = (priority: ReminderPriority) => {
    switch (priority) {
      case 'high':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Cao</Badge>;
      case 'medium':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Trung bình</Badge>;
      case 'low':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Thấp</Badge>;
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Nhắc nhở Chăm sóc Khách hàng</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Quản lý các nhắc nhở theo dõi và chăm sóc khách hàng.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => handleOpenModal()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Thêm Nhắc nhở Mới
        </Button>
      </div>
      
      <Tabs defaultValue="all" onValueChange={(value) => setReminderMode(value as any)}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="upcoming">Sắp đến</TabsTrigger>
          <TabsTrigger value="overdue">Quá hạn</TabsTrigger>
        </TabsList>
        
        <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tiêu đề, mô tả, khách hàng..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Tất cả Nhắc nhở</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Xem tất cả nhắc nhở chăm sóc khách hàng của bạn.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderRemindersTable()}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="upcoming" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Nhắc nhở Sắp Đến</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Những nhắc nhở cần được xử lý trong 7 ngày tới.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderRemindersTable()}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="overdue" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Nhắc nhở Quá Hạn</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Những nhắc nhở đã quá hạn và cần được xử lý ngay.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderRemindersTable()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{currentReminder ? 'Chỉnh sửa Nhắc nhở' : 'Thêm Nhắc nhở Mới'}</DialogTitle>
            <DialogDescription>
              {currentReminder
                ? 'Cập nhật thông tin chi tiết cho nhắc nhở.'
                : 'Điền thông tin để tạo nhắc nhở mới.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Tiêu đề <span className="text-red-500">*</span></Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="formCustomerId">Khách hàng <span className="text-red-500">*</span></Label>
                <Select value={formCustomerId} onValueChange={setFormCustomerId} disabled={currentReminder !== null || isSubmitting}>
                  <SelectTrigger id="formCustomerId">
                    <SelectValue placeholder="Chọn khách hàng" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} ({customer.phoneNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Mô tả <span className="text-red-500">*</span></Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  required
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Ngày hẹn <span className="text-red-500">*</span></Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="priority">Mức độ ưu tiên</Label>
                  <Select value={priority} onValueChange={(value) => setPriority(value as ReminderPriority)} disabled={isSubmitting}>
                    <SelectTrigger id="priority">
                      <SelectValue placeholder="Chọn mức độ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Thấp</SelectItem>
                      <SelectItem value="medium">Trung bình</SelectItem>
                      <SelectItem value="high">Cao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Trạng thái</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as ReminderStatus)} disabled={isSubmitting}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Chọn trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Chờ xử lý</SelectItem>
                      <SelectItem value="completed">Hoàn thành</SelectItem>
                      <SelectItem value="cancelled">Đã hủy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Hủy
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? currentReminder
                    ? 'Đang cập nhật...'
                    : 'Đang tạo...'
                  : currentReminder
                  ? 'Lưu thay đổi'
                  : 'Tạo Nhắc nhở'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
  
  function renderRemindersTable() {
    if (isLoading) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    
    if (filteredReminders.length === 0) {
      return (
        <div className="text-center py-6">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Không tìm thấy nhắc nhở nào.</p>
        </div>
      );
    }
    
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tiêu đề</TableHead>
              <TableHead className="hidden md:table-cell">Khách hàng</TableHead>
              { currentUserSession?.role === 'admin' && <TableHead className="hidden lg:table-cell">NV Phụ trách</TableHead>}
              <TableHead>Ngày hẹn</TableHead>
              <TableHead className="hidden md:table-cell">Mức độ</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReminders.map((reminder) => (
              <TableRow key={reminder.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{reminder.title}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {reminder.description}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {reminder.customerName || `Người dùng ${reminder.customerId.slice(-4)}`}
                </TableCell>
                { currentUserSession?.role === 'admin' && 
                  <TableCell className="hidden lg:table-cell">{reminder.staffName || 'N/A'}</TableCell>
                }
                <TableCell>
                  <div className="flex flex-col">
                    <span>{formatReminderDate(reminder.dueDate)}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(reminder.dueDate)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {getPriorityBadge(reminder.priority)}
                </TableCell>
                <TableCell>
                  {getReminderStatusBadge(reminder.status, reminder.dueDate)}
                </TableCell>
                <TableCell className="text-right">
                  {reminder.status !== 'completed' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-green-600 hover:text-green-700 mr-1"
                      onClick={() => handleMarkAsComplete(reminder.id)}
                      title="Đánh dấu hoàn thành"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mr-1"
                    onClick={() => handleOpenModal(reminder)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Hành động này không thể hoàn tác. Nhắc nhở "{reminder.title}" sẽ bị xóa vĩnh viễn.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteReminder(reminder.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Xóa
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
} 
