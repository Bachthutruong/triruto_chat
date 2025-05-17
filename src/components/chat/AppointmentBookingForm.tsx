
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
import type { AppointmentBookingFormData, UserSession } from '@/lib/types';
import { format, addMinutes, startOfHour, setHours, setMinutes } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { getCustomerListForSelect } from '@/app/actions'; // If staff is booking

interface AppointmentBookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: AppointmentBookingFormData) => Promise<void>;
  currentUserSession: UserSession | null;
}

// Generate time slots, e.g., 00:00, 00:15, ..., 23:45
const generateTimeSlots = () => {
  const slots = [];
  let date = startOfHour(new Date());
  date = setHours(date, 0);
  date = setMinutes(date, 0);

  for (let i = 0; i < 24 * 4; i++) { // 24 hours * 4 slots per hour (15 min intervals)
    slots.push(format(date, 'HH:mm'));
    date = addMinutes(date, 15);
  }
  return slots;
};

const timeSlots = generateTimeSlots();

export function AppointmentBookingForm({ isOpen, onClose, onSubmit, currentUserSession }: AppointmentBookingFormProps) {
  const [service, setService] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('09:00');
  const [branch, setBranch] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // For staff/admin booking for a customer
  const [customerList, setCustomerList] = useState<{id: string, name: string, phoneNumber: string}[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(currentUserSession?.role === 'customer' ? currentUserSession.id : undefined);


  useEffect(() => {
    if ((currentUserSession?.role === 'admin' || currentUserSession?.role === 'staff') && isOpen) {
      getCustomerListForSelect()
        .then(setCustomerList)
        .catch(() => toast({ title: "Lỗi", description: "Không thể tải danh sách khách hàng.", variant: "destructive" }));
    }
    if (currentUserSession?.role === 'customer' && isOpen) {
        setSelectedCustomerId(currentUserSession.id);
    }
  }, [currentUserSession, isOpen, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service.trim() || !selectedDate || !time || !selectedCustomerId) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng điền dịch vụ, ngày, giờ và chọn khách hàng (nếu có).', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const formData: AppointmentBookingFormData = {
      service,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time,
      branch: branch.trim() || undefined,
      notes: notes.trim() || undefined,
      customerId: selectedCustomerId,
    };
    await onSubmit(formData);
    setIsSubmitting(false);
    // onClose(); // Let parent component handle closing on success/failure
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đặt lịch hẹn trực tiếp</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          {(currentUserSession?.role === 'admin' || currentUserSession?.role === 'staff') && (
            <div>
              <Label htmlFor="customer">Khách hàng</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} disabled={isSubmitting}>
                <SelectTrigger id="customer"><SelectValue placeholder="Chọn khách hàng" /></SelectTrigger>
                <SelectContent>
                  {customerList.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phoneNumber})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="service">Dịch vụ</Label>
            <Input id="service" value={service} onChange={e => setService(e.target.value)} required disabled={isSubmitting} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Ngày</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border p-0 [&_button]:text-sm"
                disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1 )) || isSubmitting} // Disable past dates
                locale={vi}
              />
            </div>
            <div>
              <Label htmlFor="time">Giờ</Label>
              <Select value={time} onValueChange={setTime} disabled={isSubmitting}>
                <SelectTrigger id="time"><SelectValue placeholder="Chọn giờ" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {timeSlots.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="branch">Chi nhánh (Tùy chọn)</Label>
            <Input id="branch" value={branch} onChange={e => setBranch(e.target.value)} disabled={isSubmitting} />
          </div>
          <div>
            <Label htmlFor="notes">Ghi chú (Tùy chọn)</Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} disabled={isSubmitting} />
          </div>
          <DialogFooter className="sticky bottom-0 bg-background py-4 border-t -mx-1 px-1">
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Hủy</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang xử lý...' : 'Đặt lịch'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
    