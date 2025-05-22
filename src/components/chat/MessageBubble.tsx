
// src/components/chat/MessageBubble.tsx
import type { Message, MessageViewerRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot, FileText, Download, Brain, Edit, Trash2, Pin, PinOff, Image as ImageIconLucide, MoreVertical } from 'lucide-react';
import Image from 'next/image';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


type MessageBubbleProps = {
  message: Message;
  viewerRole: MessageViewerRole;
  currentStaffSessionId?: string;
  onPinRequested?: (messageId: string) => void;      // Changed from onPinMessage
  onUnpinRequested?: (messageId: string) => void;  // Changed from onUnpinMessage
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, currentContent: string) => void;
  isCurrentlyPinned: boolean;
  canPinMore: boolean;
};

function isImageDataURI(uri: string): boolean {
  const mimeMatch = uri.match(/^data:(image\/[^;]+);base64,/);
  return !!mimeMatch;
}

function getMimeTypeFromDataUri(dataUri: string): string | null {
  const match = dataUri.match(/^data:([A-Za-z-+\/]+);base64,/);
  return match ? match[1] : null;
}

export function MessageBubble({
    message,
    viewerRole,
    currentStaffSessionId,
    onPinRequested,
    onUnpinRequested,
    onDeleteMessage,
    onEditMessage,
    isCurrentlyPinned,
    canPinMore,
}: MessageBubbleProps) {
  const appSettings = useAppSettingsContext();
  const brandName = appSettings?.brandName || 'AetherChat';
  const [formattedTime, setFormattedTime] = useState('...');

  if (!message || !message.id) {
    console.warn("MessageBubble received invalid message prop:", message);
    return null;
  }

  useEffect(() => {
    if (message.timestamp) {
      setFormattedTime(new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } else {
      setFormattedTime('...'); 
    }
  }, [message.timestamp]);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const isUserSender = message.sender === 'user';
  const isAISender = message.sender === 'ai';
  const isSystemSender = message.sender === 'system';

  let displayName = 'Hệ thống';
  let avatarIcon = <Bot className="h-5 w-5" />;
  let avatarFallbackText = 'AI';

  if (isUserSender) {
    avatarIcon = <User className="h-5 w-5" />;
    if (viewerRole === 'customer_view') {
      displayName = 'Bạn';
      avatarFallbackText = 'B';
    } else {
      displayName = message.name || `Người dùng ${message.userId?.slice(-4) || 'ẩn danh'}`;
      avatarFallbackText = displayName.charAt(0).toUpperCase() || 'K';
    }
  } else if (isAISender) {
    if (viewerRole === 'customer_view') {
      displayName = `${brandName} AI`;
      avatarIcon = <Bot className="h-5 w-5" />;
      avatarFallbackText = 'AI';
    } else {
      displayName = message.name || `${brandName} AI`;
      avatarIcon = message.userId ? <User className="h-5 w-5" /> : <Brain className="h-5 w-5" />;
      avatarFallbackText = displayName.charAt(0).toUpperCase() || 'S';
    }
  }

  if (isSystemSender) {
    return (
      <div className="my-2 text-center text-xs text-muted-foreground italic px-4">
        {message.content}
      </div>
    );
  }

  const renderContent = () => {
    const dataUriRegex = /^(data:[^;]+;base64,[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;
    const match = message.content.match(dataUriRegex);

    if (match) {
      const fileDataUri = match[1];
      const fileNameEncoded = match[2];
      const textContent = match[3]?.trim();

      let fileName = "tệp_đính_kèm";
      try {
        fileName = decodeURIComponent(fileNameEncoded);
      } catch (e) {
        console.warn("Không thể giải mã tên tệp từ URI", e);
      }

      const fileElement = isImageDataURI(fileDataUri) ? (
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogTrigger asChild>
            <button type="button" className="my-1 relative max-w-xs h-auto aspect-auto block cursor-pointer hover:opacity-80 transition-opacity" title="Nhấn để xem ảnh lớn">
              <Image
                src={fileDataUri}
                alt={fileName || 'Hình ảnh được gửi'}
                width={200}
                height={200}
                className="rounded-md object-contain"
                style={{ maxWidth: '100%', height: 'auto' }}
                data-ai-hint="chat image preview"
              />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-2">
            <DialogHeader className="p-2 border-b">
              <DialogTitle className="text-sm truncate">{fileName}</DialogTitle>
            </DialogHeader>
            <div className="flex-grow overflow-auto p-2 flex items-center justify-center">
              <Image
                src={fileDataUri}
                alt={fileName || 'Hình ảnh được gửi'}
                width={800}
                height={600}
                className="max-w-full max-h-full object-contain"
                data-ai-hint="full image preview"
              />
            </div>
            <div className="p-2 border-t flex justify-end">
              <a href={fileDataUri} download={fileName}>
                <Button variant="outline"><Download className="mr-2 h-4 w-4" />Tải về</Button>
              </a>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <a
          href={fileDataUri}
          download={fileName}
          className="flex items-center gap-2 p-2 my-1 bg-secondary/50 hover:bg-secondary rounded-md text-sm text-foreground transition-colors"
        >
          <FileText className="h-6 w-6 text-primary flex-shrink-0" />
          <div className="flex flex-col overflow-hidden">
            <span className="truncate font-medium" title={fileName}>{fileName}</span>
            <span className="text-xs text-muted-foreground">Nhấn để tải về</span>
          </div>
          <Download className="h-5 w-5 ml-auto text-muted-foreground flex-shrink-0" />
        </a>
      );

      return (
        <>
          {fileElement}
          {textContent && <p className="text-sm whitespace-pre-wrap mt-1">{textContent}</p>}
        </>
      );
    }
    return <p className="text-sm whitespace-pre-wrap">{message.content}</p>;
  };

  const canBeModified = (viewerRole === 'staff' || viewerRole === 'admin') && message.userId === currentStaffSessionId && message.sender === 'ai';
  const canBePinned = (viewerRole === 'staff' || viewerRole === 'admin') && onPinRequested && onUnpinRequested && message.id !== 'msg_system_greeting' && !message.id.startsWith('msg_local_user_');


  return (
    <div id={message.id} className={cn('flex items-end gap-2 my-2 group relative', isUserSender ? 'justify-end' : 'justify-start')}>
      {!isUserSender && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className={cn(
            'bg-accent text-accent-foreground',
            viewerRole !== 'customer_view' && isAISender && message.userId && 'bg-teal-500 text-white',
            viewerRole !== 'customer_view' && isAISender && !message.userId && 'bg-purple-500 text-white'
          )}>
            {avatarIcon}
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-3 py-2 shadow-md break-words',
          isUserSender
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : viewerRole === 'customer_view' ? 'bg-accent text-accent-foreground rounded-bl-none' : 'bg-card border rounded-bl-none'
        )}
      >
        {(viewerRole !== 'customer_view' || !isUserSender) && (
          <p className="text-xs font-semibold mb-1">{displayName}</p>
        )}
        {renderContent()}
        <div className="flex items-center justify-end text-xs mt-1">
          <span className={cn(
            isUserSender ? 'text-primary-foreground/70' :
            viewerRole === 'customer_view' ? 'text-accent-foreground/70' : 'text-muted-foreground'
          )}>
            {formattedTime}
          </span>
        </div>
      </div>
      {isUserSender && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            {avatarIcon}
          </AvatarFallback>
        </Avatar>
      )}

      {(canBeModified || canBePinned) && (
        <div className={cn("absolute opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center", isUserSender ? "left-0 -translate-x-full mr-1" : "right-0 translate-x-full ml-1")} style={{ top: '50%', transform: isUserSender ? 'translate(-100%, -50%)' : 'translate(100%, -50%)' }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isUserSender ? "end" : "start"}>
              {canBePinned && (
                isCurrentlyPinned ? (
                  <DropdownMenuItem onClick={() => onUnpinRequested && onUnpinRequested(message.id)}>
                    <PinOff className="mr-2 h-4 w-4" /> Bỏ ghim
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onPinRequested && onPinRequested(message.id)} disabled={!canPinMore}>
                    <Pin className="mr-2 h-4 w-4" /> Ghim tin nhắn
                    {!canPinMore && <span className="text-xs text-muted-foreground ml-1">(Đã đủ 3 ghim)</span>}
                  </DropdownMenuItem>
                )
              )}
              {canBeModified && onDeleteMessage && onEditMessage && (
                <>
                  {canBePinned && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => onEditMessage(message.id, message.content)}>
                    <Edit className="mr-2 h-4 w-4" /> Sửa
                  </DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Xóa
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa tin nhắn này?</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDeleteMessage(message.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
