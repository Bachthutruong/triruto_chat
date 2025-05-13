// src/components/chat/MessageBubble.tsx
import type { Message, MessageViewerRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot, FileText, Download, Brain, Edit, Trash2, Thumbtack, ThumbtackOff } from 'lucide-react';
import Image from 'next/image';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { Button } from '@/components/ui/button';

type MessageBubbleProps = {
  message: Message;
  viewerRole: MessageViewerRole; // 'customer_view', 'staff', 'admin'
  onPinMessage?: (messageId: string) => void;
  onUnpinMessage?: (messageId: string) => void;
  // Add props for edit/delete if implementing later
};

function isImageDataURI(uri: string): boolean {
  return typeof uri === 'string' && uri.startsWith('data:image/');
}

export function MessageBubble({ message, viewerRole, onPinMessage, onUnpinMessage }: MessageBubbleProps) {
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
    avatarIcon = <Brain className="h-5 w-5" />; // Use Brain for AI/Staff originated
    if (viewerRole === 'customer_view') {
      displayName = `${brandName} AI`;
      avatarFallback = 'AI';
    } else { // Staff/Admin viewing message from AI or another staff/admin
      displayName = message.name || `${brandName} AI`; // message.name here would be the actual staff/admin sender name
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

  return (
    <div className={cn('flex items-end gap-2 my-2 group relative', isUserSender ? 'justify-end' : 'justify-start')}>
      {!isUserSender && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className={cn('bg-accent text-accent-foreground', viewerRole !== 'customer_view' && isAISender && 'bg-teal-500 text-white')}>
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
        <p className={cn(
            'text-xs mt-1',
            isUserSender ? 'text-primary-foreground/70 text-right' : 
            viewerRole === 'customer_view' ? 'text-accent-foreground/70 text-left' : 'text-muted-foreground text-left'
          )}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
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
              <ThumbtackOff className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onPinMessage && onPinMessage(message.id)} title="Ghim tin nhắn">
              <Thumbtack className="h-4 w-4" />
            </Button>
          )}
          {/* Placeholder for Edit/Delete buttons for staff messages */}
          {/* {viewerRole !== 'customer_view' && message.userId === currentStaffId && (
            <>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Sửa"><Edit className="h-4 w-4"/></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" title="Xóa"><Trash2 className="h-4 w-4"/></Button>
            </>
          )} */}
        </div>
      )}
    </div>
  );
}