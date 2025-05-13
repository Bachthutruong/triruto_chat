// src/components/chat/MessageBubble.tsx
import type { Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot, FileText, Download } from 'lucide-react';
import Image from 'next/image';

type MessageBubbleProps = {
  message: Message;
};

function isImageDataURI(uri: string): boolean {
  return typeof uri === 'string' && uri.startsWith('data:image/');
}

// Removed unused isPdfDataURI and generic isFileDataURI

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  const avatarIcon = isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />;
  const avatarFallback = isUser ? message.name?.charAt(0).toUpperCase() || 'U' : 'AI';

  if (isSystem) {
    return (
      <div className="my-2 text-center text-xs text-muted-foreground">
        {message.content}
      </div>
    );
  }

  const renderContent = () => {
    // Regex to match "dataURI#filename=encodedName\nOptionalText"
    // It captures: 1=dataURI, 2=encodedName, 3=optionalText (including newline if present)
    const dataUriRegex = /^(data:[^;]+;base64,[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;
    const match = message.content.match(dataUriRegex);

    if (match) {
        const fileDataUri = match[1];
        const fileNameEncoded = match[2];
        const textContent = match[3]?.trim(); // Text part after the file data and potential newline
        
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
    // Original behavior for text-only messages
    return <p className="text-sm whitespace-pre-wrap">{message.content}</p>;
  };


  return (
    <div
      className={cn(
        'flex items-end gap-2 my-2',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-accent text-accent-foreground">
            {avatarIcon}
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-3 py-2 shadow-md break-words',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-accent text-accent-foreground rounded-bl-none'
        )}
      >
        <p className="text-xs font-semibold mb-1">{message.name || (isUser ? 'Bạn' : 'AI Bot')}</p>
        {renderContent()}
        <p className={cn(
            'text-xs mt-1',
            isUser ? 'text-primary-foreground/70 text-right' : 'text-accent-foreground/70 text-left'
          )}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      {isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            {avatarIcon}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
