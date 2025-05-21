
// src/components/chat/ChatWindow.tsx
'use client';

import type { Message, UserSession, MessageViewerRole, QuickReplyType } from '@/lib/types'; // Added QuickReplyType
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
  quickReplies?: QuickReplyType[]; // Added
  typingUsers?: Record<string, string>; // Added
  onTyping?: (isTyping: boolean) => void; // Added
};

const TypingIndicator = ({ users }: { users: Record<string, string> }) => {
  const userNames = Object.values(users);
  if (userNames.length === 0) return null;
  const displayNames = userNames.slice(0, 2).join(', ');
  const andMore = userNames.length > 2 ? ` và ${userNames.length - 2} người khác` : '';
  return (
    <div className="px-4 py-1 text-xs text-muted-foreground italic">
      {displayNames}{andMore} đang gõ...
    </div>
  );
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
  quickReplies, // Destructure
  typingUsers = {}, // Destructure with default
  onTyping, // Destructure
}: ChatWindowProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, typingUsers]); // Added typingUsers to re-scroll when indicator appears/disappears

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
    <div className="flex-grow flex flex-col bg-background overflow-hidden h-full border-none shadow-none">
      {pinnedMessages.length > 0 && (
        <div className="p-2 border-b bg-amber-50 max-h-36 overflow-y-auto"> 
          <h4 className="text-xs font-semibold text-amber-700 mb-1 sticky top-0 bg-amber-50 py-1 z-10">Tin nhắn đã ghim:</h4>
          {pinnedMessages.filter(Boolean).map((msg) => (
            msg && msg.id ? (
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
      <ScrollArea className="p-4 h-[calc(100vh-16rem)]" ref={scrollAreaRef}> 
        <div className="space-y-2">
          {messages.filter(Boolean).map((msg) => (
             msg && msg.id ? (
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
      {Object.keys(typingUsers).length > 0 && <TypingIndicator users={typingUsers} />}
      <SuggestedReplies
        replies={suggestedReplies}
        onReplyClick={onSuggestedReplyClick}
        isLoading={isLoading}
      />
      <MessageInputForm
        onSubmit={onSendMessage}
        isLoading={isLoading}
        onBookAppointmentClick={onBookAppointmentClick}
        quickReplies={quickReplies} // Pass quick replies
        onTyping={onTyping} // Pass typing handler
      />
    </div>
  );
}
    
