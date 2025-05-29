// src/components/products/ProductForm.tsx
'use client';

import React, { useState, useEffect, Fragment, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ImageIcon, CalendarCog, ClockIcon, UsersIcon, CalendarDays, Save, Trash2, PlusCircle, XCircle } from 'lucide-react';
import type { ProductItem, ProductSchedulingRules, SpecificDayRule } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, parse, isValid as isValidDateFns, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const daysOfWeek = [
  { id: 1, label: 'Thứ 2' }, { id: 2, label: 'Thứ 3' }, { id: 3, label: 'Thứ 4' },
  { id: 4, label: 'Thứ 5' }, { id: 5, label: 'Thứ 6' }, { id: 6, label: 'Thứ 7' },
  { id: 0, label: 'Chủ nhật' }
];

interface ProductFormProps {
  initialProductData?: ProductItem | null;
  onSubmit: (productData: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  formType: 'add' | 'edit';
}

export function ProductForm({ initialProductData, onSubmit, onCancel, isSubmitting, formType }: ProductFormProps) {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSchedulable, setIsSchedulable] = useState(true);
  const [productSchedulingRules, setProductSchedulingRules] = useState<Partial<ProductSchedulingRules>>({});
  const [prodWorkingHoursInput, setProdWorkingHoursInput] = useState(''); // State for raw input string

  const [tempProductSpecRuleDate, setTempProductSpecRuleDate] = useState('');
  const [tempProductSpecRuleIsOff, setTempProductSpecRuleIsOff] = useState(false);
  const [tempProductSpecRuleHours, setTempProductSpecRuleHours] = useState('');
  const [tempProductSpecRuleStaff, setTempProductSpecRuleStaff] = useState('');
  const [tempProductSpecRuleDuration, setTempProductSpecRuleDuration] = useState('');
  const [tempProductOneTimeOffDate, setTempProductOneTimeOffDate] = useState('');

  // New state for type and expiry date
  const [type, setType] = useState<'product' | 'service'>('product');
  const [expiryDate, setExpiryDate] = useState<string>(''); // Use string for input type="date"

  useEffect(() => {
    if (initialProductData) {
      setName(initialProductData.name);
      setDescription(initialProductData.description || '');
      setPrice(initialProductData.price.toString());
      setCategory(initialProductData.category || '');
      setImageUrl(initialProductData.imageUrl || '');
      setIsActive(initialProductData.isActive);
      setIsSchedulable(initialProductData.isSchedulable ?? true);
      const initialRules = initialProductData.schedulingRules || {};
      if (initialRules.specificDayRules) {
        initialRules.specificDayRules = initialRules.specificDayRules.map(rule => ({
          ...rule,
          id: rule.id || `client-${Date.now()}-${Math.random()}`
        }));
      }
      setProductSchedulingRules(initialRules);
      setProdWorkingHoursInput(initialRules.workingHours?.join(', ') || '');

      // Initialize new state fields
      setType(initialProductData.type || 'product');
      setExpiryDate(initialProductData.expiryDate ? format(new Date(initialProductData.expiryDate), 'yyyy-MM-dd') : '');

    } else {
      // Defaults for new product
      setIsActive(true);
      setIsSchedulable(true);
      setProductSchedulingRules({});
      setProdWorkingHoursInput('');

      // Defaults for new product
      setType('product');
      setExpiryDate('');
    }
  }, [initialProductData]);

  const handleSchedulingRuleChange = (field: keyof ProductSchedulingRules, value: any) => {
    setProductSchedulingRules(prev => ({ ...prev, [field]: value }));
  };

  const handleProductWeeklyOffDayChange = (dayId: number, checked: boolean | 'indeterminate') => {
    const currentOffDays = productSchedulingRules.weeklyOffDays || [];
    const newOffDays = checked === true
      ? [...currentOffDays, dayId].filter((v, i, a) => a.indexOf(v) === i)
      : currentOffDays.filter(d => d !== dayId);
    handleSchedulingRuleChange('weeklyOffDays', newOffDays.length > 0 ? newOffDays : undefined);
  };

  const handleAddProductOneTimeOffDate = () => {
    if (tempProductOneTimeOffDate && !isValidDateFns(parse(tempProductOneTimeOffDate, 'yyyy-MM-dd', new Date()))) {
      toast({ title: "Lỗi định dạng ngày", description: "Ngày nghỉ riêng không hợp lệ. Phải là YYYY-MM-DD.", variant: "destructive" });
      return;
    }
    if (tempProductOneTimeOffDate) {
      const currentDates = productSchedulingRules.oneTimeOffDates || [];
      if (!currentDates.includes(tempProductOneTimeOffDate)) {
        const newDates = [...currentDates, tempProductOneTimeOffDate];
        handleSchedulingRuleChange('oneTimeOffDates', newDates);
      }
      setTempProductOneTimeOffDate('');
    }
  };

  const handleRemoveProductOneTimeOffDate = (dateToRemove: string) => {
    const newDates = (productSchedulingRules.oneTimeOffDates || []).filter(d => d !== dateToRemove);
    handleSchedulingRuleChange('oneTimeOffDates', newDates.length > 0 ? newDates : undefined);
  };

  const handleAddProductSpecificDayRule = () => {
    if (!tempProductSpecRuleDate || !isValidDateFns(parse(tempProductSpecRuleDate, 'yyyy-MM-dd', new Date()))) {
      toast({ title: "Thiếu thông tin", description: "Vui lòng chọn ngày hợp lệ (YYYY-MM-DD) cho quy tắc cụ thể của sản phẩm.", variant: "destructive" });
      return;
    }
    const newRule: SpecificDayRule = {
      id: `client-${Date.now()}-${Math.random()}`,
      date: tempProductSpecRuleDate,
      isOff: tempProductSpecRuleIsOff,
      workingHours: tempProductSpecRuleHours.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)).length > 0 ? tempProductSpecRuleHours.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)) : undefined,
      numberOfStaff: tempProductSpecRuleStaff.trim() !== '' ? parseFloat(tempProductSpecRuleStaff) : undefined,
      serviceDurationMinutes: tempProductSpecRuleDuration.trim() !== '' ? parseFloat(tempProductSpecRuleDuration) : undefined,
    };
    const existingRules = productSchedulingRules.specificDayRules || [];
    handleSchedulingRuleChange('specificDayRules', [...existingRules, newRule]);
    setTempProductSpecRuleDate(''); setTempProductSpecRuleIsOff(false); setTempProductSpecRuleHours(''); setTempProductSpecRuleStaff(''); setTempProductSpecRuleDuration('');
  };

  const handleRemoveProductSpecificDayRule = (idToRemove: string) => {
    const newRules = (productSchedulingRules.specificDayRules || []).filter(rule => rule.id !== idToRemove);
    handleSchedulingRuleChange('specificDayRules', newRules.length > 0 ? newRules : undefined);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category.trim() || !price.trim()) {
        toast({ title: "Thiếu thông tin", description: "Tên, Danh mục và Giá là bắt buộc.", variant: "destructive" });
        return;
    }

    // Validate expiry date format if provided
    let parsedExpiryDate: Date | null = null; // Initialize as null
    if (expiryDate.trim()) {
      const date = parse(expiryDate, 'yyyy-MM-dd', new Date());
      if (!isValidDateFns(date)) {
        toast({ title: "Lỗi định dạng ngày", description: "Hạn sử dụng không hợp lệ. Phải là YYYY-MM-DD.", variant: "destructive" });
        return;
      }
      // Set time to end of day for logical expiry
      parsedExpiryDate = setMilliseconds(setSeconds(setMinutes(setHours(date, 23), 59), 59), 999);
    }

    const parsedProdWorkingHours = prodWorkingHoursInput
        .split(',')
        .map(h => h.trim())
        .filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h));

    const productData: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(),
      price: parseFloat(price) || 0,
      category: category.trim(),
      isActive,
      isSchedulable,
      type: type,
      expiryDate: parsedExpiryDate,
      // Explicitly set description to an empty string if trimmed input is empty
      description: description.trim(),
      // Initialize optional fields to undefined or null explicitly if they are not provided/empty
      imageUrl: imageUrl.trim() || undefined, // imageUrl is optional (string | undefined) in ProductItem
      defaultSessions: undefined, // Assuming not handled in this form yet
      expiryDays: undefined, // Assuming not handled in this form yet
      expiryReminderTemplate: undefined, // Assuming not handled in this form yet
      expiryReminderDaysBefore: undefined, // Assuming not handled in this form yet
      schedulingRules: undefined,
    };

    if (isSchedulable) {
        const schedulingRules: Partial<ProductSchedulingRules> = {};

        if (productSchedulingRules.numberOfStaff !== undefined && !isNaN(parseFloat(productSchedulingRules.numberOfStaff as any))) {
            schedulingRules.numberOfStaff = parseFloat(productSchedulingRules.numberOfStaff as any);
        }
        if (productSchedulingRules.serviceDurationMinutes !== undefined && !isNaN(parseFloat(productSchedulingRules.serviceDurationMinutes as any))) {
            schedulingRules.serviceDurationMinutes = parseFloat(productSchedulingRules.serviceDurationMinutes as any);
        }
        if (parsedProdWorkingHours.length > 0) {
            schedulingRules.workingHours = parsedProdWorkingHours;
        }
        if (productSchedulingRules.weeklyOffDays && Array.isArray(productSchedulingRules.weeklyOffDays) && productSchedulingRules.weeklyOffDays.length > 0) {
            schedulingRules.weeklyOffDays = productSchedulingRules.weeklyOffDays;
        }
        if (productSchedulingRules.oneTimeOffDates && Array.isArray(productSchedulingRules.oneTimeOffDates) && productSchedulingRules.oneTimeOffDates.length > 0) {
            schedulingRules.oneTimeOffDates = productSchedulingRules.oneTimeOffDates;
        }
        if (productSchedulingRules.specificDayRules && Array.isArray(productSchedulingRules.specificDayRules) && productSchedulingRules.specificDayRules.length > 0) {
             schedulingRules.specificDayRules = (productSchedulingRules.specificDayRules || []).map(r => { const { id, ...rest } = r; return rest; });
        }

        if (Object.keys(schedulingRules).length > 0) {
            productData.schedulingRules = schedulingRules;
        }
    }

    onSubmit(productData);
  };

  return (
    <form onSubmit={handleSubmitForm} className="flex-grow flex flex-col overflow-hidden h-full">
      <ScrollArea className="flex-grow p-1 pr-3 space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-xl">Thông tin cơ bản</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="name">Tên <span className="text-destructive">*</span></Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmitting} /></div>
              <div className="space-y-1.5"><Label htmlFor="category">Danh mục <span className="text-destructive">*</span></Label><Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} required disabled={isSubmitting} /></div>
            </div>

            {/* New fields for Type and Expiry Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="type">Loại <span className="text-destructive">*</span></Label>
                <Select value={type} onValueChange={(value: 'product' | 'service') => setType(value)} disabled={isSubmitting}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Chọn loại" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Sản phẩm</SelectItem>
                    <SelectItem value="service">Dịch vụ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                 <Label htmlFor="expiryDate">Hạn sử dụng (tùy chọn)</Label>
                 <Input id="expiryDate" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} disabled={isSubmitting} />
              </div>
            </div>

            <div className="space-y-1.5"><Label htmlFor="description">Mô tả <span className="text-destructive">*</span></Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required disabled={isSubmitting} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="price">Giá (VND) <span className="text-destructive">*</span></Label><Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required disabled={isSubmitting} /></div>
              <div className="space-y-1.5"><Label htmlFor="imageUrl">URL Hình ảnh</Label><Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={isSubmitting} placeholder="https://example.com/image.jpg" /></div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox id="isActive" checked={isActive} onCheckedChange={(checked) => setIsActive(!!checked)} disabled={isSubmitting} />
              <Label htmlFor="isActive" className="font-normal">Đang bán/Hoạt động</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Checkbox id="isSchedulable" checked={isSchedulable} onCheckedChange={(checked) => setIsSchedulable(!!checked)} disabled={isSubmitting} />
              <Label htmlFor="isSchedulable" className="text-xl font-semibold cursor-pointer">Có thể đặt lịch hẹn cho sản phẩm/dịch vụ này?</Label>
            </div>
            <CardDescription className="pl-6">Nếu được chọn, bạn có thể cấu hình các quy tắc đặt lịch riêng cho dịch vụ này. Nếu không, các cài đặt chung sẽ được áp dụng.</CardDescription>
          </CardHeader>
          {isSchedulable && (
            <CardContent className="space-y-6 pt-0 pl-6">
              <Separator className="my-4"/>
              <p className="text-sm text-muted-foreground">Để trống các trường dưới đây nếu muốn sử dụng cài đặt chung của toàn hệ thống cho dịch vụ này.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="prodNumberOfStaff"><UsersIcon className="inline mr-1 h-4 w-4" />Số nhân viên riêng</Label>
                  <Input id="prodNumberOfStaff" type="number" min="0" value={productSchedulingRules.numberOfStaff ?? ''} onChange={e => handleSchedulingRuleChange('numberOfStaff', e.target.value === '' ? undefined : parseFloat(e.target.value))} placeholder="Mặc định theo cài đặt chung" disabled={isSubmitting}/>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prodServiceDuration"><ClockIcon className="inline mr-1 h-4 w-4" />Thời gian DV riêng (phút)</Label>
                  <Input id="prodServiceDuration" type="number" min="5" value={productSchedulingRules.serviceDurationMinutes ?? ''} onChange={e => handleSchedulingRuleChange('serviceDurationMinutes', e.target.value === '' ? undefined : parseFloat(e.target.value))} placeholder="Mặc định theo cài đặt chung" disabled={isSubmitting}/>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prodWorkingHours"><ClockIcon className="inline mr-1 h-4 w-4" />Giờ nhận khách riêng (HH:MM, HH:MM)</Label>
                <Input 
                    id="prodWorkingHours" 
                    value={prodWorkingHoursInput} 
                    onChange={e => setProdWorkingHoursInput(e.target.value)} 
                    placeholder="VD: 08:00,14:00 (Mặc định chung)" 
                    disabled={isSubmitting}/>
              </div>
              <div className="space-y-1.5">
                <Label><CalendarDays className="inline mr-1 h-4 w-4" />Ngày nghỉ hàng tuần riêng</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-1">
                {daysOfWeek.map(day => (
                  <div key={`prodOffDay-${day.id}`} className="flex items-center space-x-2">
                    <Checkbox id={`prodOffDay-${day.id}`} checked={(productSchedulingRules.weeklyOffDays || []).includes(day.id)} onCheckedChange={(checked) => handleProductWeeklyOffDayChange(day.id, !!checked)} disabled={isSubmitting}/>
                    <Label htmlFor={`prodOffDay-${day.id}`} className="font-normal text-sm">{day.label}</Label>
                  </div>
                ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label><CalendarDays className="inline mr-1 h-4 w-4" />Ngày nghỉ Lễ/Đặc biệt riêng</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={tempProductOneTimeOffDate}
                    onChange={e => setTempProductOneTimeOffDate(e.target.value)}
                    disabled={isSubmitting}
                    className="flex-grow"
                  />
                  <Button type="button" onClick={handleAddProductOneTimeOffDate} disabled={!tempProductOneTimeOffDate || isSubmitting} size="sm"><PlusCircle className="h-4 w-4"/></Button>
                </div>
                {(productSchedulingRules.oneTimeOffDates || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(productSchedulingRules.oneTimeOffDates || []).map(date => (
                      <Badge key={date} variant="secondary">
                        {format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}
                        <button type="button" className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => handleRemoveProductOneTimeOffDate(date)} disabled={isSubmitting}><XCircle className="h-3 w-3"/></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label><CalendarCog className="inline mr-1 h-4 w-4" />Quy tắc ngày cụ thể riêng</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <Input type="date" placeholder="Ngày (YYYY-MM-DD)" value={tempProductSpecRuleDate} onChange={e => setTempProductSpecRuleDate(e.target.value)} disabled={isSubmitting}/>
                  <div className="flex items-center gap-2">
                     <Checkbox id="tempSpecRuleIsOff" checked={tempProductSpecRuleIsOff} onCheckedChange={checked => setTempProductSpecRuleIsOff(!!checked)} disabled={isSubmitting}/>
                     <Label htmlFor="tempSpecRuleIsOff" className="font-normal text-sm">Ngày nghỉ</Label>
                  </div>
                </div>
                {!tempProductSpecRuleIsOff && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                    <Input placeholder="Giờ (HH:MM, HH:MM)" value={tempProductSpecRuleHours} onChange={e => setTempProductSpecRuleHours(e.target.value)} disabled={tempProductSpecRuleIsOff || isSubmitting}/>
                    <Input type="number" min="0" placeholder="Số NV" value={tempProductSpecRuleStaff} onChange={e => setTempProductSpecRuleStaff(e.target.value)} disabled={tempProductSpecRuleIsOff || isSubmitting}/>
                    <Input type="number" min="5" placeholder="Thời gian (phút)" value={tempProductSpecRuleDuration} onChange={e => setTempProductSpecRuleDuration(e.target.value)} disabled={tempProductSpecRuleIsOff || isSubmitting}/>
                  </div>
                )}
                 <Button type="button" onClick={handleAddProductSpecificDayRule} disabled={!tempProductSpecRuleDate || isSubmitting} size="sm"><PlusCircle className="h-4 w-4"/></Button>

                 {(productSchedulingRules.specificDayRules || []).length > 0 && (
                  <div className="space-y-2 mt-2">
                    {(productSchedulingRules.specificDayRules || []).map(rule => (
                      <div key={rule.id} className="p-2 border rounded flex justify-between items-center text-xs bg-muted/50">
                        <div>
                          <p>Ngày: {format(parse(rule.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}</p>
                          {rule.isOff ? (
                            <p>Ngày nghỉ</p>
                          ) : (
                            <p>Giờ: {rule.workingHours?.join(',') || 'Mặc định'} | Số NV: {rule.numberOfStaff || 'Mặc định'} | Thời gian: {rule.serviceDurationMinutes || 'Mặc định'} phút</p>
                          )}
                        </div>
                        <button type="button" className="text-destructive hover:text-destructive/80" onClick={() => handleRemoveProductSpecificDayRule(rule.id!)} disabled={isSubmitting}><Trash2 className="h-4 w-4"/></button>
                      </div>
                    ))}
                  </div>
                 )}
              </div>
            </CardContent>
          )}
        </Card>

      </ScrollArea>
      <div className="flex justify-end gap-2 p-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Hủy</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <ImageIcon className="mr-2 h-4 w-4 animate-spin" />}
          {formType === 'add' ? 'Tạo Sản phẩm' : 'Lưu Thay đổi'}
        </Button>
      </div>
    </form>
  );
}
