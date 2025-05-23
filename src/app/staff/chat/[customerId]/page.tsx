
// src/app/staff/chat/[customerId]/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import NextImage from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Paperclip, Smile, UserCircle, Edit2, Tag, Clock, Phone, Info, X, StickyNote, PlusCircle, Trash2, UserPlus, LogOutIcon, UserCheck, Users, Pin, PinOff, Edit, Image as ImageIconLucide, ExternalLink, FileText, Download, Zap, MoreVertical, CalendarPlus, Loader2 } from 'lucide-react';
import type { CustomerProfile, Message, AppointmentDetails, UserSession, Note, MessageEditState, Conversation, QuickReplyType, AppointmentBookingFormData } from '@/lib/types';
import {
  getCustomerDetails,
  sendStaffMessage,
  assignStaffToCustomer,
  addTagToCustomer,
  unassignStaffFromCustomer,
  removeTagFromCustomer,
  updateCustomerInternalName,
  addNoteToCustomer,
  deleteCustomerNote,
  updateCustomerNote,
  getStaffList,
  pinMessageToConversation,
  unpinMessageFromConversation,
  getMessagesByIds,
  markCustomerInteractionAsReadByStaff,
  deleteStaffMessage,
  editStaffMessage,
  getQuickReplies,
  handleBookAppointmentFromForm,
  getCustomerMediaMessages
} from '@/app/actions';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogHeader, DialogFooter, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useSocket } from '@/contexts/SocketContext';
import { AppointmentBookingForm } from '@/components/chat/AppointmentBookingForm';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function getMimeTypeFromDataUri(dataUri: string): string | null {
  const match = dataUri.match(/^data:([^;]+);base64,/);
  return match ? match[1] : null;
}

function isImageDataURI(uri: string): boolean {
  return typeof uri === 'string' && uri.startsWith('data:image/');
}

export default function StaffIndividualChatPage() {
  const params = useParams();
  const customerId = params.customerId as string;
  const { toast } = useToast();

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDetails[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [allMediaMessages, setAllMediaMessages] = useState<Message[]>([]);


  const [isLoading, setIsLoading] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [staffSession, setStaffSession] = useState<UserSession | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingInternalName, setEditingInternalName] = useState(false);
  const [internalNameInput, setInternalNameInput] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  const [allStaff, setAllStaff] = useState<{id: string, name: string}[]>([]);
  const [selectedStaffToAssign, setSelectedStaffToAssign] = useState<string>('');

  const [messageEditState, setMessageEditState] = useState<MessageEditState>(null);
  const [currentAttachmentInEdit, setCurrentAttachmentInEdit] = useState<{ dataUri: string; name: string; type: string | null } | null>(null);
  const [stagedEditFile, setStagedEditFile] = useState<{ dataUri: string; name: string; type: string } | null>(null);
  const [editTextContent, setEditTextContent] = useState('');
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [quickReplies, setQuickReplies] = useState<QuickReplyType[]>([]);

  const { socket, isConnected } = useSocket();
  const usersTypingMapRef = useRef<Record<string, string>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const fetchPinnedMessagesForConversation = useCallback(async (conversation: Conversation | null) => {
    if (!conversation || !conversation.pinnedMessageIds || conversation.pinnedMessageIds.length === 0) {
        setPinnedMessages([]);
        return;
    }
    try {
        console.log(`[Staff] Fetching pinned messages for conv ${conversation.id}:`, conversation.pinnedMessageIds);
        const fetchedPinned = await getMessagesByIds(conversation.pinnedMessageIds);
        setPinnedMessages(fetchedPinned);
    } catch (error) {
        console.error("Error fetching pinned messages for staff:", error);
        setPinnedMessages([]);
    }
  }, []);


  const fetchChatData = useCallback(async () => {
    if (customerId && staffSession) {
      console.log("Staff: fetchChatData triggered for customerId:", customerId);
      setIsLoading(true);
      try {
        const [details, fetchedQuickRepliesResult, fetchedMediaMessages] = await Promise.all([
          getCustomerDetails(customerId),
          getQuickReplies(),
          getCustomerMediaMessages(customerId)
        ]);

        const {
          customer: fetchedCustomer,
          messages: fetchedMessages,
          appointments: fetchedAppointments,
          notes: fetchedNotes,
          conversations: fetchedConversations
        } = details;

        setCustomer(fetchedCustomer);
        setAppointments(fetchedAppointments || []);
        setNotes(fetchedNotes || []);
        setQuickReplies(fetchedQuickRepliesResult || []);
        setAllMediaMessages(fetchedMediaMessages || []);


        if (fetchedCustomer?.internalName) {
          setInternalNameInput(fetchedCustomer.internalName);
        } else if (fetchedCustomer) {
          setInternalNameInput('');
        }

        const currentActiveConv = fetchedConversations && fetchedConversations.length > 0 ?
            {
                ...fetchedConversations[0],
                pinnedMessageIds: fetchedConversations[0].pinnedMessageIds || []
            } : null;
        setActiveConversation(currentActiveConv);

        if (currentActiveConv) {
          setMessages(fetchedMessages || []);
          fetchPinnedMessagesForConversation(currentActiveConv);
        } else {
          setMessages([]);
          setPinnedMessages([]);
        }

        if (fetchedCustomer && fetchedCustomer.interactionStatus === 'unread' && staffSession.role !== 'customer') {
          await markCustomerInteractionAsReadByStaff(customerId, staffSession.id);
          setCustomer(prev => prev ? {...prev, interactionStatus: 'read'} : null);
        }

      } catch (error) {
        console.error("Không thể tải chi tiết khách hàng:", error);
        toast({ title: "Lỗi", description: "Không thể tải chi tiết khách hàng.", variant: "destructive" });
        setCustomer(null);
        setMessages([]);
        setPinnedMessages([]);
        setActiveConversation(null);
        setAllMediaMessages([]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [customerId, toast, staffSession, fetchPinnedMessagesForConversation]);

  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      const session = JSON.parse(sessionString);
      setStaffSession(session);
      if (session.role === 'admin') {
        const fetchStaffList = async () => {
          try {
            const staff = await getStaffList();
            setAllStaff(staff);
          } catch (error) {
            toast({ title: "Lỗi", description: "Không thể tải danh sách nhân viên.", variant: "destructive" });
          }
        };
        fetchStaffList();
      }
    } else {
      toast({ title: "Lỗi Phiên", description: "Không tìm thấy phiên làm việc. Vui lòng đăng nhập lại.", variant: "destructive" });
      setIsLoading(false);
    }
  }, [toast]);


  useEffect(() => {
    if (staffSession) {
      fetchChatData();
    }
  }, [fetchChatData, staffSession]);

  const handlePinnedMessagesUpdated = useCallback(({ conversationId: updatedConvId, pinnedMessageIds: newPinnedIds }: { conversationId: string, pinnedMessageIds: string[] }) => {
    console.log(`[Staff] Received pinnedMessagesUpdated for conv ${updatedConvId}. New IDs:`, newPinnedIds, "Current active conv ID:", activeConversation?.id);
    if (updatedConvId === activeConversation?.id) {
        setActiveConversation(prev => {
            if (prev && prev.id === updatedConvId) {
                console.log(`[Staff] Updating pinned IDs for conv ${updatedConvId} from`, prev.pinnedMessageIds, "to", newPinnedIds);
                return { ...prev, pinnedMessageIds: newPinnedIds || [] };
            }
            return prev;
        });
    }
  }, [activeConversation]);

  useEffect(() => {
      if (activeConversation) { // This effect will run when activeConversation itself changes
          fetchPinnedMessagesForConversation(activeConversation);
      }
  }, [activeConversation, fetchPinnedMessagesForConversation]);

  useEffect(() => {
    if (!socket || !isConnected || !activeConversation?.id || !staffSession) {
      return;
    }

    console.log(`Staff/Admin ${staffSession.id} joining room: ${activeConversation.id}`);
    socket.emit('joinRoom', activeConversation.id);

    const handleNewMessage = (newMessage: Message) => {
      console.log('Staff/Admin received new message:', newMessage);
      if (newMessage.conversationId === activeConversation?.id && newMessage.userId !== staffSession?.id) {
        setMessages(prev => {
            if (prev.find(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
        });
      }
    };

    const handleUserTyping = ({ userId: typingUserId, userName, conversationId: incomingConvId }: { userId: string, userName: string, conversationId: string }) => {
      if (incomingConvId === activeConversation?.id && typingUserId !== socket.id && typingUserId !== staffSession?.id) {
        usersTypingMapRef.current = { ...usersTypingMapRef.current, [typingUserId]: userName };
        setTypingUsers({ ...usersTypingMapRef.current });
      }
    };

    const handleUserStopTyping = ({ userId: typingUserId, conversationId: incomingConvId }: { userId: string, conversationId: string }) => {
      if (incomingConvId === activeConversation?.id && typingUserId !== socket.id && typingUserId !== staffSession?.id) {
        const { [typingUserId]: _, ...rest } = usersTypingMapRef.current;
        usersTypingMapRef.current = rest;
        setTypingUsers({ ...usersTypingMapRef.current });
      }
    };

    const handleMessageDeleted = ({ messageId: deletedMessageId, conversationId: convId }: { messageId: string, conversationId: string }) => {
      if (convId === activeConversation?.id) {
        setMessages(prev => prev.filter(m => m.id !== deletedMessageId));
        setPinnedMessages(prev => prev.filter(pm => pm.id !== deletedMessageId));
      }
    };

    const handleMessageEdited = ({ message: editedMessage, conversationId: convId }: { message: Message, conversationId: string }) => {
       if (convId === activeConversation?.id) {
        setMessages(prev => prev.map(m => m.id === editedMessage.id ? {...editedMessage, timestamp: new Date(editedMessage.timestamp)} : m));
        setPinnedMessages(prev => prev.map(pm => pm.id === editedMessage.id ? {...editedMessage, timestamp: new Date(editedMessage.timestamp)} : pm));
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);
    socket.on('pinnedMessagesUpdated', handlePinnedMessagesUpdated);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('messageEdited', handleMessageEdited);


    return () => {
      if (socket && activeConversation?.id && staffSession) {
        console.log(`Staff/Admin ${staffSession.id} leaving room: ${activeConversation.id}`);
        socket.emit('leaveRoom', activeConversation.id);
        socket.off('newMessage', handleNewMessage);
        socket.off('userTyping', handleUserTyping);
        socket.off('userStopTyping', handleUserStopTyping);
        socket.off('pinnedMessagesUpdated', handlePinnedMessagesUpdated);
        socket.off('messageDeleted', handleMessageDeleted);
        socket.off('messageEdited', handleMessageEdited);
      }
    };
  }, [socket, isConnected, activeConversation, staffSession, handlePinnedMessagesUpdated]);


  const handleSendMessage = async (messageContent: string) => {
    console.log("Staff: handleSendMessage called. Initial isSendingMessage:", isSendingMessage);
    if (!messageContent.trim() || !customer || !staffSession || !activeConversation?.id) {
        toast({ title: "Lỗi", description: "Không thể gửi tin nhắn. Thiếu thông tin khách hàng, phiên làm việc hoặc cuộc trò chuyện.", variant: "destructive" });
        return;
    }
    console.log("Staff: Setting isSendingMessage to true");
    setIsSendingMessage(true);
    if (socket && isConnected && onTyping) onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    console.log("Staff: Sending message with content:", messageContent);

    try {
      const sentMessage = await sendStaffMessage(staffSession!, customer!.id, activeConversation!.id, messageContent);
      console.log("Staff: Message object received from action to add to state:", sentMessage);
      if (sentMessage && sentMessage.id) {
        setMessages(prev => [...prev, {...sentMessage, timestamp: new Date(sentMessage.timestamp)}]);
        setCustomer(prev => prev ? { ...prev, interactionStatus: 'replied_by_staff', lastMessagePreview: messageContent.substring(0,100), lastMessageTimestamp: new Date(sentMessage.timestamp) } : null);
        setActiveConversation(prev => prev ? { ...prev, lastMessagePreview: messageContent.substring(0,100), lastMessageTimestamp: new Date(sentMessage.timestamp) } : null);
        if (socket && isConnected) {
          socket.emit('sendMessage', { message: sentMessage, conversationId: activeConversation.id });
          console.log("Staff: Emitting sendMessage via socket:", sentMessage, activeConversation.id);
        }
      } else {
        console.error("Staff: sendStaffMessage action did not return a valid message object.");
        toast({ title: "Lỗi", description: "Không thể gửi tin nhắn. Phản hồi từ server không hợp lệ.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Staff: Error sending message:", error);
      toast({ title: "Lỗi gửi tin nhắn", description: error.message, variant: "destructive"});
    } finally {
      console.log("Staff: Setting isSendingMessage to false in finally block");
      setIsSendingMessage(false);
    }
  };

  const onTyping = (isTypingStatus: boolean) => {
    if (!socket || !isConnected || !activeConversation?.id || !staffSession) return;
    if (isTypingStatus) {
      socket.emit('typing', { conversationId: activeConversation.id, userName: staffSession.name || 'Nhân viên', userId: staffSession.id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (socket && isConnected && activeConversation?.id && staffSession?.id) {
            socket.emit('stopTyping', { conversationId: activeConversation.id, userId: staffSession.id });
        }
      }, 1500);
    }
  };

  const handleEditMessage = (messageId: string, currentContent: string) => {
    setMessageEditState({ messageId, currentContent });
    const dataUriRegex = /^(data:[^;]+;base64,[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;
    const match = currentContent.match(dataUriRegex);

    if (match) {
      const fileDataUri = match[1];
      const fileNameEncoded = match[2];
      const textMsgContent = match[3]?.trim() || '';
      let fileName = "attached_file";
      try {
        fileName = decodeURIComponent(fileNameEncoded);
      } catch (e) { /* ignore */ }

      setCurrentAttachmentInEdit({ dataUri: fileDataUri, name: fileName, type: getMimeTypeFromDataUri(fileDataUri) });
      setEditTextContent(textMsgContent);
    } else {
      setCurrentAttachmentInEdit(null);
      setEditTextContent(currentContent);
    }
    setStagedEditFile(null);
  };

  const handleSaveEditedMessage = async () => {
    console.log("Staff: handleSaveEditedMessage called. Initial isSendingMessage:", isSendingMessage);
    if (!messageEditState || !staffSession || !activeConversation?.id) return;
    console.log("Staff: Setting isSendingMessage to true for edit");
    setIsSendingMessage(true);

    let finalContent = editTextContent.trim();
    const fileToUse = stagedEditFile || currentAttachmentInEdit;

    if (fileToUse) {
      const encodedName = encodeURIComponent(fileToUse.name);
      const fileString = `${fileToUse.dataUri}#filename=${encodedName}`;
      finalContent = finalContent ? `${fileString}\n${finalContent}` : fileString;
    }

    if (!finalContent && !fileToUse) {
      toast({ title: "Không có nội dung", description: "Tin nhắn không thể để trống.", variant: "destructive" });
      setIsSendingMessage(false);
      console.log("Staff: Setting isSendingMessage to false in edit (empty content)");
      return;
    }

    try {
      const updatedMessage = await editStaffMessage(messageEditState.messageId, finalContent, staffSession);
      if (updatedMessage) {
        setMessages(prev => prev.map(m => m.id === updatedMessage.id ? {...updatedMessage, timestamp: new Date(updatedMessage.timestamp)} : m));
        // fetchPinnedMessagesForConversation will be called by its own useEffect if activeConversation's pinnedMessageIds changed
        if (socket && isConnected) {
          socket.emit('editMessage', { message: updatedMessage, conversationId: activeConversation.id });
        }
        toast({ title: "Thành công", description: "Đã sửa tin nhắn." });
      }
      setMessageEditState(null);
      setEditTextContent('');
      setCurrentAttachmentInEdit(null);
      setStagedEditFile(null);
    } catch (error: any) {
      toast({ title: "Lỗi sửa tin nhắn", description: error.message, variant: "destructive" });
    } finally {
      console.log("Staff: Setting isSendingMessage to false in edit finally block");
      setIsSendingMessage(false);
    }
  };

  const handleEditFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "Tệp quá lớn", description: `Kích thước tệp không được vượt quá ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if(editFileInputRef.current) editFileInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setStagedEditFile({ dataUri: reader.result as string, name: file.name, type: file.type });
          setCurrentAttachmentInEdit(null);
        }
        if(editFileInputRef.current) editFileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!staffSession || !activeConversation?.id) return;
    try {
      const result = await deleteStaffMessage(messageId, staffSession);
      if (result.success) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        // fetchPinnedMessagesForConversation will be called by its own useEffect
        if (socket && isConnected) {
          socket.emit('deleteMessage', { messageId, conversationId: activeConversation.id });
        }
        toast({ title: "Thành công", description: "Đã xóa tin nhắn." });
        if (result.conversationId === activeConversation.id && customer?.lastMessagePreview && messages.find(m=>m.id === messageId)?.content.startsWith(customer.lastMessagePreview)) {
            fetchChatData();
        }
      }
    } catch (error: any) {
      toast({ title: "Lỗi xóa tin nhắn", description: error.message, variant: "destructive" });
    }
  };

  const handlePinRequested = (messageId: string) => {
    if (!socket || !isConnected || !activeConversation?.id || !staffSession) return;
    socket.emit('pinMessageRequested', { // Changed from pinMessage
        conversationId: activeConversation.id,
        messageId,
        userSessionJsonString: JSON.stringify(staffSession)
    });
  };

  const handleUnpinRequested = (messageId: string) => {
    if (!socket || !isConnected || !activeConversation?.id || !staffSession) return;
    socket.emit('unpinMessageRequested', { // Changed from unpinMessage
        conversationId: activeConversation.id,
        messageId,
        userSessionJsonString: JSON.stringify(staffSession)
    });
  };

  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(messageId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('bg-yellow-200', 'dark:bg-yellow-700', 'transition-all', 'duration-1000');
      setTimeout(() => {
        element.classList.remove('bg-yellow-200', 'dark:bg-yellow-700');
      }, 2000);
    }
  };

  const handleAssignToSelf = async () => {
    if (!customer || !staffSession) return;
    setIsAssigning(true);
    try {
      const updatedCustomer = await assignStaffToCustomer(customer.id, staffSession.id);
      setCustomer(updatedCustomer);
      toast({ title: "Thành công", description: `Khách hàng đã được giao cho bạn.`});
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive"});
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAssignToSelectedStaff = async () => {
    if (!customer || !staffSession || staffSession.role !== 'admin' || !selectedStaffToAssign) return;
    setIsAssigning(true);
    try {
      const updatedCustomer = await assignStaffToCustomer(customer.id, selectedStaffToAssign);
      setCustomer(updatedCustomer);
      toast({ title: "Thành công", description: `Khách hàng đã được giao cho nhân viên đã chọn.`});
      setSelectedStaffToAssign('');
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive"});
    } finally {
      setIsAssigning(false);
    }
  }

  const handleUnassign = async () => {
    if (!customer || !staffSession) return;
    setIsAssigning(true);
    try {
      if (staffSession.role === 'admin' || customer.assignedStaffId === staffSession.id) {
        const updatedCustomer = await unassignStaffFromCustomer(customer.id);
        setCustomer(updatedCustomer);
        toast({ title: "Thành công", description: `Khách hàng đã được đưa trở lại hàng đợi chung.`});
      } else {
        toast({ title: "Không được phép", description: "Bạn không được phép thực hiện hành động này.", variant: "destructive"});
      }
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive"});
    } finally {
      setIsAssigning(false);
    }
  }

  const handleAddTag = async () => {
    if (!customer || !newTagName.trim() || !staffSession) return;
    if (newTagName.toLowerCase().startsWith("admin:") && staffSession.role !== 'admin') {
       toast({title: "Thông báo", description: "Chỉ Admin mới có thể mời Admin khác bằng tag."});
       return;
    }

    try {
        const updatedCustomer = await addTagToCustomer(customer.id, newTagName.trim());
        setCustomer(updatedCustomer);
        setNewTagName('');
        toast({title: "Thành công", description: "Đã thêm nhãn."});
    } catch (error: any) {
        toast({title: "Lỗi", description: `Không thể thêm nhãn: ${error.message}`, variant: "destructive"});
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!customer || !staffSession) return;
    try {
        const updatedCustomer = await removeTagFromCustomer(customer.id, tagToRemove);
        setCustomer(updatedCustomer);
        toast({title: "Thành công", description: "Đã xóa nhãn."});
    } catch (error: any) {
        toast({title: "Lỗi", description: `Không thể xóa nhãn: ${error.message}`, variant: "destructive"});
    }
  };

  const handleSaveInternalName = async () => {
    if (!customer || !staffSession) return;
    setEditingInternalName(false);
    if (customer.internalName === internalNameInput.trim()) return;

    try {
        const updatedCustomer = await updateCustomerInternalName(customer.id, internalNameInput.trim());
        setCustomer(updatedCustomer);
        toast({title: "Thành công", description: "Đã cập nhật tên nội bộ."});
    } catch (error: any) {
        toast({title: "Lỗi", description: `Không thể cập nhật tên nội bộ: ${error.message}`, variant: "destructive"});
        setInternalNameInput(customer.internalName || '');
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !customer || !staffSession) return;
    try {
      const newNote = await addNoteToCustomer(customer.id, staffSession.id, newNoteContent.trim());
      setNotes(prev => [newNote, ...prev]);
      setNewNoteContent('');
      toast({ title: "Thành công", description: "Đã thêm ghi chú." });
    } catch (error: any) {
      toast({ title: "Lỗi", description: `Không thể thêm ghi chú: ${error.message}`, variant: "destructive" });
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setEditingNoteContent(note.content);
  };

  const handleSaveEditedNote = async () => {
    if (!editingNote || !staffSession || !editingNoteContent.trim()) return;
    try {
      const updatedNote = await updateCustomerNote(editingNote.id, staffSession.id, editingNoteContent.trim());
      if (updatedNote) {
        setNotes(prevNotes => prevNotes.map(n => n.id === updatedNote.id ? updatedNote : n));
      }
      setEditingNote(null);
      setEditingNoteContent('');
      toast({ title: "Thành công", description: "Đã cập nhật ghi chú." });
    } catch (error: any) {
      toast({ title: "Lỗi", description: `Không thể cập nhật ghi chú: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!staffSession) return;
    try {
      await deleteCustomerNote(noteId, staffSession.id);
      setNotes(prevNotes => prevNotes.filter(n => n.id !== noteId));
      toast({ title: "Thành công", description: "Đã xóa ghi chú." });
    } catch (error: any) {
      toast({ title: "Lỗi", description: `Không thể xóa ghi chú: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDirectBookAppointment = async (formData: AppointmentBookingFormData) => {
    if (!staffSession || !customer ) return;
    setIsSendingMessage(true);
    try {
      const result = await handleBookAppointmentFromForm({...formData, customerId: customer.id });
      toast({
        title: result.success ? "Thành công" : "Thất bại",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });

      let systemMessageContent = result.message;
      if (!result.success && result.suggestedSlots && result.suggestedSlots.length > 0) {
        systemMessageContent += "\nCác khung giờ gợi ý khác:\n" +
          result.suggestedSlots.map(s => `- ${s.date} lúc ${s.time}`).join("\n");
      }

      if (activeConversation?.id) {
        const systemMessage: Message = {
          id: `msg_system_booking_staff_${Date.now()}`,
          sender: 'system',
          content: systemMessageContent,
          timestamp: new Date(),
          conversationId: activeConversation.id,
        };
        setMessages(prev => [...prev, systemMessage]);
        if (socket && isConnected) {
          socket.emit('sendMessage', { message: systemMessage, conversationId: activeConversation.id });
        }
      }

      if(result.success) {
        setIsBookingModalOpen(false);
        fetchChatData();
      }

    } catch (error: any) {
      toast({ title: "Lỗi đặt lịch", description: error.message || "Không thể đặt lịch hẹn.", variant: "destructive" });
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (isLoading && !customer && !staffSession) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary"/> <p className="ml-2">Đang tải dữ liệu...</p></div>;
  }

  if (!staffSession) {
    return <div className="flex items-center justify-center h-full"><p>Không tìm thấy phiên làm việc. Vui lòng đăng nhập lại.</p></div>;
  }
  if (isLoading && !customer) {
     return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary"/> <p className="ml-2">Đang tải thông tin khách hàng...</p></div>;
  }
  if (!customer) {
    return <div className="flex flex-col items-center justify-center h-full"><p>Không tìm thấy thông tin khách hàng cho ID: {customerId}.</p></div>;
  }
  if (!activeConversation) {
     // This case can happen if a customer exists but has no conversations,
     // or if the first conversation failed to load. Provide a user-friendly message.
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">
          Đang tải hoặc tạo cuộc trò chuyện...
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Nếu chờ quá lâu, vui lòng thử tải lại trang hoặc kiểm tra lại danh sách khách hàng.
        </p>
      </div>
    );
  }


  const getStatusLabel = (status: AppointmentDetails['status']) => {
    switch (status) {
      case 'booked': return 'Đã đặt';
      case 'completed': return 'Hoàn thành';
      case 'cancelled': return 'Đã hủy';
      case 'pending_confirmation': return 'Chờ xác nhận';
      case 'rescheduled': return 'Đã đổi lịch';
      default: return status;
    }
  };

  const imageMedia = allMediaMessages.filter(msg => isImageDataURI(msg.content));
  const fileMedia = allMediaMessages.filter(msg => !isImageDataURI(msg.content));
  const mediaViewPath = staffSession?.role === 'admin' ? `/admin/media/${customerId}` : `/staff/media/${customerId}`;


  return (
    <div className="flex flex-col md:flex-row h-full gap-0 md:gap-0 md:max-w-screen-lg md:mx-auto">
      <Card className="flex-grow h-full flex flex-col rounded-none md:rounded-none border-none md:border-none">
        <CardHeader className="flex flex-row items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={`https://placehold.co/40x40.png?text=${(customer.internalName || customer.name || customer.phoneNumber).charAt(0)}`} data-ai-hint="profile avatar"/>
              <AvatarFallback>{(customer.internalName || customer.name || customer.phoneNumber).charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{customer.internalName || customer.name || customer.phoneNumber}</CardTitle>
              <p className="text-xs text-muted-foreground">Hoạt động cuối: {format(new Date(customer.lastInteractionAt), 'HH:mm dd/MM/yy', { locale: vi })}
                {customer.assignedStaffId ? ` (Giao cho: ${customer.assignedStaffId === staffSession?.id ? 'Bạn' : customer.assignedStaffName || 'NV khác'})` : "(Chưa giao)"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {staffSession?.role === 'staff' && !customer.assignedStaffId && (
              <Button variant="outline" size="sm" onClick={handleAssignToSelf} disabled={isAssigning}>
                <UserCheck className="mr-1 h-4 w-4"/> {isAssigning ? "Đang nhận..." : "Nhận xử lý"}
              </Button>
            )}
             {staffSession?.role === 'staff' && customer.assignedStaffId === staffSession?.id && (
                 <Button variant="outline" size="sm" onClick={handleUnassign} disabled={isAssigning}>
                     <LogOutIcon className="mr-1 h-4 w-4"/> {isAssigning ? "Đang trả..." : "Trả về hàng đợi"}
                 </Button>
            )}
          </div>
        </CardHeader>

        <ChatWindow
          userSession={staffSession}
          messages={messages}
          pinnedMessages={pinnedMessages}
          suggestedReplies={[]}
          onSendMessage={handleSendMessage}
          onSuggestedReplyClick={() => {}}
          isLoading={isSendingMessage}
          viewerRole={staffSession.role}
          onPinRequested={handlePinRequested}
          onUnpinRequested={handleUnpinRequested}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
          currentStaffSessionId={staffSession.id}
          currentUserSessionId={customer.id}
          quickReplies={quickReplies}
          typingUsers={typingUsers}
          onTyping={onTyping}
          onScrollToMessage={handleScrollToMessage}
          activeConversationId={activeConversation?.id}
          activeConversationPinnedMessageIds={activeConversation?.pinnedMessageIds || []}
          onBookAppointmentClick={() => setIsBookingModalOpen(true)}
        />
      </Card>

      <Card className="w-full md:max-w-xs lg:max-w-sm xl:max-w-md h-full flex-col hidden md:flex rounded-none md:rounded-none border-none md:border-l">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center"><Info className="mr-2 h-5 w-5" /> Thông tin Khách hàng</CardTitle>
        </CardHeader>
        <ScrollArea className="flex-grow">
          <CardContent className="p-4 space-y-4">
            {staffSession?.role === 'admin' && (
              <div className="border-b pb-3 mb-3">
                <h4 className="font-semibold text-sm flex items-center mb-1"><Users className="mr-2 h-4 w-4 text-primary" />Phân công</h4>
                {customer.assignedStaffId ? (
                  <div className="flex items-center justify-between text-xs">
                    <span>Đang xử lý: {customer.assignedStaffName || customer.assignedStaffId}</span>
                     <Button variant="outline" size="xs" onClick={handleUnassign} disabled={isAssigning}>
                        {isAssigning ? "Đang hủy..." : "Hủy giao"}
                     </Button>
                  </div>
                ) : <p className="text-xs text-muted-foreground mb-1">Khách chưa được giao.</p>}
                <div className="flex gap-1 mt-1">
                    <Select value={selectedStaffToAssign} onValueChange={setSelectedStaffToAssign} >
                        <SelectTrigger className="h-7 text-xs flex-grow" disabled={isAssigning}>
                            <SelectValue placeholder="Chọn nhân viên để giao" />
                        </SelectTrigger>
                        <SelectContent>
                            {allStaff.map(staff => (
                                <SelectItem key={staff.id} value={staff.id} className="text-xs">{staff.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button size="sm" onClick={handleAssignToSelectedStaff} className="h-7 text-xs px-2 shrink-0" disabled={!selectedStaffToAssign || isAssigning}>
                        {isAssigning ? "Đang giao..." : "Giao"}
                    </Button>
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-sm flex items-center mb-1"><UserCircle className="mr-2 h-4 w-4 text-primary" />Chi tiết</h4>
              <p className="text-xs"><span className="text-muted-foreground">Điện thoại:</span> {customer.phoneNumber}</p>
              <div className="text-xs flex items-center">
                <span className="text-muted-foreground mr-1">Tên nội bộ:</span>
                {editingInternalName ? (
                    <Input
                        value={internalNameInput}
                        onChange={(e) => setInternalNameInput(e.target.value)}
                        onBlur={handleSaveInternalName}
                        onKeyPress={(e) => { if (e.key === 'Enter') handleSaveInternalName(); }}
                        className="h-6 text-xs p-1"
                        autoFocus
                    />
                ) : (
                    <span className="truncate max-w-[150px]">{customer.internalName || 'Chưa có'}</span>
                )}
                 <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 shrink-0" onClick={() => setEditingInternalName(!editingInternalName)}><Edit2 className="h-3 w-3"/></Button>
              </div>
              <div>
                <h5 className="font-semibold text-xs mt-2 mb-1 flex items-center"><Tag className="mr-2 h-3 w-3 text-primary" />Nhãn</h5>
                <div className="flex flex-wrap gap-1 mb-2">
                    {(customer.tags || []).map(tag => (
                        <span key={tag} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center">
                            {tag}
                            <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 p-0 hover:bg-blue-200" onClick={() => handleRemoveTag(tag)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </span>
                    ))}
                     {customer.tags?.includes(`Admin:${staffSession?.name}`) && staffSession?.role === 'admin' && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Đã mời Admin</span>
                    )}
                </div>
                <div className="flex gap-1">
                    <Input
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Thêm nhãn mới (vd: Admin:TênAdmin)"
                        className="h-7 text-xs"
                        onKeyPress={(e) => { if (e.key === 'Enter') handleAddTag(); }}
                    />
                    <Button size="sm" onClick={handleAddTag} className="h-7 text-xs px-2 shrink-0">Thêm</Button>
                </div>
              </div>
            </div>

            <Accordion type="multiple" className="w-full">
              <AccordionItem value="media-history">
                <AccordionTrigger className="text-sm font-semibold py-2 hover:no-underline">
                  <div className="flex items-center"><ImageIconLucide className="mr-2 h-4 w-4 text-primary"/>Ảnh/Video ({imageMedia.length})</div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-2">
                  {imageMedia.length > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        {imageMedia.slice(0, 6).map(msg => {
                          const match = msg.content.match(/^(data:image\/[^;]+;base64,[^#]+)/);
                          if (!match) return null;
                          const dataUri = match[1];
                          return (
                            <div key={msg.id} className="aspect-square relative rounded overflow-hidden bg-muted">
                              <NextImage src={dataUri} alt="media thumbnail" layout="fill" objectFit="cover" data-ai-hint="thumbnail image"/>
                            </div>
                          );
                        })}
                      </div>
                      {imageMedia.length > 6 && (
                        <Button variant="link" size="sm" className="p-0 h-auto text-xs w-full justify-center" asChild>
                          <Link href={mediaViewPath}>Xem tất cả {imageMedia.length} ảnh/video</Link>
                        </Button>
                      )}
                       {imageMedia.length > 0 && imageMedia.length <= 6 && (
                          <Button variant="link" size="sm" className="p-0 h-auto text-xs w-full justify-center" asChild>
                            <Link href={mediaViewPath}>Xem chi tiết</Link>
                          </Button>
                       )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">Chưa có ảnh/video nào.</p>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="file-history">
                 <AccordionTrigger className="text-sm font-semibold py-2 hover:no-underline">
                    <div className="flex items-center"><FileText className="mr-2 h-4 w-4 text-primary"/>File ({fileMedia.length})</div>
                 </AccordionTrigger>
                <AccordionContent className="pt-1 pb-2">
                   {fileMedia.length > 0 ? (
                    <>
                      <div className="space-y-1 mb-2 max-h-32 overflow-y-auto">
                        {fileMedia.map(msg => {
                          const match = msg.content.match(/#filename=([^#\s]+)/);
                          const fileName = match ? decodeURIComponent(match[1]) : "Tệp đính kèm";
                          return (
                            <a
                              key={msg.id}
                              href={msg.content.split('#filename=')[0]}
                              download={fileName}
                              className="flex items-center gap-1.5 p-1.5 hover:bg-accent rounded text-xs"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0"/>
                              <span className="truncate" title={fileName}>{fileName}</span>
                            </a>
                          );
                        })}
                      </div>
                      {fileMedia.length > 0 && (
                        <Button variant="link" size="sm" className="p-0 h-auto text-xs w-full justify-center" asChild>
                          <Link href={mediaViewPath}>Xem tất cả file</Link>
                        </Button>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">Chưa có file nào.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm flex items-center mb-1"><Clock className="mr-2 h-4 w-4 text-primary" />Lịch hẹn ({appointments.length})</h4>
              {appointments.slice(0,2).map(appt => (
                <div key={appt.appointmentId} className="text-xs p-1.5 bg-muted/50 rounded mb-1">
                    <p>{appt.service} - {format(new Date(appt.date), 'dd/MM/yy', { locale: vi })} lúc {appt.time} ({getStatusLabel(appt.status)})</p>
                </div>
              ))}
              {appointments.length > 2 && staffSession &&
                <Button variant="link" size="sm" className="p-0 h-auto text-primary" asChild>
                    <Link href={staffSession.role === 'admin' ? '/admin/appointments/view' : '/staff/appointments'}>
                        Xem tất cả
                    </Link>
                </Button>
              }
            </div>
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm flex items-center mb-1"><StickyNote className="mr-2 h-4 w-4 text-primary" />Ghi chú nội bộ ({notes.length})</h4>
              <div className="space-y-2 mb-2 max-h-48 overflow-y-auto">
                {notes.map(note => (
                  <div key={note.id} className="text-xs p-1.5 bg-muted/50 rounded">
                    {editingNote?.id === note.id ? (
                      <>
                        <Textarea
                            value={editingNoteContent}
                            onChange={e => setEditingNoteContent(e.target.value)}
                            rows={2}
                            className="text-xs mb-1"
                        />
                        <div className="flex gap-1 justify-end">
                            <Button size="xs" variant="ghost" onClick={() => setEditingNote(null)}>Hủy</Button>
                            <Button size="xs" onClick={handleSaveEditedNote}>Lưu</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap">{note.content}</p>
                        <div className="flex justify-between items-center mt-1">
                            <p className="text-muted-foreground">{note.staffName || 'Nhân viên'} - {format(new Date(note.createdAt), 'dd/MM HH:mm', { locale: vi })}</p>
                            {note.staffId === staffSession?.id && (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleEditNote(note)}><Edit2 className="h-3 w-3"/></Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3"/></Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa ghi chú</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa ghi chú này?</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteNote(note.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <Textarea
                placeholder="Thêm ghi chú nội bộ mới..."
                rows={2}
                className="text-xs"
                value={newNoteContent}
                onChange={e => setNewNoteContent(e.target.value)}
              />
              <Button size="sm" className="mt-1 w-full" onClick={handleAddNote} disabled={!newNoteContent.trim()}>
                <PlusCircle className="mr-1 h-3 w-3"/>Thêm Ghi chú
              </Button>
            </div>
          </CardContent>
        </ScrollArea>
      </Card>

      <Dialog open={messageEditState !== null} onOpenChange={(isOpen) => { if (!isOpen) { setMessageEditState(null); setCurrentAttachmentInEdit(null); setStagedEditFile(null); setEditTextContent('');}}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sửa Tin nhắn</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {(stagedEditFile || currentAttachmentInEdit) && (
              <div className="border rounded-md p-2">
                <Label className="text-xs text-muted-foreground">Tệp đính kèm hiện tại/mới:</Label>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2 text-sm overflow-hidden">
                    {(stagedEditFile || currentAttachmentInEdit)?.type?.startsWith('image/') ? (
                       <NextImage data-ai-hint="image file attachment" src={(stagedEditFile || currentAttachmentInEdit)!.dataUri} alt={(stagedEditFile || currentAttachmentInEdit)!.name} width={40} height={40} className="rounded object-cover flex-shrink-0" />
                    ) : (
                      <FileText className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="truncate" title={(stagedEditFile || currentAttachmentInEdit)!.name}>{(stagedEditFile || currentAttachmentInEdit)!.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setStagedEditFile(null); setCurrentAttachmentInEdit(null); }} title="Gỡ bỏ tệp đính kèm">
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="editMessageContent" className="text-xs text-muted-foreground">Nội dung tin nhắn (tùy chọn nếu có tệp):</Label>
              <Textarea
                id="editMessageContent"
                value={editTextContent}
                onChange={(e) => setEditTextContent(e.target.value)}
                rows={3}
                autoFocus
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="editFileAttachment" className="text-xs text-muted-foreground">Thay đổi/Thêm tệp đính kèm mới:</Label>
              <Input
                id="editFileAttachment"
                type="file"
                ref={editFileInputRef}
                onChange={handleEditFileChange}
                className="mt-1 text-sm"
                accept="image/*,application/pdf,.doc,.docx,.txt,.xls,.xlsx"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setMessageEditState(null); setCurrentAttachmentInEdit(null); setStagedEditFile(null); setEditTextContent(''); }}>Hủy</Button>
            <Button type="button" onClick={handleSaveEditedMessage} disabled={isSendingMessage || (!editTextContent.trim() && !stagedEditFile && !currentAttachmentInEdit)}>
              {isSendingMessage ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {staffSession && customer && (
         <AppointmentBookingForm
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          onSubmit={handleDirectBookAppointment}
          currentUserSession={staffSession}
        />
      )}
    </div>
  );
}
