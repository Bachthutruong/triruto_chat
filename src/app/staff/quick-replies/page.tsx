// src/app/staff/quick-replies/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit3, Trash, Zap, Save } from 'lucide-react';
import type { QuickReplyType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getQuickReplies, createQuickReply, updateQuickReply, deleteQuickReply } from '@/app/actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function StaffQuickRepliesPage() {
  const { toast } = useToast();
  const [quickReplies, setQuickReplies] = useState<QuickReplyType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentReply, setCurrentReply] = useState<QuickReplyType | null>(null);
  const [replyTitle, setReplyTitle] = useState('');
  const [replyContent, setReplyContent] = useState('');

  const fetchReplies = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getQuickReplies();
      setQuickReplies(data);
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể tải danh sách câu trả lời nhanh.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  const resetForm = () => {
    setCurrentReply(null);
    setReplyTitle('');
    setReplyContent('');
  };

  const openModal = (reply: QuickReplyType | null = null) => {
    resetForm();
    if (reply) {
      setCurrentReply(reply);
      setReplyTitle(reply.title);
      setReplyContent(reply.content);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (!replyTitle.trim() || !replyContent.trim()) {
        toast({title: "Thiếu thông tin", description: "Vui lòng điền tiêu đề và nội dung câu trả lời.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }

    const data = {
      title: replyTitle,
      content: replyContent,
    };

    try {
      if (currentReply) {
        await updateQuickReply(currentReply.id, data);
        toast({ title: "Thành công", description: "Đã cập nhật câu trả lời nhanh." });
      } else {
        await createQuickReply(data);
        toast({ title: "Thành công", description: "Đã tạo câu trả lời nhanh mới." });
      }
      resetForm();
      setIsModalOpen(false);
      fetchReplies();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Thao tác thất bại.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReply = async (id: string) => {
    try {
      await deleteQuickReply(id);
      toast({ title: "Thành công", description: "Đã xóa câu trả lời nhanh." });
      fetchReplies();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa câu trả lời nhanh.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý Câu trả lời nhanh</h1>
          <p className="text-muted-foreground">Tạo và quản lý các mẫu câu trả lời nhanh cho nhân viên.</p>
        </div>
        <Button onClick={() => openModal()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Thêm Câu trả lời Mới
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Zap className="mr-2 h-5 w-5 text-primary" /> Danh sách Câu trả lời nhanh</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <p>Đang tải...</p> : 
           quickReplies.length === 0 ? (
            <p>Chưa có câu trả lời nhanh nào được tạo.</p>
          ) : (
            <div className="space-y-4">
              {quickReplies.map((reply) => (
                <Card key={reply.id} className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-lg">{reply.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <span className="font-semibold">Nội dung:</span>
                      <p className="mt-1 p-2 bg-background border rounded text-xs whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4">
                     <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openModal(reply)}><Edit3 className="mr-1 h-3 w-3" /> Sửa</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash className="mr-1 h-3 w-3" /> Xóa</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa câu trả lời nhanh "{reply.title}"?</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteReply(reply.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
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
            <DialogTitle>{currentReply ? 'Sửa Câu trả lời nhanh' : 'Thêm Câu trả lời nhanh Mới'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
            <div>
                <Label htmlFor="replyTitle">Tiêu đề (Để nhân viên dễ chọn)</Label>
                <Input id="replyTitle" value={replyTitle} onChange={e => setReplyTitle(e.target.value)} placeholder="VD: Chào buổi sáng, Cảm ơn quý khách" disabled={isSubmitting} required/>
            </div>
            <div>
                <Label htmlFor="replyContent">Nội dung câu trả lời</Label>
                <Textarea id="replyContent" value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder="Nội dung chi tiết của câu trả lời..." rows={5} disabled={isSubmitting} required/>
            </div>
            <DialogFooter className="sticky bottom-0 bg-background py-4 border-t -mx-1 px-1">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Hủy</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}><Save className="mr-2 h-4 w-4" />{isSubmitting ? 'Đang lưu...' : 'Lưu Câu trả lời'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 