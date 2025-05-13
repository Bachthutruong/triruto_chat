// src/components/chat/MessageInputForm.tsx
'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Paperclip, X, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type MessageInputFormProps = {
  onSubmit: (messageContent: string) => void;
  isLoading?: boolean;
};

const MAX_FILE_SIZE_MB = 5; // Max file size in MB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function MessageInputForm({ onSubmit, isLoading }: MessageInputFormProps) {
  const [message, setMessage] = useState('');
  const [stagedFile, setStagedFile] = useState<{ dataUri: string; name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let contentToSend = message.trim();

    if (stagedFile) {
      const fileNameEncoded = encodeURIComponent(stagedFile.name);
      const dataUriWithFileName = `${stagedFile.dataUri}#filename=${fileNameEncoded}`;
      // Prepend file URI, then add text message if it exists
      contentToSend = dataUriWithFileName + (contentToSend ? `\n${contentToSend}` : '');
    }

    if (contentToSend) {
      onSubmit(contentToSend);
      setMessage('');
      setStagedFile(null);
    } else if (stagedFile && !contentToSend) { // Case where only file is staged and message is empty
       const fileNameEncoded = encodeURIComponent(stagedFile.name);
       const dataUriWithFileName = `${stagedFile.dataUri}#filename=${fileNameEncoded}`;
       onSubmit(dataUriWithFileName);
       setMessage('');
       setStagedFile(null);
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
          setStagedFile({
            dataUri: reader.result as string,
            name: file.name,
            type: file.type,
          });
        }
         if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
      };
      reader.onerror = () => {
        toast({
          title: "Lỗi đọc tệp",
          description: "Không thể đọc tệp đã chọn. Vui lòng thử lại.",
          variant: "destructive",
        });
         if(fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeStagedFile = () => {
    setStagedFile(null);
  };

  return (
    <>
      {stagedFile && (
        <div className="p-2 border-t flex items-center justify-between bg-muted/50 text-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            {stagedFile.type.startsWith('image/') ? (
              <Image 
                src={stagedFile.dataUri} 
                alt={stagedFile.name} 
                width={24} 
                height={24} 
                className="rounded object-cover flex-shrink-0" 
                data-ai-hint="file preview"
              />
            ) : (
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            )}
            <span className="truncate" title={stagedFile.name}>{stagedFile.name}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={removeStagedFile} aria-label="Bỏ chọn tệp">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-card flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={triggerFileInput} disabled={isLoading} aria-label="Đính kèm tệp">
          <Paperclip className="h-5 w-5" />
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.txt,.xls,.xlsx"
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
        <Button type="submit" size="icon" disabled={isLoading || (!message.trim() && !stagedFile)}>
          <Send className="h-5 w-5" />
          <span className="sr-only">Gửi tin nhắn</span>
        </Button>
      </form>
    </>
  );
}
