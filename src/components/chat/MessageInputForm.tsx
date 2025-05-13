// src/components/chat/MessageInputForm.tsx
'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Paperclip } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type MessageInputFormProps = {
  onSubmit: (messageContent: string) => void;
  isLoading?: boolean;
};

const MAX_FILE_SIZE_MB = 5; // Max file size in MB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function MessageInputForm({ onSubmit, isLoading }: MessageInputFormProps) {
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSubmit(message.trim());
      setMessage('');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
          title: "Tệp quá lớn",
          description: `Kích thước tệp không được vượt quá ${MAX_FILE_SIZE_MB}MB.`,
          variant: "destructive",
        });
        if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          // Prepend file name to data URI for later extraction, if needed
          // This is a simple convention, not a standard part of data URIs
          const fileNameEncoded = encodeURIComponent(file.name);
          const dataUriWithFileName = `${reader.result as string}#filename=${fileNameEncoded}`;
          onSubmit(dataUriWithFileName);
        }
         if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
      };
      reader.onerror = () => {
        toast({
          title: "Lỗi đọc tệp",
          description: "Không thể đọc tệp đã chọn. Vui lòng thử lại.",
          variant: "destructive",
        });
         if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
      };
      reader.readAsDataURL(file);
      setMessage(''); // Clear text input when a file is selected
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t bg-card flex items-center gap-2">
      <Button type="button" variant="ghost" size="icon" onClick={triggerFileInput} disabled={isLoading} aria-label="Đính kèm tệp">
        <Paperclip className="h-5 w-5" />
      </Button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,application/pdf,.doc,.docx,.txt,.xls,.xlsx" // Example accepted types
      />
      <Input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Nhập tin nhắn của bạn..."
        className="flex-grow"
        disabled={isLoading}
        autoComplete="off"
      />
      <Button type="submit" size="icon" disabled={isLoading || (!message.trim())}>
        <Send className="h-5 w-5" />
        <span className="sr-only">Gửi tin nhắn</span>
      </Button>
    </form>
  );
}
