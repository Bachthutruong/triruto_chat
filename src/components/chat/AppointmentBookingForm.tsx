
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
import type { AppointmentBookingFormData, UserSession, ProductItem, Branch } from '@/lib/types';
import { format, addMinutes, startOfHour, setHours, setMinutes } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { getCustomerListForSelect, getAllProducts, getBranches } from '@/app/actions';

interface AppointmentBookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: AppointmentBookingFormData) => Promise<void>;
  currentUserSession: UserSession | null;
}

const generateTimeSlots = () => {
  const slots = [];
  let date = startOfHour(new Date());
  date = setHours(date, 0);
  date = setMinutes(date, 0);
  for (let i = 0; i < 24 * 4; i++) {
    slots.push(format(date, 'HH:mm'));
    date = addMinutes(date, 15);
  }
  return slots;
};

const timeSlots = generateTimeSlots();

export function AppointmentBookingForm({ isOpen, onClose, onSubmit, currentUserSession }: AppointmentBookingFormProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('09:00');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [customerList, setCustomerList] = useState<{id: string, name: string, phoneNumber: string}[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(currentUserSession?.role === 'customer' ? currentUserSession.id : undefined);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const [fetchedProducts, fetchedBranches, fetchedCustomers] = await Promise.all([
            getAllProducts(),
            getBranches(true), // Fetch only active branches
            (currentUserSession?.role === 'admin' || currentUserSession?.role === 'staff') ? getCustomerListForSelect() : Promise.resolve([])
          ]);
          setProducts(fetchedProducts.filter(p => p.isActive));
          setBranches(fetchedBranches);
          setCustomerList(fetchedCustomers);
          if (currentUserSession?.role === 'customer') {
            setSelectedCustomerId(currentUserSession.id);
          }
        } catch (error) {
          toast({ title: "Lỗi tải dữ liệu", description: "Không thể tải danh sách dịch vụ, chi nhánh hoặc khách hàng.", variant: "destructive" });
        }
      };
      fetchData();
    }
  }, [currentUserSession, isOpen, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProduct = products.find(p => p.id === selectedProductId);
    const selectedBranch = branches.find(b => b.id === selectedBranchId);

    if (!selectedProduct || !selectedDate || !time || !selectedCustomerId || (branches.length > 0 && !selectedBranch)) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng điền đầy đủ các trường bắt buộc: Dịch vụ, Khách hàng, Ngày, Giờ và Chi nhánh (nếu có).', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const formData: AppointmentBookingFormData = {
      service: selectedProduct.name,
      productId: selectedProduct.id,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time,
      branch: selectedBranch?.name,
      branchId: selectedBranch?.id,
      notes: notes.trim() || undefined,
      customerId: selectedCustomerId,
    };
    await onSubmit(formData);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg"> {/* Increased max-width for better layout */}
        <DialogHeader>
          <DialogTitle>Đặt lịch hẹn trực tiếp</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          {(currentUserSession?.role === 'admin' || currentUserSession?.role === 'staff') && (
            <div>
              <Label htmlFor="customer">Khách hàng <span className="text-destructive">*</span></Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} disabled={isSubmitting}>
                <SelectTrigger id="customer"><SelectValue placeholder="Chọn khách hàng" /></SelectTrigger>
                <SelectContent>
                  {customerList.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phoneNumber})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="service">Dịch vụ <span className="text-destructive">*</span></Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={isSubmitting || products.length === 0}>
              <SelectTrigger id="service"><SelectValue placeholder={products.length === 0 ? "Không có dịch vụ nào" : "Chọn dịch vụ"} /></SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.category})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-1">
              <Label htmlFor="date">Ngày <span className="text-destructive">*</span></Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border p-0 [&_button]:text-sm w-full"
                disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1 )) || isSubmitting}
                locale={vi}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="time">Giờ <span className="text-destructive">*</span></Label>
              <Select value={time} onValueChange={setTime} disabled={isSubmitting}>
                <SelectTrigger id="time"><SelectValue placeholder="Chọn giờ" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {timeSlots.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {branches.length > 0 && (
            <div>
              <Label htmlFor="branch">Chi nhánh <span className="text-destructive">*</span></Label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId} disabled={isSubmitting}>
                <SelectTrigger id="branch"><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Ghi chú (Tùy chọn)</Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} disabled={isSubmitting} />
          </div>
          <DialogFooter className="sticky bottom-0 bg-background py-4 border-t -mx-1 px-1">
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Hủy</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting || !selectedProductId || (branches.length > 0 && !selectedBranchId)}>{isSubmitting ? 'Đang xử lý...' : 'Đặt lịch'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
