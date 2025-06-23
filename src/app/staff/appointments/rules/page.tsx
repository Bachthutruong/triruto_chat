// src/app/admin/appointments/rules/page.tsx (Appointment Rules)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit3, Trash, CalendarCog, Save } from 'lucide-react';
import type { AppointmentRule } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getAppointmentRules, createAppointmentRule, updateAppointmentRule, deleteAppointmentRule } from '@/app/actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function AdminAppointmentRulesPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<AppointmentRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<AppointmentRule | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleKeywords, setRuleKeywords] = useState(''); // Comma-separated
  const [ruleConditions, setRuleConditions] = useState('');
  const [ruleAiInstructions, setRuleAiInstructions] = useState('');

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAppointmentRules();
      setRules(data);
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể tải quy tắc đặt lịch.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const resetForm = () => {
    setCurrentRule(null);
    setRuleName('');
    setRuleKeywords('');
    setRuleConditions('');
    setRuleAiInstructions('');
  };

  const openModal = (rule: AppointmentRule | null = null) => {
    resetForm();
    if (rule) {
      setCurrentRule(rule);
      setRuleName(rule.name);
      setRuleKeywords(rule.keywords.join(', '));
      setRuleConditions(rule.conditions);
      setRuleAiInstructions(rule.aiPromptInstructions);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const keywordsArray = ruleKeywords.split(',').map(s => s.trim()).filter(Boolean);
    if (!ruleName.trim() || keywordsArray.length === 0 || !ruleConditions.trim() || !ruleAiInstructions.trim()) {
        toast({title: "Thiếu thông tin", description: "Vui lòng điền tất cả các trường: Tên Quy tắc, Từ khóa, Điều kiện, Hướng dẫn cho AI.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }

    const data = {
      name: ruleName,
      keywords: keywordsArray,
      conditions: ruleConditions,
      aiPromptInstructions: ruleAiInstructions,
    };

    try {
      if (currentRule) {
        await updateAppointmentRule(currentRule.id, data);
        toast({ title: "Thành công", description: "Đã cập nhật quy tắc." });
      } else {
        await createAppointmentRule(data);
        toast({ title: "Thành công", description: "Đã tạo quy tắc mới." });
      }
      resetForm();
      setIsModalOpen(false);
      fetchRules();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Thao tác thất bại.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteAppointmentRule(id);
      toast({ title: "Thành công", description: "Đã xóa quy tắc." });
      fetchRules();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa quy tắc.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quy tắc Đặt lịch AI</h1>
          <p className="text-muted-foreground">Cấu hình quy tắc để hướng dẫn AI đặt lịch hẹn.</p>
        </div>
        <Button onClick={() => openModal()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Thêm Quy tắc Mới
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarCog className="mr-2 h-5 w-5 text-primary" /> Quy tắc Hiện tại</CardTitle>
          <CardDescription>Các quy tắc này giúp AI hiểu các yêu cầu đặt lịch phức tạp và gợi ý các khung giờ phù hợp.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <p>Đang tải quy tắc...</p> : 
           rules.length === 0 ? (
            <p>Chưa có quy tắc đặt lịch nào được cấu hình.</p>
          ) : (
            <div className="space-y-4">
              {rules.map((rule) => (
                <Card key={rule.id} className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><span className="font-semibold">Từ khóa:</span> {rule.keywords.join(', ')}</p>
                    <p><span className="font-semibold">Điều kiện:</span> {rule.conditions}</p>
                    <div>
                      <span className="font-semibold">Hướng dẫn cho AI:</span>
                      <p className="mt-1 p-2 bg-background border rounded text-xs whitespace-pre-wrap">{rule.aiPromptInstructions}</p>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4">
                     <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openModal(rule)}><Edit3 className="mr-1 h-3 w-3" /> Sửa</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash className="mr-1 h-3 w-3" /> Xóa</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa quy tắc "{rule.name}"?</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteRule(rule.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentRule ? 'Sửa Quy tắc Đặt lịch' : 'Thêm Quy tắc Đặt lịch Mới'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
            <div>
                <Label htmlFor="ruleName">Tên Quy tắc</Label>
                <Input id="ruleName" value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="ví dụ: Ưu tiên đặt lịch VIP buổi sáng" disabled={isSubmitting} required/>
            </div>
            <div>
                <Label htmlFor="ruleKeywords">Từ khóa (cách nhau bằng dấu phẩy)</Label>
                <Input id="ruleKeywords" value={ruleKeywords} onChange={e => setRuleKeywords(e.target.value)} placeholder="ví dụ: đặt lịch vip, ưu tiên sáng" disabled={isSubmitting} required/>
            </div>
            <div>
                <Label htmlFor="ruleConditions">Điều kiện</Label>
                <Input id="ruleConditions" value={ruleConditions} onChange={e => setRuleConditions(e.target.value)} placeholder="ví dụ: tag_khach:VIP, dich_vu:Chăm sóc da" disabled={isSubmitting} required/>
                <p className="text-xs text-muted-foreground mt-1">Ví dụ: `service:Cắt tóc, time_range:[5PM-8PM]`, `package:VIP`</p>
            </div>
            <div>
                <Label htmlFor="ruleAiInstructions">Hướng dẫn cho AI</Label>
                <Textarea id="ruleAiInstructions" value={ruleAiInstructions} onChange={e => setRuleAiInstructions(e.target.value)} placeholder="Hướng dẫn chi tiết cho AI khi quy tắc này khớp..." rows={5} disabled={isSubmitting} required/>
            </div>
            <DialogFooter className="sticky bottom-0 bg-background py-4 border-t -mx-1 px-1">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Hủy</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}><Save className="mr-2 h-4 w-4" />{isSubmitting ? 'Đang lưu...' : 'Lưu Quy tắc'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
