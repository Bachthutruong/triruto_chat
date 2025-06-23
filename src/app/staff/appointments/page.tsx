'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { PlusCircle, ListFilter, Edit, Trash2, Save, Users, Clock } from 'lucide-react';
import type { AppointmentDetails, UserSession, GetAppointmentsFilters, ProductItem, Branch, AppSettings } from '@/lib/types';
import { getAppointments, createNewAppointment, updateExistingAppointment, deleteExistingAppointment, getCustomerListForSelect, getAllUsers, getAllProducts, getBranches, getAppSettings } from '@/app/actions';
import { filterTimeSlotsForBreakTime } from '@/lib/utils/timeSlots';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO, addMinutes, startOfHour, setHours, setMinutes } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

const generateTimeSlots = (workingHours?: string[], serviceDuration?: number, defaultDuration = 60): string[] => {
  const slots: string[] = [];
  const effectiveDuration = serviceDuration || defaultDuration;

  if (workingHours && workingHours.length > 0) {
    return workingHours;
  }

  let date = startOfHour(new Date());
  date = setHours(date, 8);
  date = setMinutes(date, 0);
  const endDate = setHours(new Date(), 21);

  while (date < endDate) {
    slots.push(format(date, 'HH:mm'));
    date = addMinutes(date, 30);
  }
  return slots;
};

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
  const [formProductId, setFormProductId] = useState('');
  const [formDate, setFormDate] = useState(formatDateToYYYYMMDD(new Date()));
  const [formTime, setFormTime] = useState('09:00');
  const [formBranchId, setFormBranchId] = useState('');
  const [formStatus, setFormStatus] = useState<AppointmentDetails['status']>('booked');
  const [formNotes, setFormNotes] = useState('');
  const [formStaffId, setFormStaffId] = useState(NO_STAFF_ASSIGNED_VALUE);
  const [formRecurrenceType, setFormRecurrenceType] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [formRecurrenceCount, setFormRecurrenceCount] = useState<number>(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerList, setCustomerList] = useState<{ id: string; name: string; phoneNumber: string }[]>([]);
  const [staffList, setStaffList] = useState<UserSession[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const appSettingsFromContext = useAppSettingsContext();
  const [currentAppSettings, setCurrentAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      const session = JSON.parse(sessionString);
      setStaffSession(session);
      setFormStaffId(session.id || NO_STAFF_ASSIGNED_VALUE);
    }

    const fetchInitialData = async () => {
      try {
        const [customers, staffMembers, fetchedProducts, fetchedBranches, settings] = await Promise.all([
          getCustomerListForSelect(),
          getAllUsers(),
          getAllProducts(),
          getBranches(true),
          getAppSettings()
        ]);
        setCustomerList(customers);
        setStaffList(staffMembers.filter(u => u.role === 'staff' || u.role === 'admin'));
        setProducts(fetchedProducts.filter(p => p.isSchedulable));
        setBranches(fetchedBranches);
        setCurrentAppSettings(settings);

        if (fetchedBranches.length === 1 && !formBranchId) {
          setFormBranchId(fetchedBranches[0].id);
        }
      } catch (error) {
        toast({ title: "Lỗi tải dữ liệu", description: "Không thể tải danh sách khách hàng, nhân viên, dịch vụ hoặc chi nhánh.", variant: "destructive" });
      }
    };
    fetchInitialData();
  }, [toast, formBranchId]);

  // Add effect to update time slots when product changes
  useEffect(() => {
    const appSettingsToUse = appSettingsFromContext || currentAppSettings;
    const selectedProduct = products.find(p => p.id === formProductId);

    let serviceSpecificWorkingHours = selectedProduct?.schedulingRules?.workingHours;
    if (selectedProduct?.isSchedulable && selectedProduct.schedulingRules && (!serviceSpecificWorkingHours || serviceSpecificWorkingHours.length === 0)) {
      serviceSpecificWorkingHours = appSettingsToUse?.workingHours;
    }

    let serviceSpecificDuration = selectedProduct?.schedulingRules?.serviceDurationMinutes;
    if (selectedProduct?.isSchedulable && selectedProduct.schedulingRules && !serviceSpecificDuration) {
      serviceSpecificDuration = appSettingsToUse?.defaultServiceDurationMinutes;
    }

    const slots = generateTimeSlots(
      serviceSpecificWorkingHours?.length ? serviceSpecificWorkingHours : appSettingsToUse?.workingHours,
      serviceSpecificDuration,
      appSettingsToUse?.defaultServiceDurationMinutes
    );
    
    // Filter out break times
    const filteredSlots = filterTimeSlotsForBreakTime(slots, appSettingsToUse?.breakTimes || []);
    setTimeSlots(filteredSlots);
    if (filteredSlots.length > 0 && !filteredSlots.includes(formTime)) {
      setFormTime(filteredSlots[0]);
    } else if (filteredSlots.length === 0 && formTime) {
      setFormTime('');
    }
  }, [formProductId, products, appSettingsFromContext, currentAppSettings, formTime]);

  const fetchAppointments = useCallback(async () => {
    if (!staffSession) return;
    setIsLoading(true);
    try {
      const filters: GetAppointmentsFilters = {};
      if (selectedDate) {
        const localDateStr = formatDateToYYYYMMDD(selectedDate);
        const now = new Date();
        const isViewingToday = selectedDate.getFullYear() === now.getFullYear() &&
          selectedDate.getMonth() === now.getMonth() &&
          selectedDate.getDate() === now.getDate();

        if (isViewingToday) {
          const utcDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
          const utcDateStr = formatDateToYYYYMMDD(utcDate);
          if (localDateStr !== utcDateStr) {
            filters.dates = [localDateStr, utcDateStr];
            console.log(`[StaffAppointments] Querying for today (local & UTC): ${localDateStr}, ${utcDateStr}`);
          } else {
            filters.date = localDateStr;
            console.log(`[StaffAppointments] Querying for today (local=UTC): ${localDateStr}`);
          }
        } else {
          filters.date = localDateStr;
          console.log(`[StaffAppointments] Querying for specific date: ${localDateStr}`);
        }
      } else {
        console.log(`[StaffAppointments] No date selected, fetching all applicable for staff.`);
      }
      // Staff might only see their own appointments or unassigned ones by default
      // For now, let's assume they see all for a given date, or based on admin page for all.
      // If staff should only see their own:
      // if (staffSession.role === 'staff') filters.staffId = staffSession.id; 

      const data = await getAppointments(filters);
      setAppointments(data);
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể tải lịch hẹn.", variant: "destructive" });
      console.error("Error fetching appointments for staff:", error);
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
    setFormProductId('');
    setFormDate(formatDateToYYYYMMDD(selectedDate || new Date()));
    setFormTime('09:00');
    setFormBranchId(branches.length === 1 ? branches[0].id : '');
    setFormStatus('booked');
    setFormNotes('');
    setFormStaffId(staffSession?.id || NO_STAFF_ASSIGNED_VALUE);
    setFormRecurrenceType('none');
    setFormRecurrenceCount(1);
  };

  const handleOpenModal = (appointment: AppointmentDetails | null = null) => {
    if (appointment) {
      setCurrentAppointment(appointment);
      setFormCustomerId(appointment.userId);
      setFormProductId(appointment.productId || '');
      setFormDate(appointment.date);
      setFormTime(appointment.time.replace(/ AM| PM/i, ''));
      setFormBranchId(appointment.branchId || '');
      setFormStatus(appointment.status);
      setFormNotes(appointment.notes || '');
      setFormStaffId(appointment.staffId || staffSession?.id || NO_STAFF_ASSIGNED_VALUE);
    } else {
      resetForm();
      setFormDate(formatDateToYYYYMMDD(selectedDate || new Date()));
      // Set default branch if there's only one branch
      if (branches.length === 1) {
        setFormBranchId(branches[0].id);
      }
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const selectedProduct = products.find(p => p.id === formProductId);
    const selectedBranch = branches.find(b => b.id === formBranchId);

    let branchIsRequiredAndMissing = false;
    if (branches.length > 1 && !formBranchId) {
      branchIsRequiredAndMissing = true;
    }

    if (!formCustomerId || !formProductId || !formDate || !formTime || branchIsRequiredAndMissing) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng điền đầy đủ các trường bắt buộc: Khách hàng, Dịch vụ, Ngày, Giờ và Chi nhánh (nếu có nhiều hơn 1).",
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    const appointmentData = {
      customerId: formCustomerId,
      service: selectedProduct!.name,
      productId: selectedProduct!.id,
      date: formDate,
      time: formTime,
      branch: selectedBranch?.name,
      branchId: selectedBranch?.id || (branches.length === 1 ? branches[0].id : undefined),
      status: formStatus,
      notes: formNotes.trim() || undefined,
      staffId: formStaffId === NO_STAFF_ASSIGNED_VALUE ? undefined : formStaffId,
      recurrenceType: formRecurrenceType === 'none' ? undefined : formRecurrenceType,
      recurrenceCount: formRecurrenceType !== 'none' && formRecurrenceCount > 1 ? formRecurrenceCount : undefined,
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
            <CardDescription>(Để trống để xem tất cả ngày)</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              locale={vi}
            />
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => { setSelectedDate(undefined); }} className="w-full">
              Xem Tất cả Ngày
            </Button>
          </CardFooter>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lịch hẹn {selectedDate ? `ngày ${format(selectedDate, 'dd/MM/yyyy', { locale: vi })}` : '(Tất cả ngày)'}</CardTitle>
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
                        <h3 className="font-semibold text-base">{appt.internalName || appt.customerName || appt.customerPhoneNumber || `Khách hàng ${appt.userId}`} - {appt.time}</h3>
                        <p className="text-sm text-muted-foreground">Dịch vụ: {appt.service}</p>
                        <p className="text-sm text-muted-foreground">
                          <Users className="inline-block mr-1 h-3 w-3" />
                          {appt.internalName ? (
                            <>
                              {appt.internalName}
                              {(appt.customerName || appt.customerPhoneNumber) && <span className="ml-1">({appt.customerName || appt.customerPhoneNumber})</span>}
                            </>
                          ) : (
                            appt.customerName || appt.customerPhoneNumber || `Khách hàng ${appt.userId}`
                          )}
                        </p>
                        {appt.branch && <p className="text-sm text-muted-foreground">Chi nhánh: {appt.branch}</p>}
                        {appt.staffName && <p className="text-sm text-muted-foreground">NV: {appt.staffName}</p>}
                        <p className="text-sm mt-1">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${appt.status === 'booked' ? 'bg-blue-100 text-blue-700' :
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
            <div>
              <Label htmlFor="formProductId">Dịch vụ</Label>
              <Select
                value={formProductId}
                onValueChange={(value) => {
                  setFormProductId(value);
                  // Reset time based on new service's potential working hours
                  const product = products.find(p => p.id === value);
                  const appSettingsToUse = appSettingsFromContext || currentAppSettings;
                  let serviceSpecificWorkingHours = product?.schedulingRules?.workingHours;
                  if (product?.isSchedulable && product.schedulingRules && (!serviceSpecificWorkingHours || serviceSpecificWorkingHours.length === 0)) {
                    serviceSpecificWorkingHours = appSettingsToUse?.workingHours;
                  }
                  const slots = generateTimeSlots(
                    serviceSpecificWorkingHours?.length ? serviceSpecificWorkingHours : appSettingsToUse?.workingHours,
                    product?.schedulingRules?.serviceDurationMinutes,
                    appSettingsToUse?.defaultServiceDurationMinutes
                  );
                  const filteredSlots = filterTimeSlotsForBreakTime(slots, appSettingsToUse?.breakTimes || []);
                  if (filteredSlots.length > 0) setFormTime(filteredSlots[0]); else setFormTime('');
                }}
                disabled={isSubmitting || products.length === 0}
              >
                <SelectTrigger id="formProductId">
                  <SelectValue placeholder={products.length === 0 ? "Không có dịch vụ có thể đặt lịch" : "Chọn dịch vụ"} />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.category})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="formDate">Ngày</Label>
                <Input
                  id="formDate"
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  disabled={isSubmitting}
                  min={formatDateToYYYYMMDD(new Date())}
                />
              </div>
              <div>
                <Label htmlFor="formTime">Giờ</Label>
                <Select
                  value={formTime}
                  onValueChange={setFormTime}
                  disabled={isSubmitting || timeSlots.length === 0}
                >
                  <SelectTrigger id="formTime">
                    <SelectValue placeholder={timeSlots.length === 0 ? "Chọn dịch vụ để xem giờ" : "Chọn giờ"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {timeSlots.length === 0 && <SelectItem value="" disabled>Không có khung giờ</SelectItem>}
                    {timeSlots.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {branches.length > 0 && (
              <div>
                <Label htmlFor="formBranchId">Chi nhánh {branches.length === 1 ? '' : <span className="text-destructive">*</span>}</Label>
                <Select
                  value={formBranchId}
                  onValueChange={setFormBranchId}
                  disabled={isSubmitting || branches.length === 0}
                  required={branches.length > 1}
                >
                  <SelectTrigger id="formBranchId">
                    <SelectValue placeholder={branches.length === 1 && branches[0] ? branches[0].name : "Chọn chi nhánh"} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            <div><Label htmlFor="formNotes">Ghi chú</Label><Input id="formNotes" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Ghi chú thêm (nếu có)" disabled={isSubmitting} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="formRecurrenceType">Lặp lại</Label>
                <Select value={formRecurrenceType} onValueChange={(value) => setFormRecurrenceType(value as any)} disabled={isSubmitting}>
                  <SelectTrigger id="formRecurrenceType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không lặp lại</SelectItem>
                    <SelectItem value="daily">Hàng ngày</SelectItem>
                    <SelectItem value="weekly">Hàng tuần</SelectItem>
                    <SelectItem value="monthly">Hàng tháng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formRecurrenceType !== 'none' && (
                <div>
                  <Label htmlFor="formRecurrenceCount">Số lần lặp lại</Label>
                  <Input
                    id="formRecurrenceCount"
                    type="number"
                    value={formRecurrenceCount}
                    onChange={e => setFormRecurrenceCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    min="1"
                    max="52"
                    disabled={isSubmitting}
                    className="w-full"
                  />
                </div>
              )}
            </div>
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


