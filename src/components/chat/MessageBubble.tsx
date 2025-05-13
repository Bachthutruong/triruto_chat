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

function isPdfDataURI(uri: string): boolean {
    return typeof uri === 'string' && uri.startsWith('data:application/pdf');
}

function isFileDataURI(uri: string): boolean {
  return typeof uri === 'string' && uri.startsWith('data:');
}

function getFileNameFromDataURI(dataURI: string): string {
  const hashIndex = dataURI.lastIndexOf('#filename=');
  if (hashIndex !== -1) {
    try {
      return decodeURIComponent(dataURI.substring(hashIndex + '#filename='.length));
    } catch (e) {
      // fallback if decoding fails
    }
  }
  if (isImageDataURI(dataURI)) return "image_file"; // Simplified name for images
  if (isPdfDataURI(dataURI)) return "document.pdf";
  // Attempt to get a generic name based on MIME type
  const mimeMatch = dataURI.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);/);
  if (mimeMatch && mimeMatch[1]) {
    const type = mimeMatch[1].split('/')[1] || 'file';
    return `uploaded_file.${type.split('.').pop() || 'bin'}`;
  }
  return "uploaded_file";
}


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
    if (isImageDataURI(message.content)) {
      return (
        <Image 
          src={message.content} 
          alt="Hình ảnh được gửi" 
          width={200} // Adjust as needed
          height={200} // Adjust as needed
          className="rounded-md object-contain max-w-xs"
          data-ai-hint="user image"
        />
      );
    }
    if (isFileDataURI(message.content)) {
      const fileName = getFileNameFromDataURI(message.content);
      return (
        <a
          href={message.content}
          download={fileName}
          className="flex items-center gap-2 p-2 bg-secondary/50 hover:bg-secondary rounded-md text-sm text-foreground"
        >
          <FileText className="h-5 w-5 text-primary" />
          <span>{fileName}</span>
          <Download className="h-4 w-4 ml-auto text-muted-foreground" />
        </a>
      );
    }
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
