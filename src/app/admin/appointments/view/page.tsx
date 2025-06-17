// src/app/admin/appointments/view/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { PlusCircle, ListFilter, Edit, Trash2, Save, Users, Clock, Search } from 'lucide-react';
import type { AppointmentDetails, UserSession, GetAppointmentsFilters, ProductItem, Branch, AppSettings } from '@/lib/types';
import { getAppointments, createNewAppointment, updateExistingAppointment, deleteExistingAppointment, getCustomerListForSelect, getAllUsers, getAllProducts, getBranches, getAppSettings, handleCustomerAccess } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO, addMinutes, startOfHour, setHours, setMinutes } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { validatePhoneNumber } from '@/lib/validator';

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

const ALL_STAFF_FILTER_VALUE = "__ALL_STAFF_FILTER__";
const NO_STAFF_ASSIGNED_VALUE = "__NO_STAFF_ASSIGNED__";

export default function AdminViewAppointmentsPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<AppointmentDetails[]>([]);
  console.log('appointments', appointments)
  const [isLoading, setIsLoading] = useState(false);
  const [adminSession, setAdminSession] = useState<UserSession | null>(null);
  console.log('appointments', appointments)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState<AppointmentDetails | null>(null);

  const [formCustomerId, setFormCustomerId] = useState('');
  const [formPhoneNumber, setFormPhoneNumber] = useState('');
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

  const [filterCustomerSearch, setFilterCustomerSearch] = useState('');
  const [filterStaffId, setFilterStaffId] = useState(ALL_STAFF_FILTER_VALUE);

  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      const session = JSON.parse(sessionString);
      setAdminSession(session);
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
    setTimeSlots(slots);
    if (slots.length > 0 && !slots.includes(formTime)) {
      setFormTime(slots[0]);
    } else if (slots.length === 0 && formTime) {
      setFormTime('');
    }
  }, [formProductId, products, appSettingsFromContext, currentAppSettings, formTime]);

  const fetchAppointments = useCallback(async () => {
    if (!adminSession) return;
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
            console.log(`[AdminViewAppointments] Querying for today (local & UTC): ${localDateStr}, ${utcDateStr}`);
          } else {
            filters.date = localDateStr;
            console.log(`[AdminViewAppointments] Querying for today (local=UTC): ${localDateStr}`);
          }
        } else {
          filters.date = localDateStr;
          console.log(`[AdminViewAppointments] Querying for specific date: ${localDateStr}`);
        }
      } else {
        console.log(`[AdminViewAppointments] No date selected, fetching all applicable.`);
      }

      if (filterStaffId && filterStaffId !== ALL_STAFF_FILTER_VALUE) {
        filters.staffId = filterStaffId;
      }

      const data = await getAppointments(filters);
      let filteredData = data;
      if (filterCustomerSearch) {
        const searchTerm = filterCustomerSearch.toLowerCase();
        filteredData = data.filter(appt =>
          (appt.customerName?.toLowerCase().includes(searchTerm)) ||
          (appt.customerPhoneNumber?.includes(searchTerm))
        );
      }
      setAppointments(filteredData);
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể tải lịch hẹn.", variant: "destructive" });
      console.error("Error fetching appointments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, adminSession, toast, filterCustomerSearch, filterStaffId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const resetForm = () => {
    setCurrentAppointment(null);
    setFormCustomerId('');
    setFormPhoneNumber('');
    setFormProductId('');
    setFormDate(formatDateToYYYYMMDD(selectedDate || new Date()));
    setFormTime('09:00');
    setFormBranchId('');
    setFormStatus('booked');
    setFormNotes('');
    setFormStaffId(adminSession?.id || NO_STAFF_ASSIGNED_VALUE);
    setFormRecurrenceType('none');
    setFormRecurrenceCount(1);
  };

  const handleOpenModal = (appointment: AppointmentDetails | null = null) => {
    if (appointment) {
      setCurrentAppointment(appointment);
      setFormCustomerId(appointment.userId);
      setFormPhoneNumber(appointment.customerPhoneNumber || '');

      setFormProductId(appointment.productId ?? '');

      setFormDate(appointment.date);
      setFormTime(appointment.time.replace(/ AM| PM/i, ''));

      const existingBranch = branches.find(b => b.id === appointment.branchId);
      setFormBranchId(existingBranch ? (appointment.branchId ?? '') : '');

      setFormStatus(appointment.status);
      setFormNotes(appointment.notes || '');

      setFormStaffId(typeof appointment.staffId === 'string' && appointment.staffId ? appointment.staffId : (adminSession?.id || NO_STAFF_ASSIGNED_VALUE));

      console.log("DEBUG: formStaffId set in handleOpenModal:", appointment.staffId || adminSession?.id || NO_STAFF_ASSIGNED_VALUE);
    } else {
      resetForm();
      setFormDate(formatDateToYYYYMMDD(selectedDate || new Date()));
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

    if (!formPhoneNumber.trim() || !formProductId || !formDate || !formTime || branchIsRequiredAndMissing) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng điền đầy đủ các trường bắt buộc: Số điện thoại khách hàng, Dịch vụ, Ngày, Giờ và Chi nhánh (nếu có nhiều hơn 1).",
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    if (!selectedProduct) {
      toast({
        title: "Lỗi dữ liệu",
        description: "Không tìm thấy thông tin dịch vụ đã chọn. Vui lòng chọn lại dịch vụ.",
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    if (branches.length > 1 && !selectedBranch) {
       toast({
        title: "Lỗi dữ liệu",
        description: "Không tìm thấy thông tin chi nhánh đã chọn. Vui lòng chọn lại chi nhánh.",
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    if (!validatePhoneNumber(formPhoneNumber)) {
      toast({
        title: "Số điện thoại không hợp lệ",
        description: "Vui lòng nhập số điện thoại hợp lệ.",
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    try {
      setIsCreatingCustomer(true);
      const result = await handleCustomerAccess(formPhoneNumber.trim());

      if (!result.userSession) {
        throw new Error("Không thể tạo phiên cho khách hàng.");
      }

      const finalBranchId = selectedBranch?.id;
      const finalBranchName = selectedBranch?.name;

      console.log("DEBUG (handleSubmit): formStaffId value:", formStaffId);
      let finalStaffId = undefined;

      if (typeof formStaffId === 'string' && formStaffId !== NO_STAFF_ASSIGNED_VALUE) {
         finalStaffId = formStaffId;
      } else if (formStaffId !== NO_STAFF_ASSIGNED_VALUE) {
         console.error("DEBUG (handleSubmit): formStaffId is not a string or is the default value, actual value:", formStaffId);
      }

      const appointmentData = {
        customerId: result.userSession.id,
        service: selectedProduct.name,
        productId: selectedProduct.id,
        date: formDate,
        time: formTime,
        branch: finalBranchName,
        branchId: finalBranchId,
        status: formStatus,
        notes: formNotes.trim() || undefined,
        staffId: finalStaffId,
        recurrenceType: formRecurrenceType === 'none' ? undefined : formRecurrenceType,
        recurrenceCount: formRecurrenceType !== 'none' && formRecurrenceCount > 1 ? formRecurrenceCount : undefined,
      };

      if (currentAppointment) {
        await updateExistingAppointment(currentAppointment.appointmentId, appointmentData);
        toast({ title: "Thành công", description: "Đã cập nhật lịch hẹn." });
      } else {
        await createNewAppointment(appointmentData);
        toast({
          title: "Thành công",
          description: `Đã tạo lịch hẹn mới cho khách hàng ${result.userSession.name || formPhoneNumber}.`
        });
      }
      resetForm();
      setIsModalOpen(false);
      fetchAppointments();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        title: "Lỗi",
        description: error.message || "Thao tác thất bại.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      setIsCreatingCustomer(false);
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

  const handleApplyFilters = () => {
    fetchAppointments();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Xem Lịch hẹn (Admin)</h1>
          <p className="text-muted-foreground">Xem và quản lý tất cả lịch hẹn trong hệ thống.</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Tạo Lịch hẹn Mới
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="filterCustomerSearch">Tìm Khách hàng (Tên/SĐT)</Label>
            <Input
              id="filterCustomerSearch"
              placeholder="Nhập tên hoặc SĐT"
              value={filterCustomerSearch}
              onChange={e => setFilterCustomerSearch(e.target.value)}
              icon={<Search />}
            />
          </div>
          <div>
            <Label htmlFor="filterStaffId">Nhân viên</Label>
            <Select value={filterStaffId} onValueChange={setFilterStaffId}>
              <SelectTrigger><SelectValue placeholder="Tất cả nhân viên" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STAFF_FILTER_VALUE}>Tất cả nhân viên</SelectItem>
                {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.phoneNumber})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleApplyFilters} className="w-full md:w-auto">
              <ListFilter className="mr-2 h-4 w-4" /> Áp dụng lọc
            </Button>
          </div>
        </CardContent>
      </Card>

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
              <Label htmlFor="formPhoneNumber">Số điện thoại khách hàng <span className="text-destructive">*</span></Label>
              <Input
                id="formPhoneNumber"
                type="tel"
                value={formPhoneNumber}
                onChange={e => setFormPhoneNumber(e.target.value)}
                placeholder="Nhập số điện thoại khách hàng"
                disabled={isSubmitting || isCreatingCustomer}
                className="w-full"
                required
              />
              {isCreatingCustomer && <p className="text-sm text-muted-foreground mt-1">Đang tạo phiên cho khách hàng...</p>}
            </div>
            <div>
              <Label htmlFor="formProductId">Dịch vụ</Label>
              <Select
                value={formProductId}
                onValueChange={(value) => {
                  setFormProductId(value);
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
                  if (slots.length > 0) setFormTime(slots[0]); else setFormTime('');
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
              <Select value={formStaffId} onValueChange={(value) => {
                setFormStaffId(value);
                console.log("DEBUG: formStaffId set with value:", value);
              }} disabled={isSubmitting}>
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


