
// src/components/chat/ChatInterface.tsx
'use client';

import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit3, Trash2, Pin, PinOff, MoreVertical } from 'lucide-react'; // Added MoreVertical
import { ChatWindow } from './ChatWindow';
import type { Conversation, Message, UserSession, MessageViewerRole } from '@/lib/types';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React, { useState } from 'react';

type ChatInterfaceProps = {
  userSession: UserSession | null;
  conversations: Conversation[];
  activeConversation: Conversation | null; // Changed from activeConversationId
  messages: Message[];
  pinnedMessages?: Message[];
  suggestedReplies: string[];
  onSendMessage: (messageContent: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onCreateNewConversation?: () => void;
  isChatLoading: boolean;
  viewerRole: MessageViewerRole;
  onUpdateConversationTitle?: (conversationId: string, newTitle: string) => void;
  onPinConversation?: (conversationId: string) => void;
  onUnpinConversation?: (conversationId: string) => void;
  onPinRequested?: (messageId: string) => void;
  onUnpinRequested?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, currentContent: string) => void;
  currentStaffSessionId?: string;
  onBookAppointmentClick?: () => void;
  onScrollToMessage?: (messageId: string) => void;
};

export function ChatInterface({
  userSession,
  conversations,
  activeConversation, // Changed from activeConversationId
  messages,
  pinnedMessages,
  suggestedReplies,
  onSendMessage,
  onSelectConversation,
  onCreateNewConversation,
  isChatLoading,
  viewerRole,
  onUpdateConversationTitle,
  onPinConversation,
  onUnpinConversation,
  onPinRequested,
  onUnpinRequested,
  onDeleteMessage,
  onEditMessage,
  currentStaffSessionId,
  onBookAppointmentClick,
  onScrollToMessage,
}: ChatInterfaceProps) {
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [newConversationTitle, setNewConversationTitle] = useState('');

  const handleOpenTitleModal = (conversation: Conversation) => {
    setEditingConversationId(conversation.id);
    setNewConversationTitle(conversation.title || '');
    setIsTitleModalOpen(true);
  };

  const handleTitleSubmit = () => {
    if (editingConversationId && onUpdateConversationTitle) {
      onUpdateConversationTitle(editingConversationId, newConversationTitle);
    }
    setIsTitleModalOpen(false);
    setEditingConversationId(null);
    setNewConversationTitle('');
  };

  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const dateA = a.lastMessageTimestamp ? new Date(a.lastMessageTimestamp).getTime() : 0;
    const dateB = b.lastMessageTimestamp ? new Date(b.lastMessageTimestamp).getTime() : 0;
    return dateB - dateA;
  });

  if (!userSession) {
    return <div className="flex-grow flex items-center justify-center p-4"><p>Không tìm thấy phiên làm việc.</p></div>;
  }

  const shouldShowConversationSidebar = viewerRole !== 'customer_view';
  const activeConversationId = activeConversation?.id || null;

  return (
    <div className={cn(
      "flex h-full w-full bg-background text-foreground",
      !shouldShowConversationSidebar && "flex-col"
    )}>
      <div className="w-full max-w-[1200px] mx-auto h-[calc(100vh-6rem)] my-0 flex border-none rounded-none shadow-none">
        {shouldShowConversationSidebar && onCreateNewConversation && (
          <div className="w-full md:w-72 lg:w-80 border-r border-border flex flex-col h-full bg-card flex-shrink-0 shadow-none rounded-none">
            <div className="p-3 border-b border-border">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onCreateNewConversation}
                disabled={isChatLoading}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Cuộc trò chuyện mới
              </Button>
            </div>
            <ScrollArea className="flex-grow">
              {sortedConversations.length === 0 && !isChatLoading && (
                <p className="p-4 text-sm text-muted-foreground text-center">Không có cuộc trò chuyện nào.</p>
              )}
              {isChatLoading && sortedConversations.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground text-center">Đang tải...</p>
              )}
              <ul>
                {sortedConversations.map((conv) => (
                  <li key={conv.id} className={cn(activeConversationId === conv.id && "bg-accent text-accent-foreground")}>
                    <div className="w-full text-left p-3 hover:bg-accent/50 transition-colors duration-150 flex items-center justify-between">
                        <button
                            className="flex-grow text-left flex flex-col gap-0.5 overflow-hidden"
                            onClick={() => onSelectConversation(conv.id)}
                            disabled={isChatLoading}
                        >
                            <span className="text-sm font-medium truncate flex items-center" title={conv.title || `Cuộc trò chuyện ${conv.id.slice(-4)}`}>
                            {conv.isPinned && <Pin className="h-3 w-3 inline-block mr-1 text-amber-500 shrink-0" />}
                            {conv.title || `Cuộc trò chuyện ${conv.id.slice(-4)}`}
                            </span>
                            {conv.lastMessagePreview && (
                                <p className="text-xs text-muted-foreground truncate">
                                {conv.lastMessagePreview}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground/70">
                                {conv.lastMessageTimestamp ? formatDistanceToNowStrict(new Date(conv.lastMessageTimestamp), { addSuffix: true, locale: vi }) : 'Chưa có tin nhắn'}
                            </p>
                        </button>
                         {(onUpdateConversationTitle || onPinConversation || onUnpinConversation) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0 shrink-0 ml-1" onClick={e => e.stopPropagation()}>
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                                {onUpdateConversationTitle && (
                                    <DropdownMenuItem onClick={() => handleOpenTitleModal(conv)}>
                                    <Edit3 className="mr-2 h-4 w-4" /> Sửa tiêu đề
                                    </DropdownMenuItem>
                                )}
                                {conv.isPinned && onUnpinConversation && (
                                    <DropdownMenuItem onClick={() => onUnpinConversation(conv.id)}>
                                    <PinOff className="mr-2 h-4 w-4 text-amber-600" /> Bỏ ghim cuộc trò chuyện
                                    </DropdownMenuItem>
                                )}
                                {!conv.isPinned && onPinConversation && (
                                    <DropdownMenuItem onClick={() => onPinConversation(conv.id)}>
                                    <Pin className="mr-2 h-4 w-4" /> Ghim cuộc trò chuyện
                                    </DropdownMenuItem>
                                )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                         )}
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}
        <div className="flex-grow h-full rounded-none">
          {(activeConversationId || viewerRole === 'customer_view') ? (
            <ChatWindow
              userSession={userSession}
              messages={messages}
              pinnedMessages={pinnedMessages}
              suggestedReplies={suggestedReplies}
              onSendMessage={onSendMessage}
              onSuggestedReplyClick={onSendMessage}
              isLoading={isChatLoading}
              viewerRole={viewerRole}
              onPinRequested={onPinRequested}
              onUnpinRequested={onUnpinRequested}
              onDeleteMessage={onDeleteMessage}
              onEditMessage={onEditMessage}
              currentStaffSessionId={currentStaffSessionId}
              onBookAppointmentClick={onBookAppointmentClick}
              onScrollToMessage={onScrollToMessage}
              activeConversationId={activeConversationId}
              activeConversationPinnedMessageIds={activeConversation?.pinnedMessageIds || []}
            />
          ) : (
            !shouldShowConversationSidebar ? null :
              <div className="flex-grow flex items-center justify-center p-4">
                <p className="text-muted-foreground">Chọn một cuộc trò chuyện để bắt đầu.</p>
              </div>
          )}
        </div>
      </div>
      <Dialog open={isTitleModalOpen} onOpenChange={setIsTitleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa Tiêu đề Cuộc trò chuyện</DialogTitle>
            <DialogDescription>
              Nhập tiêu đề mới cho cuộc trò chuyện này.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newConversationTitle}
              onChange={(e) => setNewConversationTitle(e.target.value)}
              placeholder="Tiêu đề cuộc trò chuyện"
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Hủy</Button>
            </DialogClose>
            <Button type="button" onClick={handleTitleSubmit}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
