// src/components/chat/AppointmentBookingForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { AppointmentBookingFormData, UserSession, ProductItem, Branch, AppSettings } from '@/lib/types';
import { format, addMinutes, startOfHour, setHours, setMinutes, addDays, addWeeks, addMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { getCustomerListForSelect, getAllProducts, getBranches, getAppSettings } from '@/app/actions';
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

interface AppointmentBookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: AppointmentBookingFormData) => Promise<void>;
  currentUserSession: UserSession | null;
  currentChatCustomerId?: string;
}


export function AppointmentBookingForm({
  isOpen,
  onClose,
  onSubmit,
  currentUserSession,
  currentChatCustomerId
}: AppointmentBookingFormProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('09:00');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [recurrenceCount, setRecurrenceCount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const appSettingsFromContext = useAppSettingsContext();

  const [customerList, setCustomerList] = useState<{ id: string, name: string, phoneNumber: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(
    currentChatCustomerId || (currentUserSession?.role === 'customer' ? currentUserSession.id : undefined)
  );
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [currentAppSettings, setCurrentAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const appSettingsToUse = appSettingsFromContext || currentAppSettings;
    const selectedProduct = products.find(p => p.id === selectedProductId);

    let serviceSpecificWorkingHours = selectedProduct?.schedulingRules?.workingHours;
    if (selectedProduct?.isSchedulable && selectedProduct.schedulingRules && (!serviceSpecificWorkingHours || serviceSpecificWorkingHours.length === 0)) {
      // If product is schedulable but has no specific working hours, use global ones.
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
    if (slots.length > 0 && !slots.includes(time)) {
      setTime(slots[0]);
    } else if (slots.length === 0 && time) {
      setTime('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, products, appSettingsFromContext, currentAppSettings, time]);


  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const settings = appSettingsFromContext || await getAppSettings();
          setCurrentAppSettings(settings);

          const [fetchedProducts, fetchedBranches, fetchedCustomers] = await Promise.all([
            getAllProducts(),
            getBranches(true),
            (currentUserSession?.role === 'admin' || currentUserSession?.role === 'staff') ? getCustomerListForSelect() : Promise.resolve([]),
          ]);

          setProducts(fetchedProducts.filter(p => p.isSchedulable));
          setBranches(fetchedBranches);
          setCustomerList(fetchedCustomers);

          if (currentChatCustomerId) {
            setSelectedCustomerId(currentChatCustomerId);
          } else if (currentUserSession?.role === 'customer' && !selectedCustomerId) {
            setSelectedCustomerId(currentUserSession.id);
          }

          if (fetchedBranches.length === 1 && !selectedBranchId) {
            setSelectedBranchId(fetchedBranches[0].id);
          }

        } catch (error) {
          toast({ title: "Lỗi tải dữ liệu", description: "Không thể tải danh sách dịch vụ, chi nhánh hoặc khách hàng.", variant: "destructive" });
        }
      };
      fetchData();
    } else {
      // Reset form fields when dialog closes
      setSelectedProductId('');
      setTime('09:00');
      setSelectedBranchId(branches.length === 1 ? branches[0].id : '');
      setNotes('');
      setRecurrenceType('none');
      setRecurrenceCount(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUserSession, currentChatCustomerId, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProduct = products.find(p => p.id === selectedProductId);
    const selectedBranch = branches.find(b => b.id === selectedBranchId);

    let branchIsRequiredAndMissing = false;
    if (branches.length > 1 && !selectedBranchId) {
      branchIsRequiredAndMissing = true;
    }

    if (!selectedProductId || !selectedDate || !time || !selectedCustomerId || branchIsRequiredAndMissing) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng điền đầy đủ các trường bắt buộc: Dịch vụ, Khách hàng, Ngày, Giờ và Chi nhánh (nếu có nhiều hơn 1).', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const formData: AppointmentBookingFormData = {
      service: selectedProduct!.name,
      productId: selectedProduct!.id,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time,
      branch: selectedBranch?.name,
      branchId: selectedBranchId || (branches.length === 1 ? branches[0].id : undefined),
      notes: notes.trim() || undefined,
      customerId: selectedCustomerId!,
      recurrenceType: recurrenceType === 'none' ? undefined : recurrenceType,
      recurrenceCount: recurrenceType !== 'none' && recurrenceCount > 1 ? recurrenceCount : undefined,
    };
    await onSubmit(formData);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Đặt lịch hẹn trực tiếp</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto p-1">
          <div className="space-y-2">
            <Label htmlFor="service" className="text-sm font-medium">Dịch vụ <span className="text-destructive">*</span></Label>
            <Select
              value={selectedProductId}
              onValueChange={(value) => {
                setSelectedProductId(value);
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
                if (slots.length > 0) setTime(slots[0]); else setTime('');
              }}
              disabled={isSubmitting || products.length === 0}
            >
              <SelectTrigger id="service" className="w-full">
                <SelectValue placeholder={products.length === 0 ? "Không có dịch vụ có thể đặt lịch" : "Chọn dịch vụ"} />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.category})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-medium">Ngày <span className="text-destructive">*</span></Label>
              <div className="border rounded-md p-0 flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="mx-auto"
                  disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1)) || isSubmitting}
                  locale={vi}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time" className="text-sm font-medium">Giờ <span className="text-destructive">*</span></Label>
              <Select value={time} onValueChange={setTime} disabled={isSubmitting || timeSlots.length === 0}>
                <SelectTrigger id="time" className="w-full">
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
            <div className="space-y-2">
              <Label htmlFor="branch" className="text-sm font-medium">Chi nhánh {branches.length === 1 ? '' : <span className="text-destructive">*</span>}</Label>
              <Select
                value={selectedBranchId}
                onValueChange={setSelectedBranchId}
                disabled={isSubmitting || branches.length === 0}
                required={branches.length > 1}
              >
                <SelectTrigger id="branch" className="w-full">
                  <SelectValue placeholder={branches.length === 1 && branches[0] ? branches[0].name : "Chọn chi nhánh"} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {(currentUserSession?.role === 'admin' || currentUserSession?.role === 'staff') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="recurrenceType" className="text-sm font-medium">Lặp lại</Label>
                <Select value={recurrenceType} onValueChange={(value) => setRecurrenceType(value as any)} disabled={isSubmitting}>
                  <SelectTrigger id="recurrenceType" className="w-full">
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
              {recurrenceType !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="recurrenceCount" className="text-sm font-medium">Số lần lặp lại</Label>
                  <Input
                    id="recurrenceCount"
                    type="number"
                    value={recurrenceCount}
                    onChange={e => setRecurrenceCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    min="1"
                    max="52" // Example max
                    disabled={isSubmitting}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}


          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">Ghi chú (Tùy chọn)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={isSubmitting}
              className="min-h-[100px]"
              placeholder="Nhập ghi chú thêm nếu cần..."
            />
          </div>

          <DialogFooter className="sticky bottom-0 bg-background py-4 border-t -mx-1 px-1 mt-6">
            <div className="flex w-full flex-col sm:flex-row justify-end gap-3">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
                  Hủy
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isSubmitting || !selectedProductId || (branches.length > 1 && !selectedBranchId) || !time || !selectedDate || !selectedCustomerId}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? 'Đang xử lý...' : 'Đặt lịch'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
