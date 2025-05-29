// src/components/chat/ChatWindow.tsx
'use client';

import type { Message, UserSession, MessageViewerRole, QuickReplyType, AppointmentDetails } from '@/lib/types';
import { MessageBubble } from './MessageBubble';
import { MessageInputForm } from './MessageInputForm';
import { SuggestedReplies } from './SuggestedReplies';
import { ScrollArea } from '@/components/ui/scroll-area';
import React, { useRef, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ChatWindowProps = {
  userSession: UserSession | null;
  messages: Message[];
  pinnedMessages?: Message[];
  suggestedReplies: string[];
  onSendMessage: (messageContent: string) => void;
  onSuggestedReplyClick: (reply: string) => void;
  isLoading: boolean;
  viewerRole: MessageViewerRole;
  onPinRequested?: (messageId: string) => void;
  onUnpinRequested?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, currentContent: string) => void;
  currentStaffSessionId?: string;
  onBookAppointmentClick?: () => void;
  quickReplies?: QuickReplyType[];
  typingUsers?: Record<string, string>;
  onTyping?: (isTyping: boolean) => void;
  onScrollToMessage?: (messageId: string) => void;
  activeConversationPinnedMessageIds?: string[];
  activeConversationId?: string | null;
  appointments?: AppointmentDetails[];
  onCancelAppointment?: (appointmentId: string) => Promise<void>;
  onAppointmentBooked?: () => Promise<void>;
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
  onPinRequested,
  onUnpinRequested,
  onDeleteMessage,
  onEditMessage,
  currentStaffSessionId,
  onBookAppointmentClick,
  quickReplies,
  typingUsers = {},
  onTyping,
  onScrollToMessage,
  activeConversationPinnedMessageIds = [],
  activeConversationId,
  appointments = [],
  onCancelAppointment,
  onAppointmentBooked,
}: ChatWindowProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  // Manage local pinned messages for immediate UI update on unpin
  const [localPinnedMessages, setLocalPinnedMessages] = React.useState<Message[]>(pinnedMessages);
  useEffect(() => {
    setLocalPinnedMessages(pinnedMessages);
  }, [pinnedMessages]);
  const handleUnpinMessage = (messageId: string) => {
    if (onUnpinRequested) onUnpinRequested(messageId);
    setLocalPinnedMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, typingUsers]);

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
      {localPinnedMessages.length > 0 && (
        <div className="p-2 border-b bg-amber-50 max-h-36">
          <h4 className="text-xs font-semibold text-amber-700 mb-1 sticky top-0 bg-amber-50 py-1 z-10 flex items-center">
            <Pin className="h-3 w-3 mr-1 text-amber-600" /> Tin nhắn đã ghim:
          </h4>
          {localPinnedMessages.filter(Boolean).map((msg) => (
            msg && msg.id ? (
              <Button
                variant="ghost"
                key={`pinned-display-${msg.id}`}
                className="block w-full h-auto p-1.5 text-left mb-1 rounded-md hover:bg-amber-100"
                onClick={() => onScrollToMessage && onScrollToMessage(msg.id)}
                title="Nhấn để cuộn đến tin nhắn gốc"
              >
                <p className="text-xs text-amber-800 truncate leading-snug">
                  <span className="font-medium">{msg.name || (msg.sender === 'user' ? 'Khách' : 'Hệ thống')}:</span> {msg.content.split('\n')[0]} {/* Show first line */}
                </p>
              </Button>
            ) : null
          ))}
        </div>
      )}
      <ScrollArea className="p-4 h-[calc(100vh-16rem)]" ref={scrollAreaRef}>
        <div className="space-y-2">
          {messages.filter(Boolean).map((msg) => {
            if (!msg || !msg.id) return null;
            const isCurrentlyPinned = activeConversationPinnedMessageIds.includes(msg.id);
            const canPinMore = activeConversationPinnedMessageIds.length < 3 || isCurrentlyPinned;

            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                viewerRole={viewerRole}
                currentStaffSessionId={currentStaffSessionId}
                currentUserSessionId={userSession.id}
                onPinRequested={onPinRequested}
                onUnpinRequested={handleUnpinMessage}
                onDeleteMessage={onDeleteMessage}
                onEditMessage={onEditMessage}
                isCurrentlyPinned={isCurrentlyPinned}
                canPinMore={canPinMore}
              />
            );
          }
          )}
          {isLoading && messages.length > 0 && messages[messages.length - 1]?.sender === 'user' && <AILoadingIndicator />}
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
        quickReplies={quickReplies}
        onTyping={onTyping}
        appointments={appointments}
        onCancelAppointment={onCancelAppointment}
        onAppointmentBooked={onAppointmentBooked}
        viewerRole={viewerRole}
      />
    </div>
  );
}

