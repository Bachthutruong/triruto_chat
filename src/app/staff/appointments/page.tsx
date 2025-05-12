'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar'; 
import { PlusCircle, ListFilter, Edit, Trash2, Save, Users, Clock } from 'lucide-react';
import type { AppointmentDetails, UserSession } from '@/lib/types';
import { getAppointments, createNewAppointment, updateExistingAppointment, deleteExistingAppointment, getCustomerListForSelect, getAllUsers } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';

const formatDateToYYYYMMDD = (date: Date | undefined): string => {
  if (!date) return '';
  return format(date, 'yyyy-MM-dd');
};

const parseDateFromYYYYMMDD = (dateString: string): Date => {
  return parseISO(dateString);
};

const NO_STAFF_ASSIGNED_VALUE = "__NO_STAFF_ASSIGNED__";

export default function StaffAppointmentsPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<AppointmentDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [staffSession, setStaffSession] = useState<UserSession | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState<AppointmentDetails | null>(null);
  
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formService, setFormService] = useState('');
  const [formDate, setFormDate] = useState(formatDateToYYYYMMDD(new Date()));
  const [formTime, setFormTime] = useState('09:00');
  const [formBranch, setFormBranch] = useState('');
  const [formStatus, setFormStatus] = useState<AppointmentDetails['status']>('booked');
  const [formNotes, setFormNotes] = useState('');
  const [formStaffId, setFormStaffId] = useState(NO_STAFF_ASSIGNED_VALUE);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerList, setCustomerList] = useState<{ id: string; name: string; phoneNumber: string }[]>([]);
  const [staffList, setStaffList] = useState<UserSession[]>([]);


  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      const session = JSON.parse(sessionString);
      setStaffSession(session);
      setFormStaffId(session.id || NO_STAFF_ASSIGNED_VALUE); 
    }

    const fetchInitialData = async () => {
        try {
            const [customers, staffMembers] = await Promise.all([
                getCustomerListForSelect(),
                getAllUsers() 
            ]);
            setCustomerList(customers);
            setStaffList(staffMembers.filter(u => u.role === 'staff' || u.role === 'admin'));
        } catch (error) {
            toast({ title: "Lỗi tải dữ liệu", description: "Không thể tải danh sách khách hàng hoặc nhân viên.", variant: "destructive" });
        }
    };
    fetchInitialData();

  }, [toast]);
  
  const fetchAppointments = useCallback(async () => {
    if (!selectedDate || !staffSession) return;
    setIsLoading(true);
    try {
      const dateStr = formatDateToYYYYMMDD(selectedDate);
      const filters: any = { date: dateStr };
      // if (staffSession.role === 'staff') filters.staffId = staffSession.id; // Uncomment if staff only sees their own
      
      const data = await getAppointments(filters);
      setAppointments(data);
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể tải lịch hẹn.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, staffSession, toast]);

  useEffect(() => {
    if (staffSession) { 
        fetchAppointments();
    }
  }, [fetchAppointments, staffSession]);


  const resetForm = () => {
    setCurrentAppointment(null);
    setFormCustomerId('');
    setFormService('');
    setFormDate(formatDateToYYYYMMDD(selectedDate || new Date()));
    setFormTime('09:00');
    setFormBranch('');
    setFormStatus('booked');
    setFormNotes('');
    setFormStaffId(staffSession?.id || NO_STAFF_ASSIGNED_VALUE);
  };

  const handleOpenModal = (appointment: AppointmentDetails | null = null) => {
    if (appointment) {
      setCurrentAppointment(appointment);
      setFormCustomerId(appointment.userId);
      setFormService(appointment.service);
      setFormDate(appointment.date); 
      setFormTime(appointment.time.replace(/ AM| PM/i, '')); 
      setFormBranch(appointment.branch || '');
      setFormStatus(appointment.status);
      setFormNotes(appointment.notes || '');
      setFormStaffId(appointment.staffId || staffSession?.id || NO_STAFF_ASSIGNED_VALUE);
    } else {
      resetForm();
      setFormDate(formatDateToYYYYMMDD(selectedDate || new Date()));
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (!formCustomerId || !formService || !formDate || !formTime) {
        toast({ title: "Thiếu thông tin", description: "Vui lòng điền đầy đủ các trường bắt buộc (Khách hàng, Dịch vụ, Ngày, Giờ).", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }
    
    const appointmentData = {
      customerId: formCustomerId,
      service: formService,
      date: formDate,
      time: formTime, 
      branch: formBranch,
      status: formStatus,
      notes: formNotes,
      staffId: formStaffId === NO_STAFF_ASSIGNED_VALUE ? undefined : formStaffId,
    };

    try {
      if (currentAppointment) {
        await updateExistingAppointment(currentAppointment.appointmentId, appointmentData);
        toast({ title: "Thành công", description: "Đã cập nhật lịch hẹn." });
      } else {
        await createNewAppointment(appointmentData);
        toast({ title: "Thành công", description: "Đã tạo lịch hẹn mới." });
      }
      resetForm();
      setIsModalOpen(false);
      fetchAppointments();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Thao tác thất bại.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async (appointmentId: string) => {
    try {
      await deleteExistingAppointment(appointmentId);
      toast({ title: "Thành công", description: "Đã xóa lịch hẹn." });
      fetchAppointments();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa lịch hẹn.", variant: "destructive" });
    }
  };

  const getStatusLabel = (status: AppointmentDetails['status']) => {
    switch (status) {
      case 'booked': return 'Đã đặt';
      case 'completed': return 'Hoàn thành';
      case 'cancelled': return 'Đã hủy';
      case 'pending_confirmation': return 'Chờ xác nhận';
      case 'rescheduled': return 'Đã đổi lịch';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý Lịch hẹn</h1>
          <p className="text-muted-foreground">Xem, tạo và quản lý lịch hẹn của khách hàng.</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Tạo Lịch hẹn Mới
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Chọn Ngày</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lịch hẹn ngày {selectedDate ? selectedDate.toLocaleDateString('vi-VN') : 'N/A'}</CardTitle>
                <CardDescription>Danh sách các lịch hẹn đã đặt.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Đang tải lịch hẹn...</p>
            ) : appointments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Không có lịch hẹn nào cho ngày này.</p>
            ) : (
              <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
                {appointments.map(appt => (
                  <li key={appt.appointmentId} className="p-4 border rounded-lg bg-card shadow hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-grow">
                        <h3 className="font-semibold text-base">{appt.service} - {appt.time}</h3>
                        <p className="text-sm text-muted-foreground">
                          <Users className="inline-block mr-1 h-3 w-3"/>KH: {appt.customerName || appt.userId} {appt.customerPhoneNumber && `(${appt.customerPhoneNumber})`}
                        </p>
                        {appt.branch && <p className="text-sm text-muted-foreground">Chi nhánh: {appt.branch}</p>}
                         {appt.staffName && <p className="text-sm text-muted-foreground">NV: {appt.staffName}</p>}
                        <p className="text-sm mt-1">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            appt.status === 'booked' ? 'bg-blue-100 text-blue-700' : 
                            appt.status === 'completed' ? 'bg-green-100 text-green-700' : 
                            appt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                            'bg-gray-100 text-gray-700'}`}>
                            {getStatusLabel(appt.status)}
                          </span>
                        </p>
                        {appt.notes && <p className="text-xs mt-1 text-muted-foreground border-l-2 pl-2"><em>Ghi chú: {appt.notes}</em></p>}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 shrink-0 ml-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(appt)}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa lịch hẹn này?</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(appt.appointmentId)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentAppointment ? 'Sửa Lịch hẹn' : 'Tạo Lịch hẹn Mới'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
            <div>
              <Label htmlFor="formCustomerId">Khách hàng</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId} disabled={isSubmitting}>
                <SelectTrigger><SelectValue placeholder="Chọn khách hàng" /></SelectTrigger>
                <SelectContent>
                  {customerList.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phoneNumber})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="formService">Dịch vụ</Label><Input id="formService" value={formService} onChange={e => setFormService(e.target.value)} placeholder="ví dụ: Cắt tóc" disabled={isSubmitting}/></div>
            <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="formDate">Ngày</Label><Input id="formDate" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} disabled={isSubmitting}/></div>
                <div><Label htmlFor="formTime">Giờ</Label><Input id="formTime" type="time" value={formTime} onChange={e => setFormTime(e.target.value)} disabled={isSubmitting}/></div>
            </div>
            <div><Label htmlFor="formBranch">Chi nhánh</Label><Input id="formBranch" value={formBranch} onChange={e => setFormBranch(e.target.value)} placeholder="ví dụ: Chi nhánh Chính" disabled={isSubmitting}/></div>
            <div>
                <Label htmlFor="formStaffIdModalStaff">Nhân viên phụ trách (tùy chọn)</Label>
                <Select value={formStaffId} onValueChange={setFormStaffId} disabled={isSubmitting}>
                    <SelectTrigger id="formStaffIdModalStaff"><SelectValue placeholder="Chọn nhân viên" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NO_STAFF_ASSIGNED_VALUE}>Không chọn</SelectItem>
                        {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.phoneNumber})</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
              <Label htmlFor="formStatus">Trạng thái</Label>
              <Select value={formStatus} onValueChange={val => setFormStatus(val as AppointmentDetails['status'])} disabled={isSubmitting}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="booked">Đã đặt</SelectItem>
                  <SelectItem value="pending_confirmation">Chờ xác nhận</SelectItem>
                  <SelectItem value="completed">Hoàn thành</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
                  <SelectItem value="rescheduled">Đã đổi lịch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="formNotes">Ghi chú</Label><Input id="formNotes" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Ghi chú thêm (nếu có)" disabled={isSubmitting}/></div>
            <DialogFooter className="sticky bottom-0 bg-background py-4 border-t -mx-1 px-1">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Hủy</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}><Save className="mr-2 h-4 w-4" />{isSubmitting ? 'Đang lưu...' : 'Lưu Lịch hẹn'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    