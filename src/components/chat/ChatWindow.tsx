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
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, currentContent: string) => void;
  currentStaffSessionId?: string;
  onBookAppointmentClick?: () => void; 
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
  onDeleteMessage,
  onEditMessage,
  currentStaffSessionId,
  onBookAppointmentClick,
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
    <div className="flex-grow flex flex-col bg-background overflow-hidden h-full">
      {pinnedMessages.length > 0 && (
        <div className="p-2 border-b bg-amber-50 max-h-48 overflow-y-auto">
          <h4 className="text-xs font-semibold text-amber-700 mb-1 sticky top-0 bg-amber-50 py-1 z-10">Tin nhắn đã ghim:</h4>
          {pinnedMessages.map((msg) => (
            msg && msg.id ? ( // Ensure msg and msg.id are valid
              <MessageBubble 
                key={`pinned-${msg.id}`} 
                message={{...msg, isPinned: true}} 
                viewerRole={viewerRole} 
                onPinMessage={onPinMessage}
                onUnpinMessage={onUnpinMessage}
                onDeleteMessage={onDeleteMessage}
                onEditMessage={onEditMessage}
                currentStaffSessionId={currentStaffSessionId}
              />
            ) : null
          ))}
        </div>
      )}
      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        <div className="space-y-2">
          {messages.filter(Boolean).map((msg) => ( // Added .filter(Boolean)
             msg && msg.id ? ( // Ensure msg and msg.id are valid
              <MessageBubble 
                key={msg.id} 
                message={msg} 
                viewerRole={viewerRole} 
                onPinMessage={onPinMessage}
                onUnpinMessage={onUnpinMessage}
                onDeleteMessage={onDeleteMessage}
                onEditMessage={onEditMessage}
                currentStaffSessionId={currentStaffSessionId}
              />
            ) : null
          ))}
          {isLoading && messages.length > 0 && messages[messages.length-1]?.sender === 'user' && <AILoadingIndicator />}
        </div>
      </ScrollArea>
      <SuggestedReplies
        replies={suggestedReplies}
        onReplyClick={onSuggestedReplyClick}
        isLoading={isLoading}
      />
      <MessageInputForm 
        onSubmit={onSendMessage} 
        isLoading={isLoading}
        onBookAppointmentClick={onBookAppointmentClick}
      />
    </div>
  );
}
