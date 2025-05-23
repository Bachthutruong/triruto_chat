
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
import { format, addMinutes, startOfHour, setHours, setMinutes } from 'date-fns';
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
}


export function AppointmentBookingForm({ isOpen, onClose, onSubmit, currentUserSession }: AppointmentBookingFormProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('09:00');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const appSettingsFromContext = useAppSettingsContext();

  const [customerList, setCustomerList] = useState<{ id: string, name: string, phoneNumber: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(
    currentUserSession?.role === 'customer' ? currentUserSession.id : undefined
  );
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [currentAppSettings, setCurrentAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const appSettingsToUse = appSettingsFromContext || currentAppSettings;
    const selectedProduct = products.find(p => p.id === selectedProductId);
    let serviceSpecificWorkingHours = selectedProduct?.schedulingRules?.workingHours;
    let serviceSpecificDuration = selectedProduct?.schedulingRules?.serviceDurationMinutes;

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
          
          setProducts(fetchedProducts.filter(p => p.isActive && p.isSchedulable)); 
          setBranches(fetchedBranches);
          setCustomerList(fetchedCustomers);
          
          // Auto-select customer if current user is a customer
          if (currentUserSession?.role === 'customer' && !selectedCustomerId) {
            setSelectedCustomerId(currentUserSession.id);
          }

          // Auto-select branch if only one is available
          if (fetchedBranches.length === 1 && !selectedBranchId) {
            setSelectedBranchId(fetchedBranches[0].id);
          }
          
        } catch (error) {
          toast({ title: "Lỗi tải dữ liệu", description: "Không thể tải danh sách dịch vụ, chi nhánh hoặc khách hàng.", variant: "destructive" });
        }
      };
      fetchData();
    } else {
      // Reset form fields when dialog closes, except for date and customer if it's a customer
      setSelectedProductId('');
      setTime('09:00'); // Reset time to default
      setSelectedBranchId('');
      setNotes('');
      if (currentUserSession?.role !== 'customer') {
        setSelectedCustomerId(undefined);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUserSession, toast]); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProduct = products.find(p => p.id === selectedProductId);
    const selectedBranch = branches.find(b => b.id === selectedBranchId);

    let branchIsRequiredAndMissing = false;
    if (branches.length > 1 && !selectedBranchId) { // Branch selection is required only if there are multiple branches
      branchIsRequiredAndMissing = true;
    }

    if (!selectedProductId || !selectedDate || !time || !selectedCustomerId || branchIsRequiredAndMissing) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng điền đầy đủ các trường bắt buộc: Dịch vụ, Khách hàng, Ngày, Giờ và Chi nhánh (nếu có nhiều hơn 1).', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const formData: AppointmentBookingFormData = {
      service: selectedProduct!.name, // selectedProduct is guaranteed by the validation above
      productId: selectedProduct!.id,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time,
      branch: selectedBranch?.name, // Can be undefined if no branches or only one branch (auto-selected)
      branchId: selectedBranchId || (branches.length === 1 ? branches[0].id : undefined), // Ensure branchId is set if one branch
      notes: notes.trim() || undefined,
      customerId: selectedCustomerId!, // selectedCustomerId is guaranteed by validation
    };
    await onSubmit(formData);
    setIsSubmitting(false);
    // Do not close dialog here, parent component (HomePage) will close it upon successful booking if needed
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Đặt lịch hẹn trực tiếp</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto p-1">
          {(currentUserSession?.role === 'admin' || currentUserSession?.role === 'staff') && (
            <div className="space-y-2">
              <Label htmlFor="customer" className="text-sm font-medium">Khách hàng <span className="text-destructive">*</span></Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} disabled={isSubmitting}>
                <SelectTrigger id="customer" className="w-full">
                  <SelectValue placeholder="Chọn khách hàng" />
                </SelectTrigger>
                <SelectContent>
                  {customerList.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phoneNumber})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="service" className="text-sm font-medium">Dịch vụ <span className="text-destructive">*</span></Label>
            <Select 
                value={selectedProductId} 
                onValueChange={(value) => {
                    setSelectedProductId(value);
                    if (timeSlots.length > 0) setTime(timeSlots[0]); else setTime('');
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
                  {timeSlots.length === 0 && <SelectItem value="" disabled>Không có khung giờ phù hợp</SelectItem>}
                  {timeSlots.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {branches.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="branch" className="text-sm font-medium">Chi nhánh {branches.length === 1 ? '(Mặc định)' : <span className="text-destructive">*</span>}</Label>
              <Select 
                value={selectedBranchId} // Always use selectedBranchId for value
                onValueChange={setSelectedBranchId} 
                disabled={isSubmitting || branches.length === 0}
                required={branches.length > 1} // Only required if more than one branch
              >
                <SelectTrigger id="branch" className="w-full">
                  <SelectValue placeholder={branches.length > 1 ? "Chọn chi nhánh" : (branches.length === 1 ? branches[0].name : "Không có chi nhánh")} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
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

