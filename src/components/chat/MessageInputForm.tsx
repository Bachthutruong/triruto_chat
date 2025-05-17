
// src/components/chat/MessageInputForm.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import NextImage from 'next/image'; // Renamed to avoid conflict
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea'; // Changed Input to Textarea
import { Send, Paperclip, X, FileText, Smile, CalendarPlus } from 'lucide-react'; 
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'; 

type MessageInputFormProps = {
  onSubmit: (messageContent: string) => void;
  isLoading?: boolean;
  onBookAppointmentClick?: () => void; // New prop
};

const MAX_FILE_SIZE_MB = 5; 
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const commonEmojis = ['😀', '😂', '😍', '😊', '👍', '🙏', '❤️', '🎉'];

export function MessageInputForm({ onSubmit, isLoading, onBookAppointmentClick }: MessageInputFormProps) {
  const [message, setMessage] = useState('');
  const [stagedFile, setStagedFile] = useState<{ dataUri: string; name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let contentToSend = message.trim();

    if (stagedFile) {
      const fileNameEncoded = encodeURIComponent(stagedFile.name);
      const dataUriWithFileName = `${stagedFile.dataUri}#filename=${fileNameEncoded}`;
      contentToSend = dataUriWithFileName + (contentToSend ? `\n${contentToSend}` : '');
    }

    if (contentToSend) {
      onSubmit(contentToSend);
      setMessage('');
      setStagedFile(null);
      if (textareaRef.current) { // Reset height after sending
        textareaRef.current.style.height = 'auto';
      }
    } else if (stagedFile && !contentToSend) { 
       const fileNameEncoded = encodeURIComponent(stagedFile.name);
       const dataUriWithFileName = `${stagedFile.dataUri}#filename=${fileNameEncoded}`;
       onSubmit(dataUriWithFileName);
       setMessage('');
       setStagedFile(null);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
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
        if(fileInputRef.current) fileInputRef.current.value = ""; 
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
         if(fileInputRef.current) fileInputRef.current.value = ""; 
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

  const handleEmojiClick = (emoji: string) => {
    setMessage(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any); // Pass the event, even if casted
    }
  };

  return (
    <>
      {stagedFile && (
        <div className="p-2 border-t flex items-center justify-between bg-muted/50 text-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            {stagedFile.type.startsWith('image/') ? (
              <NextImage 
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
      <form onSubmit={handleSubmit} className="p-2 border-t bg-card flex items-end gap-2"> {/* items-end for textarea grow */}
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
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" disabled={isLoading} aria-label="Chọn emoji">
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="flex gap-1">
              {commonEmojis.map(emoji => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="icon"
                  className="text-xl p-1 h-8 w-8"
                  onClick={() => handleEmojiClick(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
         {onBookAppointmentClick && (
          <Button type="button" variant="ghost" size="icon" onClick={onBookAppointmentClick} disabled={isLoading} aria-label="Đặt lịch hẹn">
            <CalendarPlus className="h-5 w-5" />
          </Button>
        )}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn của bạn..."
          className="flex-grow resize-none overflow-y-hidden min-h-[40px] max-h-[120px] leading-tight py-2" // Adjust padding/height
          rows={1}
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

    