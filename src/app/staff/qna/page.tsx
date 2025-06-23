// src/app/admin/qna/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit3, Trash, MessageCircle, CheckCircle, AlertTriangle, Save } from 'lucide-react';
import type { KeywordMapping, TrainingData, AppSettings, TrainingDataStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  getAppSettings, updateAppSettings,
  getKeywordMappings, createKeywordMapping, updateKeywordMapping, deleteKeywordMapping,
  getTrainingDataItems, createTrainingData, updateTrainingDataItem, deleteTrainingDataItem
} from '@/app/actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminQnaPage() {
  const { toast } = useToast();

  // App Settings (Greeting & Suggested Questions)
  const [greeting, setGreeting] = useState('');
  const [suggestedQuestionsInput, setSuggestedQuestionsInput] = useState(''); // Comma-separated string
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);

  // Keyword Mappings
  const [keywords, setKeywords] = useState<KeywordMapping[]>([]);
  const [isKeywordsLoading, setIsKeywordsLoading] = useState(false);
  const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false);
  const [currentKeywordMapping, setCurrentKeywordMapping] = useState<KeywordMapping | null>(null);
  const [kwInput, setKwInput] = useState(''); // Comma-separated
  const [kwResponse, setKwResponse] = useState('');

  // Training Data
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);
  const [isTrainingDataLoading, setIsTrainingDataLoading] = useState(false);
  const [isTrainingDataModalOpen, setIsTrainingDataModalOpen] = useState(false);
  const [currentTrainingItem, setCurrentTrainingItem] = useState<TrainingData | null>(null);
  const [tdUserInput, setTdUserInput] = useState('');
  const [tdIdealResponse, setTdIdealResponse] = useState('');
  const [tdLabel, setTdLabel] = useState('');
  const [tdStatus, setTdStatus] = useState<TrainingDataStatus>('pending_review');

  const [isSubmitting, setIsSubmitting] = useState(false);


  // Fetch App Settings
  const fetchSettings = useCallback(async () => {
    setIsSettingsLoading(true);
    try {
      const settings = await getAppSettings();
      if (settings) {
        setGreeting(settings.greetingMessage || '');
        setSuggestedQuestionsInput((settings.suggestedQuestions || []).join(', '));
      }
    } catch (error) {
      toast({ title: "Lỗi tải cài đặt", description: "Không thể tải cài đặt lời chào.", variant: "destructive" });
    } finally {
      setIsSettingsLoading(false);
    }
  }, [toast]);

  // Fetch Keyword Mappings
  const fetchKeywordMappings = useCallback(async () => {
    setIsKeywordsLoading(true);
    try {
      const data = await getKeywordMappings();
      setKeywords(data);
    } catch (error) {
      toast({ title: "Lỗi tải từ khóa", description: "Không thể tải danh sách từ khóa.", variant: "destructive" });
    } finally {
      setIsKeywordsLoading(false);
    }
  }, [toast]);

  // Fetch Training Data
  const fetchTrainingData = useCallback(async () => {
    setIsTrainingDataLoading(true);
    try {
      const data = await getTrainingDataItems();
      setTrainingData(data);
    } catch (error) {
      toast({ title: "Lỗi tải dữ liệu huấn luyện", description: "Không thể tải dữ liệu huấn luyện AI.", variant: "destructive" });
    } finally {
      setIsTrainingDataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
    fetchKeywordMappings();
    fetchTrainingData();
  }, [fetchSettings, fetchKeywordMappings, fetchTrainingData]);

  // --- App Settings Handlers ---
  const handleSaveGreetingSettings = async () => {
    setIsSubmitting(true);
    try {
      await updateAppSettings({
        greetingMessage: greeting,
        suggestedQuestions: suggestedQuestionsInput.split(',').map(s => s.trim()).filter(Boolean),
      });
      toast({ title: "Thành công", description: "Đã lưu cài đặt lời chào và gợi ý." });
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể lưu cài đặt.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Keyword Mapping Handlers ---
  const openKeywordModal = (kwm: KeywordMapping | null = null) => {
    setCurrentKeywordMapping(kwm);
    setKwInput(kwm ? kwm.keywords.join(', ') : '');
    setKwResponse(kwm ? kwm.response : '');
    setIsKeywordModalOpen(true);
  };

  const handleSaveKeywordMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const keywordsArray = kwInput.split(',').map(s => s.trim()).filter(Boolean);
    if (keywordsArray.length === 0 || !kwResponse.trim()) {
        toast({title: "Thiếu thông tin", description: "Vui lòng nhập từ khóa và phản hồi.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }
    try {
      if (currentKeywordMapping) {
        await updateKeywordMapping(currentKeywordMapping.id, { keywords: keywordsArray, response: kwResponse });
        toast({ title: "Thành công", description: "Đã cập nhật từ khóa." });
      } else {
        await createKeywordMapping({ keywords: keywordsArray, response: kwResponse });
        toast({ title: "Thành công", description: "Đã thêm từ khóa mới." });
      }
      setIsKeywordModalOpen(false);
      fetchKeywordMappings();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể lưu từ khóa.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteKeywordMapping = async (id: string) => {
    try {
      await deleteKeywordMapping(id);
      toast({ title: "Thành công", description: "Đã xóa từ khóa." });
      fetchKeywordMappings();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa từ khóa.", variant: "destructive" });
    }
  };

  // --- Training Data Handlers ---
  const openTrainingDataModal = (tdi: TrainingData | null = null) => {
    setCurrentTrainingItem(tdi);
    setTdUserInput(tdi ? tdi.userInput : '');
    setTdIdealResponse(tdi ? tdi.idealResponse || '' : '');
    setTdLabel(tdi ? tdi.label : '');
    setTdStatus(tdi ? tdi.status : 'pending_review');
    setIsTrainingDataModalOpen(true);
  };

  const handleSaveTrainingData = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (!tdUserInput.trim() || !tdLabel.trim()) {
        toast({title: "Thiếu thông tin", description: "Vui lòng nhập nội dung người dùng và nhãn.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }
    const dataToSave = { userInput: tdUserInput, idealResponse: tdIdealResponse, label: tdLabel, status: tdStatus };
    try {
      if (currentTrainingItem) {
        await updateTrainingDataItem(currentTrainingItem.id, dataToSave);
        toast({ title: "Thành công", description: "Đã cập nhật dữ liệu huấn luyện." });
      } else {
        await createTrainingData(dataToSave);
        toast({ title: "Thành công", description: "Đã thêm dữ liệu huấn luyện mới." });
      }
      setIsTrainingDataModalOpen(false);
      fetchTrainingData();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể lưu dữ liệu huấn luyện.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrainingData = async (id: string) => {
    try {
      await deleteTrainingDataItem(id);
      toast({ title: "Thành công", description: "Đã xóa dữ liệu huấn luyện." });
      fetchTrainingData();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa dữ liệu huấn luyện.", variant: "destructive" });
    }
  };

  const getStatusLabel = (status: TrainingDataStatus) => {
    if (status === 'approved') return 'Đã duyệt';
    if (status === 'pending_review') return 'Chờ duyệt';
    if (status === 'rejected') return 'Từ chối';
    return status;
  };


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Hỏi & Đáp và Huấn luyện AI</h1>
      <p className="text-muted-foreground">Quản lý phản hồi tự động và huấn luyện mô hình AI.</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><MessageCircle className="mr-2 h-5 w-5 text-primary" /> Lời chào & Câu hỏi Gợi ý</CardTitle>
          <CardDescription>Cấu hình lời chào mặc định và các câu hỏi gợi ý ban đầu cho khách hàng.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="greeting">Lời chào mừng</Label>
            <Textarea id="greeting" value={greeting} onChange={(e) => setGreeting(e.target.value)} disabled={isSettingsLoading || isSubmitting} />
          </div>
          <div>
            <Label htmlFor="suggestedQuestions">Câu hỏi gợi ý (cách nhau bằng dấu phẩy)</Label>
            <Input 
              id="suggestedQuestions"
              value={suggestedQuestionsInput} 
              onChange={(e) => setSuggestedQuestionsInput(e.target.value)} 
              placeholder="ví dụ: Dịch vụ, Đặt lịch hẹn"
              disabled={isSettingsLoading || isSubmitting}
            />
          </div>
          <Button onClick={handleSaveGreetingSettings} disabled={isSettingsLoading || isSubmitting}>
            <Save className="mr-2 h-4 w-4" /> {isSubmitting ? 'Đang lưu...' : 'Lưu Lời chào & Gợi ý'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phản hồi theo Từ khóa</CardTitle>
          <CardDescription>Xác định phản hồi cho các từ khóa cụ thể. AI sẽ ưu tiên các phản hồi này nếu khớp.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="mb-4" onClick={() => openKeywordModal()} disabled={isKeywordsLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Thêm Phản hồi Từ khóa
          </Button>
          {isKeywordsLoading ? <p>Đang tải...</p> : keywords.length === 0 ? <p>Chưa có từ khóa nào.</p> : (
            <div className="space-y-2">
              {keywords.map(kw => (
                <div key={kw.id} className="p-3 border rounded-md bg-muted/30">
                  <p className="font-semibold">Từ khóa: <span className="font-normal text-sm">{kw.keywords.join(', ')}</span></p>
                  <p className="font-semibold mt-1">Phản hồi: <span className="font-normal text-sm">{kw.response}</span></p>
                  <div className="mt-2 space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openKeywordModal(kw)}><Edit3 className="mr-1 h-3 w-3" /> Sửa</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash className="mr-1 h-3 w-3" /> Xóa</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa phản hồi từ khóa này?</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteKeywordMapping(kw.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-primary" /> Dữ liệu Huấn luyện AI</CardTitle>
          <CardDescription>Xem lại các câu hỏi của người dùng và gán nhãn hoặc sửa câu trả lời để huấn luyện AI. Các câu hỏi không khớp từ khóa sẽ được AI trả lời và có thể được lưu ở đây để xem xét.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="mb-4" onClick={() => openTrainingDataModal()} disabled={isTrainingDataLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Thêm Dữ liệu Huấn luyện
          </Button>
          {isTrainingDataLoading ? <p>Đang tải...</p> : trainingData.length === 0 ? <p>Chưa có dữ liệu huấn luyện.</p> : (
            <div className="space-y-2">
              {trainingData.map(td => (
                <div key={td.id} className="p-3 border rounded-md bg-muted/30">
                  <p><span className="font-semibold">Người dùng nhập:</span> {td.userInput}</p>
                  {td.idealResponse && <p><span className="font-semibold">Phản hồi lý tưởng:</span> {td.idealResponse}</p>}
                  <p><span className="font-semibold">Nhãn:</span> {td.label}</p>
                  <p><span className="font-semibold">Trạng thái:</span> 
                    <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                      td.status === 'approved' ? 'bg-green-100 text-green-700' :
                      td.status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'}`}>
                      {getStatusLabel(td.status)}
                    </span>
                  </p>
                  <div className="mt-2 space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openTrainingDataModal(td)}><Edit3 className="mr-1 h-3 w-3" /> Xem lại/Sửa</Button>
                     <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash className="mr-1 h-3 w-3" /> Xóa</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa dữ liệu huấn luyện này?</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTrainingData(td.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keyword Mapping Modal */}
      <Dialog open={isKeywordModalOpen} onOpenChange={setIsKeywordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentKeywordMapping ? 'Sửa Phản hồi Từ khóa' : 'Thêm Phản hồi Từ khóa Mới'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveKeywordMapping} className="space-y-4">
            <div>
              <Label htmlFor="kwInput">Từ khóa (cách nhau bằng dấu phẩy)</Label>
              <Input id="kwInput" value={kwInput} onChange={(e) => setKwInput(e.target.value)} placeholder="ví dụ: giờ mở cửa, thời gian làm việc" disabled={isSubmitting} />
            </div>
            <div>
              <Label htmlFor="kwResponse">Phản hồi</Label>
              <Textarea id="kwResponse" value={kwResponse} onChange={(e) => setKwResponse(e.target.value)} placeholder="Nội dung phản hồi cho các từ khóa này" disabled={isSubmitting} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Hủy</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu...' : 'Lưu'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Training Data Modal */}
      <Dialog open={isTrainingDataModalOpen} onOpenChange={setIsTrainingDataModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentTrainingItem ? 'Sửa Dữ liệu Huấn luyện' : 'Thêm Dữ liệu Huấn luyện Mới'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTrainingData} className="space-y-4">
            <div>
              <Label htmlFor="tdUserInput">Câu hỏi/Nội dung từ người dùng</Label>
              <Textarea id="tdUserInput" value={tdUserInput} onChange={(e) => setTdUserInput(e.target.value)} placeholder="Ví dụ: Giá cắt tóc là bao nhiêu?" disabled={isSubmitting} />
            </div>
            <div>
              <Label htmlFor="tdIdealResponse">Phản hồi lý tưởng (nếu có)</Label>
              <Textarea id="tdIdealResponse" value={tdIdealResponse} onChange={(e) => setTdIdealResponse(e.target.value)} placeholder="Phản hồi mẫu chính xác cho câu hỏi này" disabled={isSubmitting} />
            </div>
            <div>
              <Label htmlFor="tdLabel">Nhãn</Label>
              <Input id="tdLabel" value={tdLabel} onChange={(e) => setTdLabel(e.target.value)} placeholder="Ví dụ: Hỏi giá, Khiếu nại" disabled={isSubmitting} />
            </div>
            <div>
              <Label htmlFor="tdStatus">Trạng thái</Label>
              <Select value={tdStatus} onValueChange={(val) => setTdStatus(val as TrainingDataStatus)} disabled={isSubmitting}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_review">Chờ duyệt</SelectItem>
                  <SelectItem value="approved">Đã duyệt</SelectItem>
                  <SelectItem value="rejected">Từ chối</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Hủy</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu...' : 'Lưu'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}