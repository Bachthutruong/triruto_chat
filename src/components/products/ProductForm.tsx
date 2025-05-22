
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
import { format, parse, isValid as isValidDateFns } from 'date-fns';

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

  const [tempProductSpecRuleDate, setTempProductSpecRuleDate] = useState('');
  const [tempProductSpecRuleIsOff, setTempProductSpecRuleIsOff] = useState(false);
  const [tempProductSpecRuleHours, setTempProductSpecRuleHours] = useState('');
  const [tempProductSpecRuleStaff, setTempProductSpecRuleStaff] = useState('');
  const [tempProductSpecRuleDuration, setTempProductSpecRuleDuration] = useState('');
  const [tempProductOneTimeOffDate, setTempProductOneTimeOffDate] = useState('');

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
    } else {
      // Defaults for new product
      setIsActive(true);
      setIsSchedulable(true);
      setProductSchedulingRules({});
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

    const productData: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'> = {
      name,
      description,
      price: parseFloat(price) || 0,
      category,
      imageUrl: imageUrl || undefined,
      isActive,
      isSchedulable,
      schedulingRules: isSchedulable ? {
        numberOfStaff: productSchedulingRules.numberOfStaff !== undefined && !isNaN(parseFloat(productSchedulingRules.numberOfStaff as any)) ? parseFloat(productSchedulingRules.numberOfStaff as any) : undefined,
        serviceDurationMinutes: productSchedulingRules.serviceDurationMinutes !== undefined && !isNaN(parseFloat(productSchedulingRules.serviceDurationMinutes as any)) ? parseFloat(productSchedulingRules.serviceDurationMinutes as any) : undefined,
        workingHours: (productSchedulingRules.workingHours && Array.isArray(productSchedulingRules.workingHours) && productSchedulingRules.workingHours.length > 0) ? productSchedulingRules.workingHours : undefined,
        weeklyOffDays: (productSchedulingRules.weeklyOffDays && Array.isArray(productSchedulingRules.weeklyOffDays) && productSchedulingRules.weeklyOffDays.length > 0) ? productSchedulingRules.weeklyOffDays : undefined,
        oneTimeOffDates: (productSchedulingRules.oneTimeOffDates && Array.isArray(productSchedulingRules.oneTimeOffDates) && productSchedulingRules.oneTimeOffDates.length > 0) ? productSchedulingRules.oneTimeOffDates : undefined,
        specificDayRules: (productSchedulingRules.specificDayRules || []).map(r => { const { id, ...rest } = r; return rest; }),
      } : undefined,
    };

    if (productData.schedulingRules) {
      if (productData.schedulingRules.specificDayRules?.length === 0) {
        delete productData.schedulingRules.specificDayRules;
      }
      if (productData.schedulingRules.workingHours?.length === 0) {
        delete productData.schedulingRules.workingHours;
      }
      if (productData.schedulingRules.weeklyOffDays?.length === 0) {
        delete productData.schedulingRules.weeklyOffDays;
      }
      if (productData.schedulingRules.oneTimeOffDates?.length === 0) {
        delete productData.schedulingRules.oneTimeOffDates;
      }
      if (Object.values(productData.schedulingRules).every(value => value === undefined || (Array.isArray(value) && value.length === 0))) {
        delete productData.schedulingRules;
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
            <div className="space-y-1.5"><Label htmlFor="description">Mô tả</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting} /></div>
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
                <Input id="prodWorkingHours" value={(productSchedulingRules.workingHours || []).join(', ')} onChange={e => handleSchedulingRuleChange('workingHours', e.target.value.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)))} placeholder="VD: 08:00,14:00 (Mặc định chung)" disabled={isSubmitting}/>
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
                <div className="flex gap-2 items-center">
                  <Input type="date" value={tempProductOneTimeOffDate} onChange={e => setTempProductOneTimeOffDate(e.target.value)} className="max-w-xs h-9 text-sm" disabled={isSubmitting}/>
                  <Button type="button" onClick={handleAddProductOneTimeOffDate} disabled={isSubmitting || !tempProductOneTimeOffDate} size="sm" className="h-9">Thêm</Button>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                {(productSchedulingRules.oneTimeOffDates || []).map(date => (
                  <li key={date} className="flex items-center justify-between p-1 bg-muted/50 rounded text-xs">
                    {isValidDateFns(parse(date, 'yyyy-MM-dd', new Date())) ? format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : 'Ngày không hợp lệ'}
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveProductOneTimeOffDate(date)} disabled={isSubmitting}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </li>
                ))}
                </ul>
              </div>
              <Separator />
              <div>
                <h4 className="text-md font-semibold mb-1">Quy tắc Ngày Cụ thể (Riêng cho DV này)</h4>
                <p className="text-xs text-muted-foreground mb-2">Ghi đè các quy tắc riêng của dịch vụ này cho một ngày nhất định.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-2 border rounded-md mb-3 items-end">
                  <Input type="date" value={tempProductSpecRuleDate} onChange={e => setTempProductSpecRuleDate(e.target.value)} placeholder="Ngày" className="h-8 text-xs"/>
                  <Input value={tempProductSpecRuleHours} onChange={e => setTempProductSpecRuleHours(e.target.value)} placeholder="Giờ làm việc (HH:MM,)" className="h-8 text-xs"/>
                  <Input type="number" value={tempProductSpecRuleStaff} onChange={e => setTempProductSpecRuleStaff(e.target.value)} placeholder="Số NV" className="h-8 text-xs"/>
                  <Input type="number" value={tempProductSpecRuleDuration} onChange={e => setTempProductSpecRuleDuration(e.target.value)} placeholder="TG DV (phút)" className="h-8 text-xs"/>
                  <div className="flex items-center space-x-2"><Checkbox id="tempProdSpecRuleIsOffDialog" checked={tempProductSpecRuleIsOff} onCheckedChange={(checked) => setTempProductSpecRuleIsOff(!!checked)} /><Label htmlFor="tempProdSpecRuleIsOffDialog" className="text-xs">Ngày nghỉ</Label></div>
                  <Button type="button" onClick={handleAddProductSpecificDayRule} size="xs" className="h-8 text-xs"><PlusCircle className="mr-1 h-3 w-3"/>Thêm</Button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                {(productSchedulingRules.specificDayRules || []).map((rule, index) => (
                  <Card key={rule.id || index} className="p-2 bg-muted/30 text-xs">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-semibold">Ngày: {isValidDateFns(parse(rule.date, 'yyyy-MM-dd', new Date())) ? format(parse(rule.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : 'Ngày không hợp lệ'}</p>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveProductSpecificDayRule(rule.id!)} className="h-5 w-5"><Trash2 className="h-3 w-3 text-destructive"/></Button>
                    </div>
                    <p>Nghỉ: {rule.isOff ? 'Có' : 'Không'}</p>
                    {rule.workingHours && <p>Giờ: {rule.workingHours.join(', ')}</p>}
                    {rule.numberOfStaff !== undefined && <p>Số NV: {rule.numberOfStaff}</p>}
                    {rule.serviceDurationMinutes !== undefined && <p>TG DV: {rule.serviceDurationMinutes} phút</p>}
                  </Card>
                ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </ScrollArea>
      <div className="pt-6 border-t shrink-0 bg-background p-4 flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Hủy
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save className="mr-2 h-4 w-4" />
          {isSubmitting ? 'Đang lưu...' : (formType === 'edit' ? 'Lưu thay đổi' : 'Tạo Sản phẩm')}
        </Button>
      </div>
    </form>
  );
}
