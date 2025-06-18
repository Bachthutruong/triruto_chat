// src/app/staff/chat/[customerId]/page.tsx
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import NextImage from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Paperclip, Smile, UserCircle, Edit2, Tag, Clock, Phone, Info, X, StickyNote, PlusCircle, Trash2, UserPlus, LogOutIcon, UserCheck, Users, Pin, PinOff, Edit, Image as ImageIconLucide, ExternalLink, FileText, Download, Zap, MoreVertical, CalendarPlus, Loader2, Bell } from 'lucide-react';
import type { CustomerProfile, Message, AppointmentDetails, UserSession, Note, MessageEditState, Conversation, QuickReplyType, AppointmentBookingFormData, MessageViewerRole } from '@/lib/types';
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
  getCustomerMediaMessages,
  getAllReminders,
  createReminder,
  updateReminder,
  deleteReminder,
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
import { ReminderService } from '@/lib/services/reminder.service';
import mongoose from 'mongoose';
import { IReminder } from '@/models/Reminder.model';
import { Badge } from '@/components/ui/badge';

// New imports for product assignment
import { getAllProducts } from '@/app/actions';
import type { ProductItem, CustomerProduct, CreateInvoiceData } from '@/lib/types';
import { Package, Calendar } from 'lucide-react';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_NOTE_IMAGE_SIZE_MB = 2;
const MAX_NOTE_IMAGE_SIZE_BYTES = MAX_NOTE_IMAGE_SIZE_MB * 1024 * 1024;


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

  // State for sidebar image preview
  const [selectedSidebarImagePreview, setSelectedSidebarImagePreview] = useState<string | null>(null);
  const [selectedSidebarImageName, setSelectedSidebarImageName] = useState<string>('');

  // Note states
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteImageDataUri, setNewNoteImageDataUri] = useState<string | undefined>(undefined);
  const [newNoteImageFileName, setNewNoteImageFileName] = useState<string | undefined>(undefined);
  const newNoteImageInputRef = useRef<HTMLInputElement>(null);

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [editingNoteImageDataUri, setEditingNoteImageDataUri] = useState<string | undefined | null>(undefined); // null means remove
  const [editingNoteImageFileName, setEditingNoteImageFileName] = useState<string | undefined | null>(undefined);
  const editNoteImageInputRef = useRef<HTMLInputElement>(null);


  const [allStaff, setAllStaff] = useState<{ id: string, name: string }[]>([]);
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

  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDescription, setReminderDescription] = useState('');
  const [reminderDueDate, setReminderDueDate] = useState('');
  const [reminderPriority, setReminderPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [reminderType, setReminderType] = useState<'one_time' | 'recurring'>('one_time');
  const [reminderIntervalType, setReminderIntervalType] = useState<'days' | 'weeks' | 'months'>('days');
  const [reminderIntervalValue, setReminderIntervalValue] = useState(1);

  const [reminders, setReminders] = useState<any[]>([]);
  const [editingReminder, setEditingReminder] = useState<any | null>(null);

  const [isCustomerInfoOpen, setIsCustomerInfoOpen] = useState(false);

  // New state for product assignment
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [customerProducts, setCustomerProducts] = useState<CustomerProduct[]>([]);
  const [isCreateProductDialogOpen, setIsCreateProductDialogOpen] = useState(false);
  const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);
  const [editingCustomerProduct, setEditingCustomerProduct] = useState<CustomerProduct | null>(null);
  const [createProductForm, setCreateProductForm] = useState<CreateInvoiceData[]>([]);
  const [editProductForm, setEditProductForm] = useState({
    productName: '',
    totalSessions: 1,
    usedSessions: 0,
    expiryDays: undefined as number | undefined,
    notes: '',
    isActive: true
  });

  const [productSearchTerm, setProductSearchTerm] = useState('');

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

  // Handler for opening image preview from the sidebar/drawer
  const handleSidebarImageClick = (dataUri: string, fileName: string) => {
    setSelectedSidebarImagePreview(dataUri);
    setSelectedSidebarImageName(fileName);
  };


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
          setMessages((fetchedMessages || []).map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
          fetchPinnedMessagesForConversation(currentActiveConv);
        } else {
          setMessages([]);
          setPinnedMessages([]);
        }

        if (fetchedCustomer && fetchedCustomer.interactionStatus === 'unread' && staffSession.role !== 'customer') {
          await markCustomerInteractionAsReadByStaff(customerId, staffSession.id);
          setCustomer(prev => prev ? { ...prev, interactionStatus: 'read' } : null);
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

  // New data fetching function for products and customer products
  const fetchProductData = useCallback(async () => {
    if (!staffSession || !customer?.id) return;
    try {
      const [productsData, customerProductsData] = await Promise.all([
        getAllProducts(),
        fetchCustomerProductsForCustomer(customer.id)
      ]);
      setProducts(productsData);
      setCustomerProducts(customerProductsData);
    } catch (error) {
      console.error('Error fetching product data:', error);
      toast({ title: "Lỗi", description: "Không thể tải dữ liệu sản phẩm/dịch vụ của khách hàng.", variant: "destructive" });
    }
  }, [staffSession, customer?.id, toast]);

  // New function to fetch customer products for a specific customer
  const fetchCustomerProductsForCustomer = async (custId: string) => {
    try {
      const response = await fetch(`/api/customer-products?customerId=${custId}`);
      const data = await response.json();
      if (data.success) {
        return data.data;
      } else {
        console.error('Error fetching customer products for customer:', data.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching customer products for customer:', error);
      throw error;
    }
  };

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

  // Fetch product data when customer and staffSession are available
  useEffect(() => {
    if (customer && staffSession) {
      fetchProductData();
    }
  }, [customer, staffSession, fetchProductData]);

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
    if (activeConversation) {
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
          return [...prev, { ...newMessage, timestamp: new Date(newMessage.timestamp) }];
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
        setMessages(prev => prev.map(m => m.id === editedMessage.id ? { ...editedMessage, timestamp: new Date(editedMessage.timestamp) } : m));
        setPinnedMessages(prev => prev.map(pm => pm.id === editedMessage.id ? { ...editedMessage, timestamp: new Date(editedMessage.timestamp) } : pm));
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
    console.log("Staff: handleSendMessage called with content:", messageContent.substring(0, 50) + "...");
    if (!messageContent.trim() || !customer || !staffSession || !activeConversation?.id) {
      toast({ title: "Lỗi", description: "Không thể gửi tin nhắn. Thiếu thông tin khách hàng, phiên làm việc hoặc cuộc trò chuyện.", variant: "destructive" });
      console.error("Staff: Send message precondition failed.", { customer, staffSession, activeConversationId: activeConversation?.id, messageContent });
      return;
    }
    setIsSendingMessage(true);
    console.log("Staff: Variables before calling sendStaffMessage:", { staffSessionId: staffSession.id, customerId: customer.id, conversationId: activeConversation.id });

    if (socket && isConnected && onTyping) onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      const sentMessage = await sendStaffMessage(staffSession!, customer!.id, activeConversation!.id, messageContent);
      console.log("Staff: Message object received from action to add to state:", sentMessage);
      if (sentMessage && sentMessage.id) {
        setMessages(prev => [...prev, { ...sentMessage, timestamp: new Date(sentMessage.timestamp) }]);
        // Optimistically update customer/conversation for UI responsiveness
        setCustomer(prev => prev ? { ...prev, interactionStatus: 'replied_by_staff', lastMessagePreview: messageContent.substring(0, 100), lastMessageTimestamp: new Date(sentMessage.timestamp) } : null);
        setActiveConversation(prev => prev ? { ...prev, lastMessagePreview: messageContent.substring(0, 100), lastMessageTimestamp: new Date(sentMessage.timestamp) } : null);

        // Sau khi gửi tin nhắn, cập nhật lại media (sidebar)
        if (customer) {
          try {
            const updatedMedia = await getCustomerMediaMessages(customer.id);
            console.log('[handleSendMessage] Updated media count:', updatedMedia.length);
            setAllMediaMessages(updatedMedia || []);
          } catch (error) {
            console.error('[handleSendMessage] Error updating media:', error);
          }
        }

        if (socket && isConnected) {
          socket.emit('sendMessage', { message: sentMessage, conversationId: activeConversation.id });
          console.log("Staff: Emitting sendMessage via socket:", sentMessage, activeConversation.id);
        }
      } else {
        console.error("Staff: sendStaffMessage action did not return a valid message object. Returned:", sentMessage);
        toast({ title: "Lỗi", description: "Không thể gửi tin nhắn. Phản hồi từ server không hợp lệ.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Staff: Error sending message:", error);
      toast({ title: "Lỗi gửi tin nhắn", description: error.message || "Có lỗi xảy ra khi gửi tin nhắn.", variant: "destructive" });
    } finally {
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
    if (!messageEditState || !staffSession || !activeConversation?.id) return;
    setIsSendingMessage(true); // Use isSendingMessage to disable input during edit save

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
      return;
    }

    try {
      const updatedMessage = await editStaffMessage(messageEditState.messageId, finalContent, staffSession);
      if (updatedMessage) {
        setMessages(prev => prev.map(m => m.id === updatedMessage.id ? { ...updatedMessage, timestamp: new Date(updatedMessage.timestamp) } : m));
        setPinnedMessages(prev => prev.map(pm => pm.id === updatedMessage.id ? { ...updatedMessage, timestamp: new Date(updatedMessage.timestamp) } : pm));
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
      setIsSendingMessage(false);
    }
  };

  const handleEditFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "Tệp quá lớn", description: `Kích thước tệp không được vượt quá ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        if (editFileInputRef.current) editFileInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setStagedEditFile({ dataUri: reader.result as string, name: file.name, type: file.type });
          setCurrentAttachmentInEdit(null);
        }
        if (editFileInputRef.current) editFileInputRef.current.value = "";
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
        setPinnedMessages(prev => prev.filter(pm => pm.id !== messageId));
        if (socket && isConnected) {
          socket.emit('deleteMessage', { messageId, conversationId: activeConversation.id });
        }
        toast({ title: "Thành công", description: "Đã xóa tin nhắn." });
        // If deleted message was the last one, refetch to update preview
        if (result.conversationId === activeConversation.id && customer?.lastMessagePreview && messages.find(m => m.id === messageId)?.content.startsWith(customer.lastMessagePreview)) {
          fetchChatData();
        }
      }
    } catch (error: any) {
      toast({ title: "Lỗi xóa tin nhắn", description: error.message, variant: "destructive" });
    }
  };

  const handlePinRequested = (messageId: string) => {
    if (!socket || !isConnected || !activeConversation?.id || !staffSession) return;
    console.log(`Staff: Requesting to pin message ${messageId} in conv ${activeConversation.id}`);
    socket.emit('pinMessageRequested', {
      conversationId: activeConversation.id,
      messageId,
      userSessionJsonString: JSON.stringify(staffSession)
    });
  };

  const handleUnpinRequested = (messageId: string) => {
    if (!socket || !isConnected || !activeConversation?.id || !staffSession) return;
    console.log(`Staff: Requesting to unpin message ${messageId} in conv ${activeConversation.id}`);
    socket.emit('unpinMessageRequested', {
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
      toast({ title: "Thành công", description: `Khách hàng đã được giao cho bạn.` });
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
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
      toast({ title: "Thành công", description: `Khách hàng đã được giao cho nhân viên đã chọn.` });
      setSelectedStaffToAssign('');
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
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
        toast({ title: "Thành công", description: `Khách hàng đã được đưa trở lại hàng đợi chung.` });
      } else {
        toast({ title: "Không được phép", description: "Bạn không được phép thực hiện hành động này.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } finally {
      setIsAssigning(false);
    }
  }

  const handleAddTag = async () => {
    if (!customer || !newTagName.trim() || !staffSession) return;
    if (newTagName.toLowerCase().startsWith("admin:") && staffSession.role !== 'admin') {
      toast({ title: "Thông báo", description: "Chỉ Admin mới có thể mời Admin khác bằng tag." });
      return;
    }

    try {
      const updatedCustomer = await addTagToCustomer(customer.id, newTagName.trim());
      setCustomer(updatedCustomer);
      setNewTagName('');
      toast({ title: "Thành công", description: "Đã thêm nhãn." });
    } catch (error: any) {
      toast({ title: "Lỗi", description: `Không thể thêm nhãn: ${error.message}`, variant: "destructive" });
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!customer || !staffSession) return;
    try {
      const updatedCustomer = await removeTagFromCustomer(customer.id, tagToRemove);
      setCustomer(updatedCustomer);
      toast({ title: "Thành công", description: "Đã xóa nhãn." });
    } catch (error: any) {
      toast({ title: "Lỗi", description: `Không thể xóa nhãn: ${error.message}`, variant: "destructive" });
    }
  };

  const handleSaveInternalName = async () => {
    if (!customer || !staffSession) return;
    setEditingInternalName(false);
    if (customer.internalName === internalNameInput.trim()) return;

    try {
      const updatedCustomer = await updateCustomerInternalName(customer.id, internalNameInput.trim());
      setCustomer(updatedCustomer);
      toast({ title: "Thành công", description: "Đã cập nhật tên nội bộ." });
    } catch (error: any) {
      toast({ title: "Lỗi", description: `Không thể cập nhật tên nội bộ: ${error.message}`, variant: "destructive" });
      setInternalNameInput(customer.internalName || '');
    }
  };

  const handleNewNoteImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Lỗi", description: "Chỉ chấp nhận tệp hình ảnh cho ghi chú.", variant: "destructive" });
        if (newNoteImageInputRef.current) newNoteImageInputRef.current.value = "";
        return;
      }
      if (file.size > MAX_NOTE_IMAGE_SIZE_BYTES) {
        toast({ title: "Lỗi", description: `Kích thước ảnh ghi chú không được vượt quá ${MAX_NOTE_IMAGE_SIZE_MB}MB.`, variant: "destructive" });
        if (newNoteImageInputRef.current) newNoteImageInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewNoteImageDataUri(reader.result as string);
        setNewNoteImageFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddNote = async () => {
    if ((!newNoteContent.trim() && !newNoteImageDataUri) || !customer || !staffSession) {
      toast({ title: "Thiếu thông tin", description: "Nội dung ghi chú hoặc hình ảnh là bắt buộc.", variant: "destructive" });
      return;
    }
    try {
      const newNote = await addNoteToCustomer(customer.id, staffSession.id, newNoteContent.trim(), newNoteImageDataUri, newNoteImageFileName);
      setNotes(prev => [newNote, ...prev]);
      setNewNoteContent('');
      setNewNoteImageDataUri(undefined);
      setNewNoteImageFileName(undefined);
      if (newNoteImageInputRef.current) newNoteImageInputRef.current.value = "";
      toast({ title: "Thành công", description: "Đã thêm ghi chú." });
    } catch (error: any) {
      toast({ title: "Lỗi", description: `Không thể thêm ghi chú: ${error.message}`, variant: "destructive" });
    }
  };

  const handleEditNoteImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Lỗi", description: "Chỉ chấp nhận tệp hình ảnh cho ghi chú.", variant: "destructive" });
        if (editNoteImageInputRef.current) editNoteImageInputRef.current.value = "";
        return;
      }
      if (file.size > MAX_NOTE_IMAGE_SIZE_BYTES) {
        toast({ title: "Lỗi", description: `Kích thước ảnh ghi chú không được vượt quá ${MAX_NOTE_IMAGE_SIZE_MB}MB.`, variant: "destructive" });
        if (editNoteImageInputRef.current) editNoteImageInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingNoteImageDataUri(reader.result as string);
        setEditingNoteImageFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveEditingNoteImage = () => {
    setEditingNoteImageDataUri(null); // Signal to remove image
    setEditingNoteImageFileName(null);
    if (editNoteImageInputRef.current) editNoteImageInputRef.current.value = "";
  };


  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setEditingNoteContent(note.content);
    setEditingNoteImageDataUri(note.imageDataUri);
    setEditingNoteImageFileName(note.imageFileName);
  };

  const handleSaveEditedNote = async () => {
    if (!editingNote || !staffSession || (!editingNoteContent.trim() && editingNoteImageDataUri === undefined)) {
      toast({ title: "Thiếu thông tin", description: "Nội dung ghi chú hoặc hình ảnh là bắt buộc khi sửa.", variant: "destructive" });
      return;
    }
    try {
      const updatedNote = await updateCustomerNote(
        editingNote.id,
        staffSession.id,
        editingNoteContent.trim(),
        editingNoteImageDataUri,
        editingNoteImageDataUri ? editingNoteImageFileName : undefined
      );
      if (updatedNote) {
        setNotes(prevNotes => prevNotes.map(n => n.id === updatedNote.id ? updatedNote : n));
      }
      setEditingNote(null);
      setEditingNoteContent('');
      setEditingNoteImageDataUri(undefined);
      setEditingNoteImageFileName(undefined);
      if (editNoteImageInputRef.current) editNoteImageInputRef.current.value = "";
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
    if (!staffSession || !customer) return;
    setIsSendingMessage(true);
    try {
      const result = await handleBookAppointmentFromForm({ ...formData, customerId: customer.id });
      toast({
        title: result.success ? "Thành công" : "Thất bại",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });

      let systemMessageContent = result.message;
      if (!result.success && result.suggestedSlots && result.suggestedSlots.length > 0) {
        systemMessageContent += "\nCác khung giờ gợi ý khác:\n" +
          result.suggestedSlots.map(s => {
            const [year, month, day] = s.date.split('-');
            return `- ${day}/${month}/${year} lúc ${s.time}`;
          }).join("\n");
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

      if (result.success) {
        setIsBookingModalOpen(false);
        fetchChatData();
      }

    } catch (error: any) {
      toast({ title: "Lỗi đặt lịch", description: error.message || "Không thể đặt lịch hẹn.", variant: "destructive" });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await deleteReminder(reminderId);
      setReminders(reminders => reminders.filter(r => r.id !== reminderId));
      toast({ title: 'Thành công', description: 'Đã xóa nhắc nhở.' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message || 'Không thể xóa nhắc nhở.', variant: 'destructive' });
    }
  };

  const handleEditReminder = (reminder: any) => {
    setEditingReminder(reminder);
    setReminderTitle(reminder.title);
    setReminderDescription(reminder.description);
    setReminderDueDate(reminder.dueDate ? new Date(reminder.dueDate).toISOString().slice(0, 16) : '');
    setReminderPriority(reminder.priority || 'medium');
    setReminderType(reminder.reminderType || 'one_time');
    setReminderIntervalType(reminder.interval?.type || 'days');
    setReminderIntervalValue(reminder.interval?.value || 1);
    setIsReminderModalOpen(true);
  };

  const handleCreateOrUpdateReminder = async () => {
    if (!staffSession || !customer) return;
    setIsSendingMessage(true);
    try {
      if (!reminderTitle || !reminderDescription || !reminderDueDate || !reminderPriority || !reminderType) {
        toast({ title: "Thiếu thông tin", description: "Vui lòng điền đầy đủ các trường.", variant: "destructive" });
        setIsSendingMessage(false);
        return;
      }
      const reminderData: any = {
        customerId: customer.id,
        staffId: staffSession.id,
        title: reminderTitle,
        description: reminderDescription,
        dueDate: new Date(reminderDueDate),
        priority: reminderPriority || 'medium',
        reminderType: reminderType || 'one_time',
      };

      if (reminderType === 'recurring') {
        const intervalValueInput = reminderIntervalValue || 1;
        let calculatedIntervalValue: number;

        if (reminderIntervalType === 'days') {
          calculatedIntervalValue = intervalValueInput * 24 * 60 * 60 * 1000; // Convert days to milliseconds
        } else if (reminderIntervalType === 'weeks') {
          calculatedIntervalValue = intervalValueInput * 7 * 24 * 60 * 60 * 1000; // Convert weeks to milliseconds
        } else { // For 'months', assume backend expects number of months
          calculatedIntervalValue = intervalValueInput;
        }

        reminderData.interval = {
          type: reminderIntervalType || 'days',
          value: calculatedIntervalValue
        };
      }

      //@ts-ignore
      let newOrUpdatedReminder;
      if (editingReminder) {
        //@ts-ignore
        newOrUpdatedReminder = await updateReminder(editingReminder.id, reminderData);
        //@ts-ignore
        setReminders(reminders => reminders.map(r => r.id === editingReminder.id ? newOrUpdatedReminder : r));
        toast({ title: 'Thành công', description: 'Đã cập nhật nhắc nhở.' });
      } else {
        //@ts-ignore
        newOrUpdatedReminder = await createReminder(reminderData);
        //@ts-ignore
        setReminders(reminders => [newOrUpdatedReminder, ...reminders]);
        toast({ title: 'Thành công', description: 'Đã tạo nhắc nhở.' });
      }
      setIsReminderModalOpen(false);
      setEditingReminder(null);
      setReminderTitle('');
      setReminderDescription('');
      setReminderDueDate('');
      setReminderPriority('medium');
      setReminderType('one_time');
      setReminderIntervalType('days');
      setReminderIntervalValue(1);
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể tạo/cập nhật nhắc nhở", variant: "destructive" });
    } finally {
      setIsSendingMessage(false);
    }
  };

  useEffect(() => {
    async function fetchReminders() {
      if (!customer) return;
      try {
        const res = await getAllReminders({ customerId: customer.id });
        // Ensure data is plain JSON object
        setReminders(res ? JSON.parse(JSON.stringify(res)) : []);
      } catch (error) {
        setReminders([]);
      }
    }
    fetchReminders();
  }, [customer]);

  // New functions for product assignment
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Không có';
    try {
      return new Date(date).toLocaleDateString('vi-VN');
    } catch {
      return 'Invalid Date';
    }
  };

  const getStatusBadge = (customerProduct: CustomerProduct) => {
    const now = new Date();
    const isExpired = customerProduct.expiryDate && new Date(customerProduct.expiryDate) < now;
    const isFinished = customerProduct.remainingSessions <= 0;

    if (!customerProduct.isActive) {
      return <Badge variant="secondary">Không hoạt động</Badge>;
    }
    if (isExpired) {
      return <Badge variant="destructive">Hết hạn</Badge>;
    }
    if (isFinished) {
      return <Badge variant="outline">Hết buổi</Badge>;
    }
    return <Badge variant="default">Đang hoạt động</Badge>;
  };

  const handleCreateInvoice = async () => {
    if (!customer?.id || !staffSession?.id) {
      toast({
        title: "Thiếu thông tin",
        description: "Đảm bảo thông tin khách hàng/nhân viên đầy đủ.",
        variant: "destructive",
      });
      return;
    }

    // Validate each item in the form
    const isValid = createProductForm.every(item => item.productId && item.totalSessions > 0);
    if (!isValid) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng chọn sản phẩm và nhập số buổi lớn hơn 0 cho tất cả các mục.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true); // Use general loading state
    const results = [];
    for (const item of createProductForm) {
      try {
        const response = await fetch('/api/customer-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customer.id,
            productId: item.productId,
            totalSessions: item.totalSessions,
            expiryDays: item.expiryDays,
            notes: item.notes,
            staffId: staffSession.id
          })
        });

        const data = await response.json();
        results.push({ success: data.success, message: data.message || data.error, product: item.productId });

      } catch (error: any) {
        console.error("Error creating invoice for product:", item.productId, error);
        results.push({ success: false, message: `Lỗi gán sản phẩm ${item.productId}: ${error.message}`, product: item.productId });
      }
    }

    // Summarize results
    const successfulAssignments = results.filter(r => r.success).length;
    const failedAssignments = results.filter(r => !r.success).length;

    if (successfulAssignments > 0) {
      toast({
        title: "Thành công",
        description: `Đã gán thành công ${successfulAssignments} sản phẩm.`,
      });
    }

    if (failedAssignments > 0) {
      const errorMessages = results.filter(r => !r.success).map(r => r.message).join(', ');
      toast({
        title: "Lỗi",
        description: `Không thể gán ${failedAssignments} sản phẩm. Chi tiết: ${errorMessages}`,
        variant: "destructive",
      });
    }


    if (successfulAssignments > 0 && failedAssignments === 0) {
      setIsCreateProductDialogOpen(false);
    }
    resetCreateProductForm(); // Always reset form after attempting submission
    fetchProductData(); // Always refresh product list after attempting submission

    setIsLoading(false);
  };

  const resetCreateProductForm = () => {
    setCreateProductForm([]);
  };

  const handleEditProduct = async () => {
    if (!editingCustomerProduct || !staffSession?.id) return;

    setIsLoading(true); // Use general loading state
    try {
      const id = editingCustomerProduct.id || (editingCustomerProduct as any)._id;
      const response = await fetch(`/api/customer-products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProductForm)
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Thành công",
          description: "Đã cập nhật thông tin sản phẩm",
        });
        setIsEditProductDialogOpen(false);
        setEditingCustomerProduct(null);
        fetchProductData(); // Refresh product list
      } else {
        toast({
          title: "Lỗi",
          description: data.error || 'Có lỗi xảy ra',
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi cập nhật",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openEditProductDialog = (customerProduct: CustomerProduct) => {
    setEditingCustomerProduct(customerProduct);
    setEditProductForm({
      productName: customerProduct.productName,
      totalSessions: customerProduct.totalSessions,
      usedSessions: customerProduct.usedSessions,
      expiryDays: customerProduct.expiryDays,
      notes: customerProduct.notes || '',
      isActive: customerProduct.isActive
    });
    setIsEditProductDialogOpen(true);
  };

  const handleDeleteCustomerProduct = async (customerProductId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/customer-products/${customerProductId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Thành công",
          description: "Đã xóa sản phẩm/dịch vụ đã gán.",
        });
        setCustomerProducts(prev => prev.filter(cp => (cp.id || (cp as any)._id) !== customerProductId));
      } else {
        toast({
          title: "Lỗi",
          description: data.error || 'Có lỗi xảy ra khi xóa sản phẩm/dịch vụ.',
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi xóa sản phẩm/dịch vụ.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !customer && !staffSession) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (!staffSession) {
    return <div className="flex items-center justify-center h-full"><p>Không tìm thấy phiên làm việc. Vui lòng đăng nhập lại.</p></div>;
  }
  if (isLoading && !customer) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Đang tải thông tin khách hàng...</p></div>;
  }

  if (!customer) {
    // Ensure this condition doesn't prematurely return if there's just a brief moment where customer is null during load
    if (!isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <p>Không tìm thấy thông tin khách hàng cho ID: {customerId}.</p>
          <p className="text-sm text-muted-foreground">
            Có thể khách hàng đã bị xóa hoặc ID không chính xác.
          </p>
        </div>
      );
    }
    // If still loading, the initial Loader2 above should cover it.
  }

  if (!activeConversation) {
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

  const upcomingAppointments = appointments
    .filter(appt => new Date(appt.date) >= new Date())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


  return (
    <div className="flex flex-col md:flex-row h-full gap-0 md:gap-0">
      <Card className="flex-grow h-full flex flex-col rounded-none md:rounded-none border-none md:border-none">
        <CardHeader className="flex flex-row items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{(customer?.internalName || customer?.name || customer?.phoneNumber || 'K').charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{customer?.internalName || customer?.name || customer?.phoneNumber}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {customer && `Hoạt động cuối: ${format(new Date(customer.lastInteractionAt), 'HH:mm dd/MM/yy', { locale: vi })}`}
                {customer?.assignedStaffId ? ` (Giao cho: ${customer.assignedStaffId === staffSession?.id ? 'Bạn' : customer.assignedStaffName || 'NV khác'})` : "(Chưa giao)"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {staffSession?.role === 'staff' && !customer?.assignedStaffId && (
              <Button variant="outline" size="sm" onClick={handleAssignToSelf} disabled={isAssigning}>
                <UserCheck className="mr-1 h-4 w-4" /> {isAssigning ? "Đang nhận..." : "Nhận xử lý"}
              </Button>
            )}
            {staffSession?.role === 'staff' && customer?.assignedStaffId === staffSession?.id && (
              <Button variant="outline" size="sm" onClick={handleUnassign} disabled={isAssigning}>
                <LogOutIcon className="mr-1 h-4 w-4" /> {isAssigning ? "Đang trả..." : "Trả về hàng đợi"}
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
          onSuggestedReplyClick={() => { }}
          isLoading={isSendingMessage} // Only disable input when actively sending
          viewerRole={staffSession.role as MessageViewerRole}
          onPinRequested={handlePinRequested}
          onUnpinRequested={handleUnpinRequested}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
          currentStaffSessionId={staffSession.id}
          quickReplies={quickReplies}
          typingUsers={typingUsers}
          onTyping={onTyping}
          onScrollToMessage={handleScrollToMessage}
          // activeConversationId={activeConversation?.id}
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
                {customer?.assignedStaffId ? (
                  <div className="flex items-center justify-between text-xs">
                    <span>Đang xử lý: {customer.assignedStaffName || customer.assignedStaffId}</span>
                    <Button variant="outline" size="sm" onClick={handleUnassign} disabled={isAssigning}>
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
            {/* Reminder Section */}
            <div className="flex flex-col gap-2 p-2 border-b">
              <Button
                variant="outline"
                onClick={() => { setIsReminderModalOpen(true); setEditingReminder(null); }}
                title="Tạo nhắc nhở chăm sóc"
                className="flex items-center gap-2 px-3 py-2 w-full"
              >
                <Bell className="h-4 w-4 mr-2" />
                <span className="whitespace-nowrap">Tạo nhắc nhở chăm sóc</span>
              </Button>
              {reminders.length > 0 && (
                <div className="mt-2">
                  <h4 className="font-semibold text-sm mb-2 flex items-center">
                    <Bell className="mr-2 h-4 w-4 text-primary" />
                    Danh sách nhắc nhở
                  </h4>
                  <ul className="space-y-2">
                    {reminders.map(reminder => (
                      <li key={reminder.id} className="p-2 border rounded flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-muted/50">
                        <div>
                          <div className="font-medium">{reminder.title}</div>
                          <div className="text-xs text-muted-foreground">{reminder.description}</div>
                          <div className="text-xs">
                            Ngày: {reminder.dueDate ? new Date(reminder.dueDate).toLocaleString() : ''} | Ưu tiên: {reminder.priority}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditReminder(reminder)}>
                            <Edit2 className="h-4 w-4 mr-1" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteReminder(reminder.id)}>
                            <Trash2 className="h-4 w-4 mr-1" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-sm flex items-center mb-1"><UserCircle className="mr-2 h-4 w-4 text-primary" />Chi tiết</h4>
              <p className="text-xs"><span className="text-muted-foreground">Điện thoại:</span> <a href={`https://zalo.me/${customer?.phoneNumber}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{customer?.phoneNumber}</a></p>
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
                  <span className="truncate max-w-[150px]">{customer?.internalName || 'Chưa có'}</span>
                )}
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 shrink-0" onClick={() => setEditingInternalName(!editingInternalName)}><Edit2 className="h-3 w-3" /></Button>
              </div>
            </div>

            {/* Tags Section */}
            <div>
              <h4 className="font-semibold text-sm flex items-center mb-1">
                <Tag className="mr-2 h-4 w-4 text-primary" />Nhãn
              </h4>
              <div className="flex flex-wrap gap-1 mb-2">
                {customer?.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-3 w-3 ml-1 hover:bg-transparent"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Thêm nhãn mới (vd: Admin:TênAdmin)"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  disabled={!newTagName.trim()}
                  className="h-8"
                >
                  Thêm
                </Button>
              </div>
            </div>

            <Accordion type="multiple" className="w-full">
              <AccordionItem value="media-history">
                <AccordionTrigger className="text-sm font-semibold py-2 hover:no-underline">
                  <div className="flex items-center"><ImageIconLucide className="mr-2 h-4 w-4 text-primary" />Ảnh/Video ({imageMedia.length})</div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-2">
                  {imageMedia.length > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        {imageMedia.slice(0, 6).map(msg => {
                          const match = msg.content.match(/^(data:image\/[^;]+;base64,[^#]+)/);
                          if (!match) return null;
                          const dataUri = match[1];
                          const nameMatch = msg.content.match(/#filename=([^#\s]+)/);
                          let fileName = nameMatch ? decodeURIComponent(nameMatch[1]) : "Ảnh";
                          return (
                            <button
                              key={msg.id}
                              type="button"
                              className="aspect-square relative rounded overflow-hidden bg-muted hover:opacity-80 transition-opacity cursor-pointer"
                              onClick={() => handleSidebarImageClick(dataUri, fileName)}
                              title={`Xem trước ${fileName}`}
                            >
                              <NextImage src={dataUri} alt="media thumbnail" layout="fill" objectFit="cover" data-ai-hint="thumbnail image" />
                            </button>
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
                  <div className="flex items-center"><FileText className="mr-2 h-4 w-4 text-primary" />File ({fileMedia.length})</div>
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
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
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
              <h4 className="font-semibold text-sm flex items-center mb-1"><Clock className="mr-2 h-4 w-4 text-primary" />Lịch hẹn ({upcomingAppointments.length})</h4>
              {upcomingAppointments.slice(0, 2).map(appt => (
                <div key={appt.appointmentId} className="text-xs p-1.5 bg-muted/50 rounded mb-1">
                  <p>{appt.service} - {format(new Date(appt.date), 'dd/MM/yy', { locale: vi })} lúc {appt.time} ({getStatusLabel(appt.status)})</p>
                </div>
              ))}
              {upcomingAppointments.length > 2 && staffSession &&
                <Button variant="link" size="sm" className="p-0 h-auto text-primary" asChild>
                  <Link href={staffSession.role === 'admin' ? '/admin/appointments/view' : '/staff/appointments'}>
                    Xem tất cả
                  </Link>
                </Button>
              }
            </div>
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm flex items-center mb-1"><StickyNote className="mr-2 h-4 w-4 text-primary" />Ghi chú nội bộ ({notes.length})</h4>
              <div className="space-y-2 mb-2 max-h-40 overflow-y-auto">
                {notes.map(note => (
                  <div key={note.id} className="text-xs p-1.5 bg-muted/50 rounded">
                    {editingNote?.id === note.id ? (
                      <div className="space-y-1">
                        {editingNoteImageDataUri && (
                          <div className="relative w-20 h-20 border rounded overflow-hidden">
                            <NextImage src={editingNoteImageDataUri} alt={editingNoteImageFileName || "Note image"} layout="fill" objectFit="cover" data-ai-hint="note image" />
                            <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-5 w-5 bg-black/30 hover:bg-black/50 text-white" onClick={handleRemoveEditingNoteImage}><X className="h-3 w-3" /></Button>
                          </div>
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          ref={editNoteImageInputRef}
                          onChange={handleEditNoteImageChange}
                          className="h-8 text-xs"
                        />
                        <Textarea value={editingNoteContent} onChange={e => setEditingNoteContent(e.target.value)} rows={2} className="text-xs" />
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingNote(null)}>Hủy</Button>
                          <Button size="sm" onClick={handleSaveEditedNote}>Lưu</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {note.imageDataUri && (
                          <button
                            type="button"
                            onClick={() => handleSidebarImageClick(note.imageDataUri!, note.imageFileName || 'Note_Image')}
                            className="relative w-full aspect-video border rounded overflow-hidden my-1 cursor-pointer hover:opacity-90 transition-opacity"
                            title="Click để xem ảnh lớn"
                          >
                            <NextImage src={note.imageDataUri} alt={note.imageFileName || "Note image"} layout="fill" objectFit="contain" data-ai-hint="note image" />
                          </button>
                        )}
                        <p className="whitespace-pre-wrap">{note.content}</p>
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-muted-foreground">{note.staffName || 'Nhân viên'} - {format(new Date(note.createdAt), 'dd/MM HH:mm', { locale: vi })}</p>
                          {note.staffId === staffSession?.id && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleEditNote(note)}><Edit2 className="h-3 w-3" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
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
              <div className="space-y-1">
                {newNoteImageDataUri && (
                  <div className="relative w-20 h-20 border rounded overflow-hidden">
                    <NextImage src={newNoteImageDataUri} alt={newNoteImageFileName || "New note image"} layout="fill" objectFit="cover" data-ai-hint="note image" />
                    <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-5 w-5 bg-black/30 hover:bg-black/50 text-white" onClick={() => { setNewNoteImageDataUri(undefined); setNewNoteImageFileName(undefined); if (newNoteImageInputRef.current) newNoteImageInputRef.current.value = ""; }}><X className="h-3 w-3" /></Button>
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  ref={newNoteImageInputRef}
                  onChange={handleNewNoteImageChange}
                  className="h-8 text-xs"
                />
                <Textarea
                  placeholder="Thêm ghi chú nội bộ mới..."
                  rows={2}
                  className="text-xs"
                  value={newNoteContent}
                  onChange={e => setNewNoteContent(e.target.value)}
                />
              </div>
              <Button size="sm" className="mt-1 w-full" onClick={handleAddNote} disabled={!newNoteContent.trim() && !newNoteImageDataUri}>
                <PlusCircle className="mr-1 h-3 w-3" />Thêm Ghi chú
              </Button>
            </div>

            {/* New Products/Services Section */}
            <div className="border-b pb-3 mb-3">
              <h4 className="font-semibold text-sm flex items-center mb-1">
                <Package className="mr-2 h-4 w-4 text-primary" /> Sản phẩm/Dịch vụ đã gán ({customerProducts.length})
              </h4>
              {customerProducts.length > 0 ? (
                <div className="space-y-2 text-xs">
                  {customerProducts.map(cp => (
                    <div key={cp.id || (cp as any)._id} className="p-2 border rounded bg-muted/50 flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium truncate mr-2">{cp.productName}</span>
                        {getStatusBadge(cp)}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Số buổi:</span> {cp.remainingSessions}/{cp.totalSessions}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Đã dùng:</span> {cp.usedSessions}
                        </div>
                        {cp.expiryDate && (
                          <div>
                            <span className="text-muted-foreground">Hết hạn:</span> {formatDate(cp.expiryDate)}
                          </div>
                        )}
                      </div>
                      {cp.notes && <p className="text-muted-foreground italic text-[11px]">Ghi chú: {cp.notes}</p>}
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEditProductDialog(cp)}><Edit2 className="h-3 w-3" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa sản phẩm/dịch vụ</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa sản phẩm/dịch vụ đã gán này khỏi khách hàng?</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCustomerProduct(cp.id || (cp as any)._id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Chưa có sản phẩm/dịch vụ nào được gán.</p>
              )}
              <Button size="sm" className="mt-2 w-full" onClick={() => setIsCreateProductDialogOpen(true)}>
                <PlusCircle className="mr-1 h-3 w-3" /> Gán sản phẩm/dịch vụ
              </Button>
            </div>
          </CardContent>
        </ScrollArea>
      </Card>

      <Dialog open={messageEditState !== null} onOpenChange={(isOpen) => { if (!isOpen) { setMessageEditState(null); setCurrentAttachmentInEdit(null); setStagedEditFile(null); setEditTextContent(''); } }}>
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
          currentChatCustomerId={customer.id}
        />
      )}

      {/* Reminder Creation Modal */}
      <Dialog open={isReminderModalOpen} onOpenChange={(open) => { setIsReminderModalOpen(open); if (!open) setEditingReminder(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingReminder ? 'Sửa nhắc nhở' : 'Tạo nhắc nhở chăm sóc'}</DialogTitle>
            <DialogDescription>
              {editingReminder ? 'Chỉnh sửa thông tin nhắc nhở' : 'Tạo nhắc nhở để chăm sóc khách hàng'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Tiêu đề</Label>
              <Input
                id="title"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="Nhập tiêu đề nhắc nhở"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Nội dung</Label>
              <Textarea
                id="description"
                value={reminderDescription}
                onChange={(e) => setReminderDescription(e.target.value)}
                placeholder="Nhập nội dung nhắc nhở"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueDate">Ngày nhắc nhở</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={reminderDueDate}
                onChange={(e) => setReminderDueDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority">Mức độ ưu tiên</Label>
              <Select value={reminderPriority} onValueChange={(value: 'low' | 'medium' | 'high') => setReminderPriority(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn mức độ ưu tiên" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Thấp</SelectItem>
                  <SelectItem value="medium">Trung bình</SelectItem>
                  <SelectItem value="high">Cao</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reminderType">Loại nhắc nhở</Label>
              <Select value={reminderType} onValueChange={(value: 'one_time' | 'recurring') => setReminderType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại nhắc nhở" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">Một lần</SelectItem>
                  <SelectItem value="recurring">Định kỳ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {reminderType === 'recurring' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="intervalType">Loại khoảng thời gian</Label>
                  <Select value={reminderIntervalType} onValueChange={(value: 'days' | 'weeks' | 'months') => setReminderIntervalType(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn loại" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Ngày</SelectItem>
                      <SelectItem value="weeks">Tuần</SelectItem>
                      <SelectItem value="months">Tháng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="intervalValue">Số lượng</Label>
                  <Input
                    id="intervalValue"
                    type="number"
                    min="1"
                    value={reminderIntervalValue}
                    onChange={(e) => setReminderIntervalValue(parseInt(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsReminderModalOpen(false); setEditingReminder(null); }}>
              Hủy
            </Button>
            <Button onClick={handleCreateOrUpdateReminder} disabled={isSendingMessage}>
              {isSendingMessage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingReminder ? 'Đang lưu...' : 'Đang tạo...'}
                </>
              ) : (
                editingReminder ? 'Lưu thay đổi' : 'Tạo nhắc nhở'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sidebar Image Preview Dialog */}
      <Dialog open={!!selectedSidebarImagePreview} onOpenChange={(open) => { if (!open) setSelectedSidebarImagePreview(null) }}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-2">
          <DialogHeader className="p-2 border-b">
            <DialogTitle className="text-sm truncate">{selectedSidebarImageName || "Xem trước ảnh"}</DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-auto p-2 flex items-center justify-center">
            {selectedSidebarImagePreview && (
              <NextImage
                src={selectedSidebarImagePreview}
                alt={selectedSidebarImageName || 'Xem trước ảnh'}
                width={1200}
                height={800}
                className="max-w-full max-h-full object-contain"
                data-ai-hint="full image preview"
              />
            )}
          </div>
          <div className="p-2 border-t flex justify-end">
            {selectedSidebarImagePreview && (
              <Button variant="outline" asChild>
                <a href={selectedSidebarImagePreview} download={selectedSidebarImageName || 'image.png'}>
                  <Download className="mr-2 h-4 w-4" />Tải về
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Customer Info Button and Drawer */}
      <div className="md:hidden fixed bottom-40 right-4 z-50">
        <Button
          variant="default"
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={() => setIsCustomerInfoOpen(!isCustomerInfoOpen)}
        >
          <Info className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile Customer Info Drawer */}
      <div className={cn(
        "fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300",
        isCustomerInfoOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )} onClick={() => setIsCustomerInfoOpen(false)} />

      <div className={cn(
        "fixed inset-y-0 right-0 w-full max-w-sm bg-background z-50 transform transition-transform duration-300 ease-in-out md:hidden",
        isCustomerInfoOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold flex items-center">
              <Info className="mr-2 h-5 w-5" /> Thông tin Khách hàng
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setIsCustomerInfoOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <ScrollArea className="flex-grow">
            <div className="p-4 space-y-4">
              {staffSession?.role === 'admin' && (
                <div className="border-b pb-3 mb-3">
                  <h4 className="font-semibold text-sm flex items-center mb-1">
                    <Users className="mr-2 h-4 w-4 text-primary" />Phân công
                  </h4>
                  {customer?.assignedStaffId ? (
                    <div className="flex items-center justify-between text-xs">
                      <span>Đang xử lý: {customer.assignedStaffName || customer.assignedStaffId}</span>
                      <Button variant="outline" size="sm" onClick={handleUnassign} disabled={isAssigning}>
                        {isAssigning ? "Đang hủy..." : "Hủy giao"}
                      </Button>
                    </div>
                  ) : <p className="text-xs text-muted-foreground mb-1">Khách chưa được giao.</p>
                  }
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

              {/* Reminder Section */}
              <div className="flex flex-col gap-2 p-2 border-b">
                <Button
                  variant="outline"
                  onClick={() => { setIsReminderModalOpen(true); setEditingReminder(null); }}
                  title="Tạo nhắc nhở chăm sóc"
                  className="flex items-center gap-2 px-3 py-2 w-full"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  <span className="whitespace-nowrap">Tạo nhắc nhở chăm sóc</span>
                </Button>
                {reminders.length > 0 && (
                  <div className="mt-2">
                    <h4 className="font-semibold text-sm mb-2 flex items-center">
                      <Bell className="mr-2 h-4 w-4 text-primary" />
                      Danh sách nhắc nhở
                    </h4>
                    <ul className="space-y-2">
                      {reminders.map(reminder => (
                        <li key={reminder.id} className="p-2 border rounded flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-muted/50">
                          <div>
                            <div className="font-medium">{reminder.title}</div>
                            <div className="text-xs text-muted-foreground">{reminder.description}</div>
                            <div className="text-xs">
                              Ngày: {reminder.dueDate ? new Date(reminder.dueDate).toLocaleString() : ''} | Ưu tiên: {reminder.priority}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEditReminder(reminder)}>
                              <Edit2 className="h-4 w-4 mr-1" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteReminder(reminder.id)}>
                              <Trash2 className="h-4 w-4 mr-1" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Chi tiết khách hàng */}
              <div>
                <h4 className="font-semibold text-sm flex items-center mb-1">
                  <UserCircle className="mr-2 h-4 w-4 text-primary" />Chi tiết
                </h4>
                <p className="text-xs">
                  <span className="text-muted-foreground">Điện thoại:</span> <a href={`https://zalo.me/${customer?.phoneNumber}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{customer?.phoneNumber}</a>
                </p>
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
                    <span className="truncate max-w-[150px]">{customer?.internalName || 'Chưa có'}</span>
                  )}
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 shrink-0" onClick={() => setEditingInternalName(!editingInternalName)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Nhãn Section */}
              <div>
                <h4 className="font-semibold text-sm flex items-center mb-1">
                  <Tag className="mr-2 h-4 w-4 text-primary" />Nhãn
                </h4>
                <div className="flex flex-wrap gap-1 mb-2">
                  {customer?.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-3 w-3 ml-1 hover:bg-transparent"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Thêm nhãn mới (vd: Admin:TênAdmin)"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddTag}
                    disabled={!newTagName.trim()}
                    className="h-8"
                  >
                    Thêm
                  </Button>
                </div>
              </div>

              {/* Media & File Section (Accordion) */}
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="media-history">
                  <AccordionTrigger className="text-sm font-semibold py-2 hover:no-underline">
                    <div className="flex items-center"><ImageIconLucide className="mr-2 h-4 w-4 text-primary" />Ảnh/Video ({imageMedia.length})</div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-2">
                    {imageMedia.length > 0 ? (
                      <>
                        <div className="grid grid-cols-3 gap-1.5 mb-2">
                          {imageMedia.slice(0, 6).map(msg => {
                            const match = msg.content.match(/^(data:image\/[^;]+;base64,[^#]+)/);
                            if (!match) return null;
                            const dataUri = match[1];
                            const nameMatch = msg.content.match(/#filename=([^#\s]+)/);
                            let fileName = nameMatch ? decodeURIComponent(nameMatch[1]) : "Ảnh";
                            return (
                              <button
                                key={msg.id}
                                type="button"
                                className="aspect-square relative rounded overflow-hidden bg-muted hover:opacity-80 transition-opacity cursor-pointer"
                                onClick={() => handleSidebarImageClick(dataUri, fileName)}
                                title={`Xem trước ${fileName}`}
                              >
                                <NextImage src={dataUri} alt="media thumbnail" layout="fill" objectFit="cover" data-ai-hint="thumbnail image" />
                              </button>
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
                    <div className="flex items-center"><FileText className="mr-2 h-4 w-4 text-primary" />File ({fileMedia.length})</div>
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
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="h-3.5 w-3.5 shrink-0" />
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

              {/* Lịch hẹn Section */}
              <div className="border-t pt-3">
                <h4 className="font-semibold text-sm flex items-center mb-1"><Clock className="mr-2 h-4 w-4 text-primary" />Lịch hẹn ({upcomingAppointments.length})</h4>
                {upcomingAppointments.slice(0, 2).map(appt => (
                  <div key={appt.appointmentId} className="text-xs p-1.5 bg-muted/50 rounded mb-1">
                    <p>{appt.service} - {format(new Date(appt.date), 'dd/MM/yy', { locale: vi })} lúc {appt.time} ({getStatusLabel(appt.status)})</p>
                  </div>
                ))}
                {upcomingAppointments.length > 2 && staffSession &&
                  <Button variant="link" size="sm" className="p-0 h-auto text-primary" asChild>
                    <Link href={staffSession.role === 'admin' ? '/admin/appointments/view' : '/staff/appointments'}>
                      Xem tất cả
                    </Link>
                  </Button>
                }
              </div>

              {/* Ghi chú nội bộ Section */}
              <div className="border-t pt-3">
                <h4 className="font-semibold text-sm flex items-center mb-1"><StickyNote className="mr-2 h-4 w-4 text-primary" />Ghi chú nội bộ ({notes.length})</h4>
                <div className="space-y-2 mb-2 max-h-40 overflow-y-auto">
                  {notes.map(note => (
                    <div key={note.id} className="text-xs p-1.5 bg-muted/50 rounded">
                      {editingNote?.id === note.id ? (
                        <div className="space-y-1">
                          {editingNoteImageDataUri && (
                            <div className="relative w-20 h-20 border rounded overflow-hidden">
                              <NextImage src={editingNoteImageDataUri} alt={editingNoteImageFileName || "Note image"} layout="fill" objectFit="cover" data-ai-hint="note image" />
                              <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-5 w-5 bg-black/30 hover:bg-black/50 text-white" onClick={handleRemoveEditingNoteImage}><X className="h-3 w-3" /></Button>
                            </div>
                          )}
                          <Input
                            type="file"
                            accept="image/*"
                            ref={editNoteImageInputRef}
                            onChange={handleEditNoteImageChange}
                            className="h-8 text-xs"
                          />
                          <Textarea value={editingNoteContent} onChange={e => setEditingNoteContent(e.target.value)} rows={2} className="text-xs" />
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setEditingNote(null)}>Hủy</Button>
                            <Button size="sm" onClick={handleSaveEditedNote}>Lưu</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {note.imageDataUri && (
                            <button
                              type="button"
                              onClick={() => handleSidebarImageClick(note.imageDataUri!, note.imageFileName || 'Note_Image')}
                              className="relative w-full aspect-video border rounded overflow-hidden my-1 cursor-pointer hover:opacity-90 transition-opacity"
                              title="Click để xem ảnh lớn"
                            >
                              <NextImage src={note.imageDataUri} alt={note.imageFileName || "Note image"} layout="fill" objectFit="contain" data-ai-hint="note image" />
                            </button>
                          )}
                          <p className="whitespace-pre-wrap">{note.content}</p>
                          <div className="flex justify-between items-center mt-1">
                            <p className="text-muted-foreground">{note.staffName || 'Nhân viên'} - {format(new Date(note.createdAt), 'dd/MM HH:mm', { locale: vi })}</p>
                            {note.staffId === staffSession?.id && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleEditNote(note)}><Edit2 className="h-3 w-3" /></Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
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
                <div className="space-y-1">
                  {newNoteImageDataUri && (
                    <div className="relative w-20 h-20 border rounded overflow-hidden">
                      <NextImage src={newNoteImageDataUri} alt={newNoteImageFileName || "New note image"} layout="fill" objectFit="cover" data-ai-hint="note image" />
                      <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-5 w-5 bg-black/30 hover:bg-black/50 text-white" onClick={() => { setNewNoteImageDataUri(undefined); setNewNoteImageFileName(undefined); if (newNoteImageInputRef.current) newNoteImageInputRef.current.value = ""; }}><X className="h-3 w-3" /></Button>
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    ref={newNoteImageInputRef}
                    onChange={handleNewNoteImageChange}
                    className="h-8 text-xs"
                  />
                  <Textarea
                    placeholder="Thêm ghi chú nội bộ mới..."
                    rows={2}
                    className="text-xs"
                    value={newNoteContent}
                    onChange={e => setNewNoteContent(e.target.value)}
                  />
                </div>
                <Button size="sm" className="mt-1 w-full" onClick={handleAddNote} disabled={!newNoteContent.trim() && !newNoteImageDataUri}>
                  <PlusCircle className="mr-1 h-3 w-3" />Thêm Ghi chú
                </Button>
              </div>

              {/* New Products/Services Section */}
              <div className="border-b pb-3 mb-3">
                <h4 className="font-semibold text-sm flex items-center mb-1">
                  <Package className="mr-2 h-4 w-4 text-primary" /> Sản phẩm/Dịch vụ đã gán ({customerProducts.length})
                </h4>
                {customerProducts.length > 0 ? (
                  <div className="space-y-2 text-xs">
                    {customerProducts.map(cp => (
                      <div key={cp.id || (cp as any)._id} className="p-2 border rounded bg-muted/50 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium truncate mr-2">{cp.productName}</span>
                          {getStatusBadge(cp)}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-muted-foreground">Số buổi:</span> {cp.remainingSessions}/{cp.totalSessions}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Đã dùng:</span> {cp.usedSessions}
                          </div>
                          {cp.expiryDate && (
                            <div>
                              <span className="text-muted-foreground">Hết hạn:</span> {formatDate(cp.expiryDate)}
                            </div>
                          )}
                        </div>
                        {cp.notes && <p className="text-muted-foreground italic text-[11px]">Ghi chú: {cp.notes}</p>}
                        <div className="flex justify-end">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEditProductDialog(cp)}><Edit2 className="h-3 w-3" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa sản phẩm/dịch vụ</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa sản phẩm/dịch vụ đã gán này khỏi khách hàng?</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCustomerProduct(cp.id || (cp as any)._id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Chưa có sản phẩm/dịch vụ nào được gán.</p>
                )}
                <Button size="sm" className="mt-2 w-full" onClick={() => setIsCreateProductDialogOpen(true)}>
                  <PlusCircle className="mr-1 h-3 w-3" /> Gán sản phẩm/dịch vụ
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* New Create Product Dialog */}
      <Dialog open={isCreateProductDialogOpen} onOpenChange={(open) => setIsCreateProductDialogOpen(open)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Gán sản phẩm/dịch vụ cho khách hàng</DialogTitle>
            <DialogDescription>Chọn sản phẩm/dịch vụ để gán cho khách hàng này</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 flex-grow overflow-y-auto">
            {/* Single Select for adding new products */}
            <div>
              <Label htmlFor="addProductSelect">Chọn sản phẩm để thêm</Label>
              <Select
                onValueChange={(value) => {
                  const productToAdd = products.find(p => p.id === value);
                  if (productToAdd) {
                    setCreateProductForm(prev => [
                      ...prev,
                      {
                        customerId: '', // Will be filled by customer.id
                        productId: productToAdd.id,
                        totalSessions: productToAdd.defaultSessions || 1,
                        expiryDays: productToAdd.expiryDays,
                        notes: '',
                        staffId: '' // Will be filled by staffSession.id
                      }
                    ]);
                  }
                  setProductSearchTerm(''); // Clear search term after selection
                }}
                value="" // Reset value after selecting
              >
                <SelectTrigger id="addProductSelect" className="w-full">
                  <SelectValue placeholder="Chọn sản phẩm..." />
                </SelectTrigger>
                <SelectContent>
                  {/* Manually filter items based on search term */}
                  <div className="relative mb-2 mt-1 mx-1">
                    <Input
                      placeholder="Tìm kiếm sản phẩm..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="h-8 w-full text-sm pr-8"
                    />
                    {productSearchTerm && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 h-8 w-8"
                        onClick={() => setProductSearchTerm('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {/* Items rendered directly within SelectContent's Viewport for native scrolling */}
                  {products.filter(p => p.isActive && p.name.toLowerCase().includes(productSearchTerm.toLowerCase())).map((product) => (
                    <SelectItem key={product.id} value={product.id} className="cursor-pointer"> {/* Added cursor style */}
                      <div className="flex flex-col">
                        <span>{product.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {product.category} - {product.price.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* List of selected products to assign */}
            {createProductForm.length > 0 && (
              <div className="space-y-3 mt-4">
                <h4 className="font-semibold text-sm">Sản phẩm sẽ gán:</h4>
                {createProductForm.map((item, index) => {
                  const selectedProduct = products.find(p => p.id === item.productId);
                  if (!selectedProduct) return null; // Should not happen if selection logic is correct, but good safeguard

                  return (
                    <div key={index} className="border rounded-md p-4 space-y-3 relative bg-muted/50">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 text-destructive"
                        onClick={() => setCreateProductForm(prev => prev.filter((_, i) => i !== index))}
                        title="Xóa sản phẩm này"
                      >
                        <X className="h-4 w-4" />
                      </Button>

                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{selectedProduct.name}</p>
                          <p className="text-xs text-muted-foreground">Giá: {selectedProduct.price.toLocaleString('vi-VN')}đ</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCreateProductForm(prev => prev.map((p, i) => i === index ? { ...p, totalSessions: Math.max(1, p.totalSessions - 1) } : p))}
                            disabled={item.totalSessions <= 1}
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            value={item.totalSessions}
                            onChange={(e) => setCreateProductForm(prev => prev.map((p, i) => i === index ? {
                              ...p,
                              totalSessions: parseInt(e.target.value) || 1
                            } : p))}
                            className="w-12 text-center h-8"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCreateProductForm(prev => prev.map((p, i) => i === index ? { ...p, totalSessions: p.totalSessions + 1 } : p))}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`expiry-${index}`}>Thời hạn (ngày)</Label>
                        <Input
                          id={`expiry-${index}`}
                          type="number"
                          min="1"
                          value={item.expiryDays || ''}
                          onChange={(e) => setCreateProductForm(prev => prev.map((p, i) => i === index ? {
                            ...p,
                            expiryDays: e.target.value ? parseInt(e.target.value) : undefined
                          } : p))}
                          placeholder="Không giới hạn"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`notes-${index}`}>Ghi chú</Label>
                        <Textarea
                          id={`notes-${index}`}
                          value={item.notes}
                          onChange={(e) => setCreateProductForm(prev => prev.map((p, i) => i === index ? { ...p, notes: e.target.value } : p))}
                          placeholder="Ghi chú thêm..."
                          rows={1}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div> {/* End of ScrollArea content */}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateProductDialogOpen(false); resetCreateProductForm(); }}>Hủy</Button>
            <Button onClick={handleCreateInvoice} disabled={isLoading || createProductForm.length === 0 || createProductForm.some(item => !item.productId || item.totalSessions <= 0)}>
              {isLoading ? 'Đang gán...' : 'Gán sản phẩm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Edit Product Dialog */}
      <Dialog open={isEditProductDialogOpen} onOpenChange={(open) => { setIsEditProductDialogOpen(open); if (!open) setEditingCustomerProduct(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa sản phẩm/dịch vụ đã gán</DialogTitle>
            <DialogDescription>Cập nhật thông tin sản phẩm/dịch vụ của khách hàng</DialogDescription>
          </DialogHeader>
          {editingCustomerProduct && (
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="edit-product-name">Tên sản phẩm</Label>
                <Input
                  id="edit-product-name"
                  value={editProductForm.productName}
                  onChange={(e) => setEditProductForm(prev => ({ ...prev, productName: e.target.value }))}
                  disabled // Product name is not editable here
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-total-sessions">Tổng số buổi</Label>
                  <Input
                    id="edit-total-sessions"
                    type="number"
                    min="1"
                    value={editProductForm.totalSessions}
                    onChange={(e) => setEditProductForm(prev => ({ ...prev, totalSessions: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-used-sessions">Đã sử dụng</Label>
                  <Input
                    id="edit-used-sessions"
                    type="number"
                    min="0"
                    value={editProductForm.usedSessions}
                    onChange={(e) => setEditProductForm(prev => ({ ...prev, usedSessions: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-expiry-days">Thời hạn (ngày)</Label>
                <Input
                  id="edit-expiry-days"
                  type="number"
                  min="1"
                  value={editProductForm.expiryDays || ''}
                  onChange={(e) => setEditProductForm(prev => ({ ...prev, expiryDays: e.target.value ? parseInt(e.target.value) : undefined }))}
                  placeholder="Không giới hạn"
                />
              </div>
              <div>
                <Label htmlFor="edit-notes">Ghi chú</Label>
                <Textarea
                  id="edit-notes"
                  value={editProductForm.notes}
                  onChange={(e) => setEditProductForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-is-active"
                  checked={editProductForm.isActive}
                  onChange={(e) => setEditProductForm(prev => ({ ...prev, isActive: e.target.checked }))}
                />
                <Label htmlFor="edit-is-active">Đang hoạt động</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditProductDialogOpen(false); setEditingCustomerProduct(null); }}>Hủy</Button>
            <Button onClick={handleEditProduct} disabled={isLoading || !editingCustomerProduct}>
              {isLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
