// src/components/chat/MessageBubble.tsx
import type { Message, MessageViewerRole, UserSession } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot, FileText, Download, Brain, Edit, Trash2, Pin, PinOff, Smile } from 'lucide-react';
import Image from 'next/image';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type MessageBubbleProps = {
  message: Message;
  viewerRole: MessageViewerRole; // 'customer_view', 'staff', 'admin'
  currentStaffSessionId?: string; // ID of the currently logged-in staff/admin
  onPinMessage?: (messageId: string) => void;
  onUnpinMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void; // For staff deleting their own messages
  onEditMessage?: (messageId: string, currentContent: string) => void; // For staff editing their own messages
};

function isImageDataURI(uri: string): boolean {
  return typeof uri === 'string' && uri.startsWith('data:image/');
}

export function MessageBubble({ 
    message, 
    viewerRole, 
    currentStaffSessionId,
    onPinMessage, 
    onUnpinMessage,
    onDeleteMessage,
    onEditMessage 
}: MessageBubbleProps) {
  const appSettings = useAppSettingsContext();
  const brandName = appSettings?.brandName || 'AetherChat';

  const isUserSender = message.sender === 'user'; // Customer sending message
  const isAISender = message.sender === 'ai';     // AI or Staff/Admin sending message (appears as AI to customer)
  const isSystemSender = message.sender === 'system';

  let displayName = 'Hệ thống';
  let avatarIcon = <Bot className="h-5 w-5" />;
  let avatarFallback = 'AI';

  if (isUserSender) { // Message sent by the customer
    avatarIcon = <User className="h-5 w-5" />;
    if (viewerRole === 'customer_view') {
      displayName = 'Bạn';
      avatarFallback = 'B';
    } else { // Staff/Admin viewing customer's message
      displayName = message.name || 'Khách hàng';
      avatarFallback = displayName.charAt(0).toUpperCase() || 'K';
    }
  } else if (isAISender) { // Message sent by AI or Staff/Admin (appears as AI to customer)
    if (viewerRole === 'customer_view') {
      displayName = `${brandName} AI`;
      avatarIcon = <Bot className="h-5 w-5" />;
      avatarFallback = 'AI';
    } else { // Staff/Admin viewing message from AI or another staff/admin
      displayName = message.name || `${brandName} AI`; // message.name here would be the actual staff/admin sender name
      avatarIcon = message.userId ? <User className="h-5 w-5" /> : <Brain className="h-5 w-5" />; // User icon if staff sent, Brain if pure AI
      avatarFallback = displayName.charAt(0).toUpperCase() || 'S';
    }
  }
  // System messages don't have avatars or detailed display names in this context

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
        
        let fileName = "attached_file";
        try {
            fileName = decodeURIComponent(fileNameEncoded);
        } catch (e) { 
            console.warn("Failed to decode filename from URI", e);
        }

        const fileElement = isImageDataURI(fileDataUri) ? (
            <Image 
              src={fileDataUri} 
              alt={fileName || 'Hình ảnh được gửi'} 
              width={200} 
              height={200} 
              className="rounded-md object-contain max-w-xs my-1"
              data-ai-hint="user image"
            />
        ) : (
            <a
              href={fileDataUri}
              download={fileName}
              className="flex items-center gap-2 p-2 my-1 bg-secondary/50 hover:bg-secondary rounded-md text-sm text-foreground"
            >
              <FileText className="h-5 w-5 text-primary" />
              <span className="truncate max-w-[150px] sm:max-w-xs">{fileName}</span>
              <Download className="h-4 w-4 ml-auto text-muted-foreground flex-shrink-0" />
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

  const canPin = viewerRole !== 'customer_view' && onPinMessage && onUnpinMessage;
  const isOwnStaffMessage = (viewerRole === 'staff' || viewerRole === 'admin') && message.userId === currentStaffSessionId && message.sender === 'ai';
  
  return (
    <div className={cn('flex items-end gap-2 my-2 group relative', isUserSender ? 'justify-end' : 'justify-start')}>
      {!isUserSender && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className={cn(
            'bg-accent text-accent-foreground', 
            viewerRole !== 'customer_view' && isAISender && message.userId && 'bg-teal-500 text-white', // Staff sent message
            viewerRole !== 'customer_view' && isAISender && !message.userId && 'bg-purple-500 text-white' // Pure AI message
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
        <p className="text-xs font-semibold mb-1">{displayName}</p>
        {renderContent()}
        <div className="flex items-center justify-between text-xs mt-1">
          <span className={cn(
              isUserSender ? 'text-primary-foreground/70' : 
              viewerRole === 'customer_view' ? 'text-accent-foreground/70' : 'text-muted-foreground'
            )}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {message.updatedAt && <em className="ml-1">(đã sửa)</em>}
          </span>
          {isOwnStaffMessage && onDeleteMessage && onEditMessage && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-0.5">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5 text-muted-foreground hover:text-foreground" 
                    onClick={() => onEditMessage(message.id, message.content)}
                    title="Sửa tin nhắn"
                >
                    <Edit className="h-3 w-3" />
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            title="Xóa tin nhắn"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa tin nhắn này?</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDeleteMessage(message.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
          )}
        </div>
      </div>
      {isUserSender && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            {avatarIcon}
          </AvatarFallback>
        </Avatar>
      )}
      {canPin && (
        <div className="absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1"
             style={isUserSender ? { left: '-2.5rem' } : { right: '-2.5rem' }}>
          {message.isPinned ? (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-500" onClick={() => onUnpinMessage && onUnpinMessage(message.id)} title="Bỏ ghim">
              <PinOff className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onPinMessage && onPinMessage(message.id)} title="Ghim tin nhắn">
              <Pin className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
