// src/app/staff/branches/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Edit3, Trash, MapPin, Save, CalendarDays, UsersIcon as StaffIcon, ClockIcon } from 'lucide-react';
import type { Branch, BranchSpecificDayRule } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getBranches, createBranch, updateBranch, deleteBranch } from '@/app/actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';
import { format, parse, isValid as isValidDateFns } from 'date-fns';


const daysOfWeek = [
  { id: 0, label: 'Chủ nhật' }, { id: 1, label: 'Thứ 2' }, { id: 2, label: 'Thứ 3' },
  { id: 3, label: 'Thứ 4' }, { id: 4, label: 'Thứ 5' }, { id: 5, label: 'Thứ 6' },
  { id: 6, label: 'Thứ 7' }
];

export default function StaffBranchesPage() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  
  // Form state for Branch
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchContactInfo, setBranchContactInfo] = useState('');
  const [branchIsActive, setBranchIsActive] = useState(true);
  const [branchWorkingHours, setBranchWorkingHours] = useState(''); // Comma-separated HH:MM
  const [branchOffDays, setBranchOffDays] = useState<number[]>([]);
  const [branchNumberOfStaff, setBranchNumberOfStaff] = useState<string>(''); // String for input
  const [branchSpecificDayOverrides, setBranchSpecificDayOverrides] = useState<BranchSpecificDayRule[]>([]);

  // State for new specific day rule for a branch
  const [newSpecificRuleDate, setNewSpecificRuleDate] = useState('');
  const [newSpecificRuleIsOff, setNewSpecificRuleIsOff] = useState(false);
  const [newSpecificRuleWorkingHours, setNewSpecificRuleWorkingHours] = useState('');
  const [newSpecificRuleStaff, setNewSpecificRuleStaff] = useState('');


  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getBranches(false); // Fetch all branches, including inactive
      setBranches(data);
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể tải danh sách chi nhánh.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const resetForm = () => {
    setCurrentBranch(null);
    setBranchName('');
    setBranchAddress('');
    setBranchContactInfo('');
    setBranchIsActive(true);
    setBranchWorkingHours('');
    setBranchOffDays([]);
    setBranchNumberOfStaff('');
    setBranchSpecificDayOverrides([]);
    setNewSpecificRuleDate('');
    setNewSpecificRuleIsOff(false);
    setNewSpecificRuleWorkingHours('');
    setNewSpecificRuleStaff('');
  };

  const openModal = (branch: Branch | null = null) => {
    resetForm();
    if (branch) {
      setCurrentBranch(branch);
      setBranchName(branch.name);
      setBranchAddress(branch.address || '');
      setBranchContactInfo(branch.contactInfo || '');
      setBranchIsActive(branch.isActive);
      setBranchWorkingHours((branch.workingHours || []).join(', '));
      setBranchOffDays(branch.offDays || []);
      setBranchNumberOfStaff(branch.numberOfStaff?.toString() || '');
      setBranchSpecificDayOverrides((branch.specificDayOverrides || []).map(r => ({...r, id: r.id || new Date().getTime().toString()})));
    }
    setIsModalOpen(true);
  };

  const handleBranchOffDayChange = (dayId: number, checked: boolean) => {
    setBranchOffDays(prev => {
      if (checked) {
        return [...prev, dayId];
      } else {
        return prev.filter(d => d !== dayId);
      }
    });
  };

  const handleAddSpecificRuleForBranch = () => {
    if (!newSpecificRuleDate) {
      toast({ title: "Thiếu thông tin", description: "Vui lòng chọn ngày cho quy tắc cụ thể của chi nhánh.", variant: "destructive" });
      return;
    }
    if (!isValidDateFns(parse(newSpecificRuleDate, 'yyyy-MM-dd', new Date()))) {
      toast({ title: "Lỗi định dạng ngày", description: "Ngày không hợp lệ. Phải là YYYY-MM-DD", variant: "destructive" });
      return;
    }
    const parsedStaff = newSpecificRuleStaff !== '' ? parseFloat(newSpecificRuleStaff) : undefined;

    const rule: BranchSpecificDayRule = {
      id: new Date().getTime().toString(),
      date: newSpecificRuleDate,
      isOff: newSpecificRuleIsOff,
      workingHours: newSpecificRuleWorkingHours.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)).length > 0 ? newSpecificRuleWorkingHours.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)) : undefined,
      numberOfStaff: isNaN(parsedStaff as number) ? undefined : parsedStaff,
    };
    setBranchSpecificDayOverrides(prev => [...prev, rule]);
    setNewSpecificRuleDate(''); setNewSpecificRuleIsOff(false); setNewSpecificRuleWorkingHours(''); setNewSpecificRuleStaff('');
  };

  const handleRemoveSpecificRuleForBranch = (idToRemove: string) => {
    setBranchSpecificDayOverrides(prev => prev.filter(rule => rule.id !== idToRemove));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (!branchName.trim()) {
      toast({ title: "Thiếu thông tin", description: "Tên chi nhánh là bắt buộc.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    const parsedNumberOfStaff = branchNumberOfStaff !== '' ? parseFloat(branchNumberOfStaff) : undefined;

    const data = {
      name: branchName,
      address: branchAddress || undefined,
      contactInfo: branchContactInfo || undefined,
      isActive: branchIsActive,
      workingHours: branchWorkingHours.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)).length > 0 ? branchWorkingHours.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)) : undefined,
      offDays: branchOffDays.length > 0 ? branchOffDays : undefined,
      numberOfStaff: isNaN(parsedNumberOfStaff as number) ? undefined : parsedNumberOfStaff,
      specificDayOverrides: branchSpecificDayOverrides.map(r => { const {id, ...rest} = r; return rest; }), // Remove client-side ID
    };

    try {
      if (currentBranch) {
        await updateBranch(currentBranch.id, data);
        toast({ title: "Thành công", description: "Đã cập nhật chi nhánh." });
      } else {
        await createBranch(data);
        toast({ title: "Thành công", description: "Đã tạo chi nhánh mới." });
      }
      resetForm();
      setIsModalOpen(false);
      fetchBranches();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Thao tác thất bại.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBranch = async (id: string) => {
    try {
      await deleteBranch(id);
      toast({ title: "Thành công", description: "Đã xóa chi nhánh." });
      fetchBranches();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa chi nhánh. Có thể chi nhánh đang được sử dụng.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6" style={{ maxWidth: 'none', width: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý Chi nhánh</h1>
          <p className="text-muted-foreground">Thêm, sửa, xóa và cấu hình các chi nhánh.</p>
        </div>
        <Button onClick={() => openModal()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Thêm Chi nhánh Mới
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><MapPin className="mr-2 h-5 w-5 text-primary" /> Danh sách Chi nhánh</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <p>Đang tải chi nhánh...</p> : 
           branches.length === 0 ? (
            <p>Chưa có chi nhánh nào được tạo.</p>
          ) : (
            <div className="space-y-4">
              {branches.map((branch) => (
                <Card key={branch.id} className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-lg">{branch.name} <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${branch.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{branch.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></CardTitle>
                    {branch.address && <CardDescription>{branch.address}</CardDescription>}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {branch.contactInfo && <p><span className="font-semibold">Liên hệ:</span> {branch.contactInfo}</p>}
                    {branch.workingHours && branch.workingHours.length > 0 && <p><span className="font-semibold">Giờ làm việc riêng:</span> {branch.workingHours.join(', ')}</p>}
                    {branch.numberOfStaff !== undefined && <p><span className="font-semibold">Số nhân viên riêng:</span> {branch.numberOfStaff}</p>}
                    {/* Display specific day overrides if any */}
                  </CardContent>
                  <CardFooter className="border-t pt-4">
                     <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openModal(branch)}><Edit3 className="mr-1 h-3 w-3" /> Sửa</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash className="mr-1 h-3 w-3" /> Xóa</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa chi nhánh "{branch.name}"?</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteBranch(branch.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                     </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl"> {/* Wider modal */}
          <DialogHeader>
            <DialogTitle>{currentBranch ? 'Sửa Chi nhánh' : 'Thêm Chi nhánh Mới'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto p-1 pr-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="branchName">Tên Chi nhánh <span className="text-destructive">*</span></Label><Input id="branchName" value={branchName} onChange={e => setBranchName(e.target.value)} required disabled={isSubmitting}/></div>
                <div><Label htmlFor="branchAddress">Địa chỉ</Label><Input id="branchAddress" value={branchAddress} onChange={e => setBranchAddress(e.target.value)} disabled={isSubmitting}/></div>
            </div>
            <div><Label htmlFor="branchContactInfo">Thông tin liên hệ (SĐT, Email...)</Label><Input id="branchContactInfo" value={branchContactInfo} onChange={e => setBranchContactInfo(e.target.value)} disabled={isSubmitting}/></div>
            <div className="flex items-center space-x-2"><Checkbox id="branchIsActive" checked={branchIsActive} onCheckedChange={checked => setBranchIsActive(!!checked)} disabled={isSubmitting}/><Label htmlFor="branchIsActive">Đang hoạt động</Label></div>
            
            <Separator className="my-3"/>
            <p className="text-sm text-muted-foreground">Để trống các trường cài đặt lịch hẹn bên dưới nếu muốn sử dụng cài đặt chung của toàn hệ thống.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="branchWorkingHours"><ClockIcon className="inline mr-1 h-4 w-4" />Giờ nhận khách riêng (HH:MM, HH:MM)</Label><Input id="branchWorkingHours" value={branchWorkingHours} onChange={e => setBranchWorkingHours(e.target.value)} placeholder="VD: 08:00, 14:00" disabled={isSubmitting}/></div>
                <div><Label htmlFor="branchNumberOfStaff"><StaffIcon className="inline mr-1 h-4 w-4" />Số nhân viên riêng</Label><Input id="branchNumberOfStaff" type="number" min="0" value={branchNumberOfStaff} onChange={e => setBranchNumberOfStaff(e.target.value)} placeholder="VD: 2" disabled={isSubmitting}/></div>
            </div>
            <div>
                <Label><CalendarDays className="inline mr-1 h-4 w-4" />Ngày nghỉ hàng tuần riêng</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-1">
                  {daysOfWeek.map(day => (
                    <div key={`branch-off-${day.id}`} className="flex items-center space-x-2">
                      <Checkbox id={`branchOffDay-${day.id}`} checked={branchOffDays.includes(day.id)} onCheckedChange={(checked) => handleBranchOffDayChange(day.id, !!checked)} disabled={isSubmitting}/>
                      <Label htmlFor={`branchOffDay-${day.id}`} className="font-normal text-sm">{day.label}</Label>
                    </div>
                  ))}
                </div>
            </div>

            <Separator className="my-3"/>
            <div>
                <h4 className="text-md font-semibold mb-2">Quy tắc cho Ngày Cụ thể (Riêng cho chi nhánh này)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-2 border rounded-md mb-3">
                    <Input type="date" value={newSpecificRuleDate} onChange={e => setNewSpecificRuleDate(e.target.value)} className="h-8 text-xs"/>
                    <Input value={newSpecificRuleWorkingHours} onChange={e => setNewSpecificRuleWorkingHours(e.target.value)} placeholder="Giờ làm việc (HH:MM, HH:MM)" className="h-8 text-xs"/>
                    <Input type="number" value={newSpecificRuleStaff} onChange={e => setNewSpecificRuleStaff(e.target.value)} placeholder="Số nhân viên" className="h-8 text-xs"/>
                    <div className="flex items-center space-x-2"><Checkbox id="newSpecificRuleIsOffBranch" checked={newSpecificRuleIsOff} onCheckedChange={(checked) => setNewSpecificRuleIsOff(!!checked)} /><Label htmlFor="newSpecificRuleIsOffBranch" className="text-xs">Ngày nghỉ</Label></div>
                    <Button type="button" onClick={handleAddSpecificRuleForBranch} size="sm" className="h-8 text-xs"><PlusCircle className="mr-1 h-3 w-3"/>Thêm</Button>
                </div>
                {(branchSpecificDayOverrides).map((rule, index) => (
                  <Card key={rule.id || index} className="p-2 mb-2 bg-muted/50 text-xs">
                    <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold">Ngày: {isValidDateFns(parse(rule.date, 'yyyy-MM-dd', new Date())) ? format(parse(rule.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : 'Ngày không hợp lệ'}</p>
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSpecificRuleForBranch(rule.id!)} className="h-5 w-5"><Trash className="h-3 w-3 text-destructive"/></Button>
                    </div>
                    <p>Ngày nghỉ: {rule.isOff ? <span className="text-red-600">Có</span> : 'Không'}</p>
                    {rule.workingHours && rule.workingHours.length > 0 && <p>Giờ làm việc: {rule.workingHours.join(', ')}</p>}
                    {rule.numberOfStaff !== undefined && <p>Số nhân viên: {rule.numberOfStaff}</p>}
                  </Card>
                ))}
            </div>

            <DialogFooter className="sticky bottom-0 bg-background py-4 border-t -mx-1 px-1">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Hủy</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}><Save className="mr-2 h-4 w-4" />{isSubmitting ? 'Đang lưu...' : 'Lưu Chi nhánh'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 