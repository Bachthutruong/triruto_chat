// src/components/chat/ChatInterface.tsx
'use client';

import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit3, Trash2, Pin, PinOff } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React, { useState } from 'react';

type ChatInterfaceProps = {
  userSession: UserSession | null;
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  pinnedMessages?: Message[];
  suggestedReplies: string[];
  onSendMessage: (messageContent: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onCreateNewConversation?: () => void; // Made optional as customer view might not have this
  isChatLoading: boolean;
  viewerRole: MessageViewerRole;
  onUpdateConversationTitle?: (conversationId: string, newTitle: string) => void;
  onPinConversation?: (conversationId: string) => void;
  onUnpinConversation?: (conversationId: string) => void;
  onPinMessage?: (messageId: string) => void;
  onUnpinMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, currentContent: string) => void;
  currentStaffSessionId?: string;
  onBookAppointmentClick?: () => void; // Added prop
};

export function ChatInterface({
  userSession,
  conversations,
  activeConversationId,
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
  onPinMessage,
  onUnpinMessage,
  onDeleteMessage,
  onEditMessage,
  currentStaffSessionId,
  onBookAppointmentClick, // Destructure prop
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

  // For customer view, we might not show the sidebar, or show a simplified one if multiple convos are allowed.
  const shouldShowConversationSidebar = viewerRole !== 'customer_view' && onCreateNewConversation !== undefined;


  return (
    <div className={cn(
        "flex h-full w-full bg-background text-foreground",
        !shouldShowConversationSidebar && "flex-col" // Adjust layout if sidebar is hidden
      )}>
      {shouldShowConversationSidebar && onCreateNewConversation && (
        <div className="w-full md:w-72 lg:w-80 border-r border-border flex flex-col h-full bg-card flex-shrink-0 shadow-none">
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
                  <button
                    className="w-full text-left p-3 hover:bg-accent/50 transition-colors duration-150 flex flex-col gap-0.5"
                    onClick={() => onSelectConversation(conv.id)}
                    disabled={isChatLoading}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-sm font-medium truncate flex-grow pr-2" title={conv.title || `Cuộc trò chuyện ${conv.id.slice(-4)}`}>
                        {conv.isPinned && <Pin className="h-3 w-3 inline-block mr-1 text-amber-500" />}
                        {conv.title || `Cuộc trò chuyện ${conv.id.slice(-4)}`}
                      </span>
                      <div className="flex-shrink-0 space-x-1">
                        {onUpdateConversationTitle && (
                          <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); handleOpenTitleModal(conv);}} title="Sửa tiêu đề">
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        )}
                        {conv.isPinned && onUnpinConversation && (
                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); onUnpinConversation(conv.id);}} title="Bỏ ghim">
                                <PinOff className="h-3 w-3 text-amber-600" />
                            </Button>
                        )}
                        {!conv.isPinned && onPinConversation && (
                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); onPinConversation(conv.id);}} title="Ghim">
                                <Pin className="h-3 w-3" />
                            </Button>
                        )}
                      </div>
                    </div>
                    {conv.lastMessagePreview && (
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.lastMessagePreview}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/70">
                      {conv.lastMessageTimestamp ? formatDistanceToNowStrict(new Date(conv.lastMessageTimestamp), { addSuffix: true, locale: vi }) : 'Chưa có tin nhắn'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}

      {/* Main chat window */}
      <div className="flex-grow flex flex-col h-full overflow-hidden bg-background shadow-none border-none w-full">
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
            onPinMessage={onPinMessage}
            onUnpinMessage={onUnpinMessage}
            onDeleteMessage={onDeleteMessage}
            onEditMessage={onEditMessage}
            currentStaffSessionId={currentStaffSessionId}
            onBookAppointmentClick={onBookAppointmentClick} // Pass prop
          />
        ) : (
          !shouldShowConversationSidebar ? null : 
          <div className="flex-grow flex items-center justify-center p-4">
            <p className="text-muted-foreground">Chọn một cuộc trò chuyện để bắt đầu.</p>
          </div>
        )}
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
