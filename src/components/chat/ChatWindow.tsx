// src/components/chat/ChatWindow.tsx
'use client';

import type { Message, UserSession, MessageViewerRole } from '@/lib/types';
import { MessageBubble } from './MessageBubble';
import { MessageInputForm } from './MessageInputForm';
import { SuggestedReplies } from './SuggestedReplies';
import { ScrollArea } from '@/components/ui/scroll-area';
import React, { useRef, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

type ChatWindowProps = {
  userSession: UserSession | null;
  messages: Message[];
  pinnedMessages?: Message[];
  suggestedReplies: string[];
  onSendMessage: (messageContent: string) => void;
  onSuggestedReplyClick: (reply: string) => void;
  isLoading: boolean;
  viewerRole: MessageViewerRole;
  onPinMessage?: (messageId: string) => void;
  onUnpinMessage?: (messageId: string) => void;
};

export function ChatWindow({
  userSession,
  messages,
  pinnedMessages = [],
  suggestedReplies,
  onSendMessage,
  onSuggestedReplyClick,
  isLoading,
  viewerRole,
  onPinMessage,
  onUnpinMessage,
}: ChatWindowProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  if (!userSession) {
    return (
      <div className="flex-grow flex items-center justify-center p-4">
        <p className="text-muted-foreground">Đang khởi tạo cuộc trò chuyện...</p>
      </div>
    );
  }
  
  const AILoadingIndicator = () => (
    <div className="flex items-end gap-2 my-2 justify-start">
      <Skeleton className="h-8 w-8 rounded-full bg-accent" />
      <div className="max-w-[70%] rounded-lg px-4 py-2 shadow-md bg-accent">
        <Skeleton className="h-4 w-20" /> 
      </div>
    </div>
  );

  return (
    <div className="flex-grow flex flex-col bg-background overflow-hidden">
      {pinnedMessages.length > 0 && (
        <div className="p-2 border-b bg-amber-50">
          <h4 className="text-xs font-semibold text-amber-700 mb-1">Tin nhắn đã ghim:</h4>
          {pinnedMessages.map((msg) => (
            <MessageBubble 
              key={`pinned-${msg.id}`} 
              message={{...msg, isPinned: true}} 
              viewerRole={viewerRole} 
              onPinMessage={onPinMessage}
              onUnpinMessage={onUnpinMessage}
            />
          ))}
        </div>
      )}
      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        <div className="space-y-2">
          {messages.map((msg) => (
            <MessageBubble 
              key={msg.id} 
              message={msg} 
              viewerRole={viewerRole} 
              onPinMessage={onPinMessage}
              onUnpinMessage={onUnpinMessage}
            />
          ))}
          {isLoading && messages[messages.length-1]?.sender === 'user' && <AILoadingIndicator />}
        </div>
      </ScrollArea>
      <SuggestedReplies
        replies={suggestedReplies}
        onReplyClick={onSuggestedReplyClick}
        isLoading={isLoading}
      />
      <MessageInputForm onSubmit={onSendMessage} isLoading={isLoading} />
    </div>
  );
}