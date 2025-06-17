// src/components/chat/MessageInputForm.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, X, FileText, Smile, CalendarPlus, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { QuickReplyType, AppointmentDetails } from '@/lib/types';
import { AppointmentManager } from './AppointmentManager';

type MessageInputFormProps = {
  onSubmit: (messageContent: string) => void;
  isLoading?: boolean;
  onBookAppointmentClick?: () => void;
  quickReplies?: QuickReplyType[];
  onTyping?: (isTyping: boolean) => void;
  appointments?: AppointmentDetails[];
  onCancelAppointment?: (appointmentId: string) => Promise<void>;
  onAppointmentBooked?: () => Promise<void>;
  viewerRole: 'customer' | 'staff' | 'admin';
};

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const commonEmojis = ['😀', '😂', '😍', '😊', '👍', '🙏', '❤️', '🎉'];

export function MessageInputForm({
  onSubmit,
  isLoading,
  onBookAppointmentClick,
  quickReplies = [],
  onTyping,
  appointments = [],
  onCancelAppointment,
  onAppointmentBooked,
  viewerRole
}: MessageInputFormProps) {
  const [message, setMessage] = useState('');
  const [stagedFile, setStagedFile] = useState<{ dataUri: string; name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const typingDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isAppointmentManagerOpen, setIsAppointmentManagerOpen] = useState(false);

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      if (onTyping) onTyping(false);
      if (typingDebounceTimeoutRef.current) clearTimeout(typingDebounceTimeoutRef.current);

    } else if (stagedFile && !contentToSend) {
      // This case handles sending only the file if no text message is present
      const fileNameEncoded = encodeURIComponent(stagedFile.name);
      const dataUriWithFileName = `${stagedFile.dataUri}#filename=${fileNameEncoded}`;
      onSubmit(dataUriWithFileName);
      setMessage('');
      setStagedFile(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      if (onTyping) onTyping(false);
      if (typingDebounceTimeoutRef.current) clearTimeout(typingDebounceTimeoutRef.current);
    }
  };

  const processFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "Tệp quá lớn",
        description: `Kích thước tệp không được vượt quá ${MAX_FILE_SIZE_MB}MB.`,
        variant: "destructive",
      });
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
    };
    reader.onerror = () => {
      toast({
        title: "Lỗi đọc tệp",
        description: "Không thể đọc tệp đã chọn. Vui lòng thử lại.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
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
    if (onTyping) onTyping(true);
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
      }, 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Drag and Drop Handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true); // Keep highlighting if dragging over
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      processFile(droppedFile);
      e.dataTransfer.clearData();
    }
  };

  const handleAppointmentButtonClick = () => {
    if (appointments.length > 0) {
      setIsAppointmentManagerOpen(true);
    } else if (onBookAppointmentClick) {
      onBookAppointmentClick();
      if (onAppointmentBooked) {
        onAppointmentBooked();
      }
    }
  };

  return (
    <>
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`border-t bg-card transition-colors ${isDraggingOver ? 'border-primary ring-2 ring-primary bg-primary/10' : 'border-border'}`}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-sm z-10 pointer-events-none">
            <p className="text-primary font-semibold text-lg">Thả file vào đây để tải lên</p>
          </div>
        )}
        {stagedFile && (
          <div className="p-2 border-b flex items-center justify-between bg-muted/50 text-sm">
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
        <form onSubmit={handleSubmit} className="p-2 flex flex-col gap-1">
          {onBookAppointmentClick && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAppointmentButtonClick}
              disabled={isLoading}
              aria-label={appointments.length > 0 ? "Xem lịch hẹn" : "Đặt lịch hẹn"}
              className="flex items-center justify-center gap-2 w-full h-auto px-2 py-1 text-center"
            >
              <CalendarPlus className="h-5 w-5" />
              <span>{appointments.length > 0 ? "Xem lịch hẹn" : "Đặt lịch hẹn"}</span>
            </Button>
          )}
          <div className="flex items-end gap-1 w-full">
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
            {quickReplies.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" disabled={isLoading} aria-label="Câu trả lời nhanh">
                    <Zap className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 max-h-[300px]">
                  <div className="p-2 text-sm font-medium border-b sticky top-0 bg-background z-10">Chọn câu trả lời nhanh</div>
                  <ScrollArea className="h-[200px]">
                    <div className="p-1">
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
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
            {/* {onBookAppointmentClick && viewerRole !== 'customer' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAppointmentButtonClick}
                disabled={isLoading}
                aria-label={appointments.length > 0 ? "Xem lịch hẹn" : "Đặt lịch hẹn"}
                className="hidden md:flex items-center gap-2"
              >
                <CalendarPlus className="h-5 w-5" />
                <span>{appointments.length > 0 ? "Xem lịch hẹn" : "Đặt lịch hẹn"}</span>
              </Button>
            )} */}
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
          </div>
        </form>
      </div>
      {onCancelAppointment && (
        <AppointmentManager
          isOpen={isAppointmentManagerOpen}
          onClose={() => setIsAppointmentManagerOpen(false)}
          appointments={appointments}
          onCancelAppointment={onCancelAppointment}
          onBookNewAppointmentClick={onBookAppointmentClick}
        />
      )}
    </>
  );
}
