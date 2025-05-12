'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit3, Trash, MessageCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import type { KeywordMapping, TrainingData } from '@/lib/types';

// Dữ liệu mẫu bằng tiếng Việt
const mockKeywords: KeywordMapping[] = [
  { id: 'kw1', keywords: ['giờ mở cửa', 'mấy giờ mở cửa'], response: 'Chúng tôi mở cửa từ 9 giờ sáng đến 6 giờ tối hàng ngày.', createdAt: new Date(), updatedAt: new Date() },
  { id: 'kw2', keywords: ['địa chỉ', 'ở đâu'], response: 'Bạn có thể tìm chúng tôi tại 123 Đường Chính.', createdAt: new Date(), updatedAt: new Date() },
];

const mockTrainingData: TrainingData[] = [
  { id: 'td1', userInput: 'Cắt tóc giá bao nhiêu?', idealResponse: 'Một lần cắt tóc tiêu chuẩn là 500.000đ.', label: 'Hỏi Dịch vụ', status: 'approved', createdAt: new Date() },
  { id: 'td2', userInput: 'Lịch hẹn của tôi sai rồi', idealResponse: '', label: 'Cần Hỗ trợ', status: 'pending_review', createdAt: new Date() },
];


export default function AdminQnaPage() {
  const [greeting, setGreeting] = useState('Chào mừng đến với AetherChat! Tôi có thể giúp gì cho bạn?');
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(['Dịch vụ của bạn là gì?', 'Làm thế nào để đặt lịch hẹn?']);
  const [keywords, setKeywords] = useState<KeywordMapping[]>(mockKeywords);
  const [trainingData, setTrainingData] = useState<TrainingData[]>(mockTrainingData);

  // TODO: Add state and handlers for editing/adding keywords and training data

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Hỏi & Đáp và Huấn luyện AI</h1>
      <p className="text-muted-foreground">Quản lý phản hồi tự động và huấn luyện mô hình AI.</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><MessageCircle className="mr-2 h-5 w-5 text-primary" /> Phản hồi Tự động</CardTitle>
          <CardDescription>Cấu hình lời chào, câu hỏi gợi ý, và các câu trả lời dựa trên từ khóa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="greeting">Lời chào mừng</Label>
            <Textarea id="greeting" value={greeting} onChange={(e) => setGreeting(e.target.value)} />
          </div>
          <div>
            <Label>Câu hỏi gợi ý (cách nhau bằng dấu phẩy)</Label>
            <Input 
              value={suggestedQuestions.join(', ')} 
              onChange={(e) => setSuggestedQuestions(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} 
              placeholder="ví dụ: Dịch vụ, Đặt lịch hẹn"
            />
          </div>
          <Button>Lưu Lời chào & Gợi ý</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phản hồi theo Từ khóa</CardTitle>
          <CardDescription>Xác định phản hồi cho các từ khóa cụ thể.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="mb-4"><PlusCircle className="mr-2 h-4 w-4" /> Thêm Phản hồi Từ khóa</Button>
          <div className="space-y-2">
            {keywords.map(kw => (
              <div key={kw.id} className="p-3 border rounded-md bg-muted/50">
                <p className="font-semibold">Từ khóa: <span className="font-normal text-sm">{kw.keywords.join(', ')}</span></p>
                <p className="font-semibold">Phản hồi: <span className="font-normal text-sm">{kw.response}</span></p>
                <div className="mt-2 space-x-2">
                  <Button variant="outline" size="sm"><Edit3 className="mr-1 h-3 w-3" /> Sửa</Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash className="mr-1 h-3 w-3" /> Xóa</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-primary" /> Dữ liệu Huấn luyện AI</CardTitle>
          <CardDescription>Xem lại các câu hỏi của người dùng và gán nhãn hoặc sửa câu trả lời để huấn luyện AI.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="mb-4"><PlusCircle className="mr-2 h-4 w-4" /> Thêm Dữ liệu Huấn luyện</Button>
          <div className="space-y-2">
            {trainingData.map(td => (
              <div key={td.id} className="p-3 border rounded-md bg-muted/50">
                <p><span className="font-semibold">Người dùng nhập:</span> {td.userInput}</p>
                {td.idealResponse && <p><span className="font-semibold">Phản hồi lý tưởng:</span> {td.idealResponse}</p>}
                <p><span className="font-semibold">Nhãn:</span> {td.label}</p>
                <p><span className="font-semibold">Trạng thái:</span> 
                  <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                    td.status === 'approved' ? 'bg-green-100 text-green-700' :
                    td.status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'}`}>
                    {td.status === 'approved' ? 'Đã duyệt' : td.status === 'pending_review' ? 'Chờ duyệt' : 'Từ chối'}
                  </span>
                </p>
                <div className="mt-2 space-x-2">
                  <Button variant="outline" size="sm"><Edit3 className="mr-1 h-3 w-3" /> Xem lại/Sửa</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

