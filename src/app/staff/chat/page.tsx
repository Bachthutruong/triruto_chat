// src/app/staff/chat/page.tsx
'use client';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquarePlus } from 'lucide-react';

// This page now renders the placeholder content when no specific customer is selected.
// The actual customer list and chat details are handled by the layout and [customerId] page.
export default function StaffChatPlaceholderPage() {
  return (
    <Card className="flex h-full flex-col items-center justify-center bg-muted/30">
      <CardContent className="text-center">
        <MessageSquarePlus className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Chọn một cuộc trò chuyện</h2>
        <p className="text-muted-foreground">Chọn một khách hàng từ danh sách để bắt đầu hoặc tiếp tục cuộc trò chuyện.</p>
      </CardContent>
    </Card>
  );
}