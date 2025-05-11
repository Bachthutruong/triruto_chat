import type { Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Bot } from 'lucide-react';

type MessageBubbleProps = {
  message: Message;
};

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

  return (
    <div
      className={cn(
        'flex items-end gap-2 my-2',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8">
          {/* Placeholder for AI avatar image if available */}
          {/* <AvatarImage src="/ai-avatar.png" alt="AI Avatar" /> */}
          <AvatarFallback className="bg-accent text-accent-foreground">
            {avatarIcon}
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-4 py-2 shadow-md break-words',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-accent text-accent-foreground rounded-bl-none'
        )}
      >
        <p className="text-sm">{message.content}</p>
        <p className={cn(
            'text-xs mt-1',
            isUser ? 'text-primary-foreground/70 text-right' : 'text-accent-foreground/70 text-left'
          )}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      {isUser && (
        <Avatar className="h-8 w-8">
          {/* Placeholder for User avatar image if available */}
          {/* <AvatarImage src={userAvatarSrc} alt="User Avatar" /> */}
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            {avatarIcon}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
