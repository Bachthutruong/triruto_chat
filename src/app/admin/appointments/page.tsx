'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit3, Trash, CalendarCog } from 'lucide-react';

type AppointmentRule = {
  id: string;
  name: string;
  keywords: string[];
  conditions: string; 
  aiPromptInstructions: string; 
};

// Dữ liệu mẫu bằng tiếng Việt
const mockRules: AppointmentRule[] = [
  { id: 'rule1', name: 'Quy tắc cắt tóc buổi tối', keywords: ['cắt tóc tối', 'tóc buổi tối'], conditions: 'dich_vu:Cắt tóc, thoi_gian:[5PM-8PM]', aiPromptInstructions: 'Ưu tiên Chi nhánh Chính cho cắt tóc buổi tối. Nếu hết chỗ, gợi ý Chi nhánh Phụ.' },
  { id: 'rule2', name: 'Ưu đãi massage cuối tuần', keywords: ['massage cuối tuần', 'mát xa cuối tuần'], conditions: 'dich_vu:Massage, ngay:[Thứ 7,Chủ nhật]', aiPromptInstructions: 'Nhắc đến giảm giá 10% cho massage cuối tuần.' },
];

export default function AdminAppointmentRulesPage() {
  const [rules, setRules] = useState<AppointmentRule[]>(mockRules);
  // TODO: Add state and handlers for editing/adding rules

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quy tắc Đặt lịch AI</h1>
          <p className="text-muted-foreground">Cấu hình quy tắc để hướng dẫn AI đặt lịch hẹn.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Thêm Quy tắc Mới
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarCog className="mr-2 h-5 w-5 text-primary" /> Quy tắc Hiện tại</CardTitle>
          <CardDescription>Các quy tắc này giúp AI hiểu các yêu cầu đặt lịch phức tạp và gợi ý các khung giờ phù hợp.</CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
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
                      <p className="mt-1 p-2 bg-background border rounded text-xs">{rule.aiPromptInstructions}</p>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4">
                     <div className="flex gap-2">
                        <Button variant="outline" size="sm"><Edit3 className="mr-1 h-3 w-3" /> Sửa</Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash className="mr-1 h-3 w-3" /> Xóa</Button>
                     </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
            <CardTitle>Thêm/Sửa Quy tắc</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <Label htmlFor="ruleName">Tên Quy tắc</Label>
                <Input id="ruleName" placeholder="ví dụ: Ưu tiên đặt lịch VIP buổi sáng"/>
            </div>
            <div>
                <Label htmlFor="ruleKeywords">Từ khóa (cách nhau bằng dấu phẩy)</Label>
                <Input id="ruleKeywords" placeholder="ví dụ: đặt lịch vip, ưu tiên sáng"/>
            </div>
            <div>
                <Label htmlFor="ruleConditions">Điều kiện (ví dụ: key:value, key:[val1,val2])</Label>
                <Input id="ruleConditions" placeholder="ví dụ: tag_khach:VIP, dich_vu:Chăm sóc da mặt"/>
            </div>
            <div>
                <Label htmlFor="ruleAiInstructions">Hướng dẫn cho AI</Label>
                <Textarea id="ruleAiInstructions" placeholder="Hướng dẫn chi tiết cho AI khi quy tắc này khớp..."/>
            </div>
            <Button>Lưu Quy tắc</Button>
        </CardContent>
      </Card>

    </div>
  );
}

