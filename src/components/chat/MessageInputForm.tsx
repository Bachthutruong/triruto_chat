
// src/components/chat/MessageInputForm.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import NextImage from 'next/image'; 
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea'; 
import { Send, Paperclip, X, FileText, Smile, CalendarPlus, Zap } from 'lucide-react'; // Added Zap
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area'; // Added for QuickReply list
import type { QuickReplyType } from '@/lib/types'; // Added for QuickReply list

type MessageInputFormProps = {
  onSubmit: (messageContent: string) => void;
  isLoading?: boolean;
  onBookAppointmentClick?: () => void; 
  quickReplies?: QuickReplyType[]; // Added for QuickReply list
  onTyping?: (isTyping: boolean) => void; // For typing indicator
};

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const commonEmojis = ['😀', '😂', '😍', '😊', '👍', '🙏', '❤️', '🎉'];

export function MessageInputForm({ 
    onSubmit, 
    isLoading, 
    onBookAppointmentClick, 
    quickReplies = [],
    onTyping
}: MessageInputFormProps) {
  const [message, setMessage] = useState('');
  const [stagedFile, setStagedFile] = useState<{ dataUri: string; name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const typingDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; 
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
      if (textareaRef.current) { 
        textareaRef.current.style.height = 'auto';
      }
      if (onTyping) onTyping(false); // Stop typing on send
      if (typingDebounceTimeoutRef.current) clearTimeout(typingDebounceTimeoutRef.current);

    } else if (stagedFile && !contentToSend) {
      const fileNameEncoded = encodeURIComponent(stagedFile.name);
      const dataUriWithFileName = `${stagedFile.dataUri}#filename=${fileNameEncoded}`;
      onSubmit(dataUriWithFileName);
      setMessage('');
      setStagedFile(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      if (onTyping) onTyping(false); // Stop typing on send
      if (typingDebounceTimeoutRef.current) clearTimeout(typingDebounceTimeoutRef.current);
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
        if (fileInputRef.current) fileInputRef.current.value = "";
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
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.onerror = () => {
        toast({
          title: "Lỗi đọc tệp",
          description: "Không thể đọc tệp đã chọn. Vui lòng thử lại.",
          variant: "destructive",
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
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

  const handleQuickReplySelect = (content: string) => {
    setMessage(prevMessage => prevMessage ? `${prevMessage} ${content}` : content);
    textareaRef.current?.focus();
    if (onTyping) onTyping(true); // Indicate typing after inserting quick reply
    if (typingDebounceTimeoutRef.current) clearTimeout(typingDebounceTimeoutRef.current);
    typingDebounceTimeoutRef.current = setTimeout(() => {
        if (onTyping) onTyping(false);
    }, 1500);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    if (onTyping) {
        onTyping(true);
        if (typingDebounceTimeoutRef.current) clearTimeout(typingDebounceTimeoutRef.current);
        typingDebounceTimeoutRef.current = setTimeout(() => {
            if (onTyping) onTyping(false);
        }, 1500); // 1.5 seconds delay before emitting stop typing
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any); 
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
      <form onSubmit={handleSubmit} className="p-2 border-t bg-card flex items-end gap-1"> 
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
        {quickReplies.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" disabled={isLoading} aria-label="Câu trả lời nhanh">
                <Zap className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0">
                <div className="p-2 text-sm font-medium border-b">Chọn câu trả lời nhanh</div>
                <ScrollArea className="max-h-60">
                    {quickReplies.map(reply => (
                        <Button 
                            key={reply.id} 
                            variant="ghost" 
                            className="w-full justify-start text-left h-auto py-2 px-3 text-sm"
                            onClick={() => handleQuickReplySelect(reply.content)}
                        >
                            {reply.title}
                        </Button>
                    ))}
                </ScrollArea>
            </PopoverContent>
          </Popover>
        )}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn của bạn..."
          className="flex-grow resize-none overflow-y-hidden min-h-[40px] max-h-[120px] leading-tight py-2" 
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
