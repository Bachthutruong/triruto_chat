// src/app/staff/chat/[customerId]/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import NextImage from 'next/image'; // Renamed to avoid conflict with Lucide's Image
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Paperclip, Smile, UserCircle, Edit2, Tag, Clock, Phone, Info, X, StickyNote, PlusCircle, Trash2, UserPlus, LogOutIcon, UserCheck, Users, Pin, PinOff, Edit, Image as ImageIcon, ExternalLink, FileText, Download } from 'lucide-react';
import type { CustomerProfile, Message, AppointmentDetails, UserSession, Note, MessageEditState } from '@/lib/types';
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
  pinMessageToCustomerChat,
  unpinMessageFromCustomerChat,
  getMessagesByIds,
  markCustomerInteractionAsReadByStaff,
  deleteStaffMessage,
  editStaffMessage
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

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function getMimeTypeFromDataUri(dataUri: string): string | null {
  const match = dataUri.match(/^data:([A-Za-z-+\/]+);base64,/);
  return match ? match[1] : null;
}

function isImageDataUri(uri: string): boolean {
  const mime = getMimeTypeFromDataUri(uri);
  return mime ? mime.startsWith('image/') : false;
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
  // For editing messages with attachments
  const [currentAttachmentInEdit, setCurrentAttachmentInEdit] = useState<{ dataUri: string; name: string; type: string | null } | null>(null);
  const [stagedEditFile, setStagedEditFile] = useState<{ dataUri: string; name: string; type: string } | null>(null);
  const [editTextContent, setEditTextContent] = useState(''); // Only text part for editing
  const editFileInputRef = useRef<HTMLInputElement>(null);


  const fetchChatData = useCallback(async () => {
    if (customerId) {
      setIsLoading(true);
      try {
        const { customer: fetchedCustomer, messages: fetchedMessages, appointments: fetchedAppointments, notes: fetchedNotes } = await getCustomerDetails(customerId);
        setCustomer(fetchedCustomer);
        
        const allMsgs = fetchedMessages || [];
        setMessages(allMsgs);
        
        if (fetchedCustomer?.pinnedMessageIds && fetchedCustomer.pinnedMessageIds.length > 0) {
          const fetchedPinnedMessages = await getMessagesByIds(fetchedCustomer.pinnedMessageIds);
          setPinnedMessages(fetchedPinnedMessages.map(m => ({...m, isPinned: true})));
        } else {
          setPinnedMessages([]);
        }

        setAppointments(fetchedAppointments || []);
        setNotes(fetchedNotes || []);
        if (fetchedCustomer?.internalName) {
          setInternalNameInput(fetchedCustomer.internalName);
        } else if (fetchedCustomer) {
          setInternalNameInput(''); 
        }

        if (staffSession && fetchedCustomer && fetchedCustomer.interactionStatus === 'unread') {
          await markCustomerInteractionAsReadByStaff(customerId, staffSession.id);
          setCustomer(prev => prev ? {...prev, interactionStatus: 'read'} : null);
        }

      } catch (error) {
        console.error("Không thể tải chi tiết khách hàng:", error);
        toast({ title: "Lỗi", description: "Không thể tải chi tiết khách hàng.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
  }, [customerId, toast, staffSession]); 

  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      const session = JSON.parse(sessionString);
      setStaffSession(session);
      if (session.role === 'admin') {
        const fetchStaff = async () => {
          try {
            const staff = await getStaffList();
            setAllStaff(staff);
          } catch (error) {
            toast({ title: "Lỗi", description: "Không thể tải danh sách nhân viên.", variant: "destructive" });
          }
        };
        fetchStaff();
      }
    }
  }, [toast]);


  useEffect(() => {
    fetchChatData();
  }, [fetchChatData]);

  const handleSendMessage = async (messageContent: string) => {
    if (!messageContent.trim() || !customer || !staffSession) return;
    setIsSendingMessage(true);
    try {
      const sentMessage = await sendStaffMessage(staffSession, customer.id, messageContent);
      setMessages(prev => [...prev, sentMessage]);
      setCustomer(prev => prev ? { ...prev, interactionStatus: 'replied_by_staff', lastMessagePreview: messageContent.substring(0,100), lastMessageTimestamp: new Date() } : null);
    } catch (error: any) {
      toast({ title: "Lỗi gửi tin nhắn", description: error.message, variant: "destructive"});
    } finally {
      setIsSendingMessage(false);
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
    setStagedEditFile(null); // Clear any previously staged file for new edit
  };

  const handleSaveEditedMessage = async () => {
    if (!messageEditState || !staffSession) return;
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
      return;
    }
    
    try {
      const updatedMessage = await editStaffMessage(messageEditState.messageId, finalContent, staffSession);
      if (updatedMessage) {
        setMessages(prev => prev.map(m => m.id === updatedMessage.id ? updatedMessage : m));
        if (pinnedMessages.find(pm => pm.id === updatedMessage.id)) {
          setPinnedMessages(prev => prev.map(pm => pm.id === updatedMessage.id ? updatedMessage : pm));
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
        if(editFileInputRef.current) editFileInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setStagedEditFile({ dataUri: reader.result as string, name: file.name, type: file.type });
          setCurrentAttachmentInEdit(null); // New file replaces current if any
        }
        if(editFileInputRef.current) editFileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    }
  };


  const handleDeleteMessage = async (messageId: string) => {
    if (!staffSession) return;
    try {
      const result = await deleteStaffMessage(messageId, staffSession);
      if (result.success) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setPinnedMessages(prev => prev.filter(pm => pm.id !== messageId));
        toast({ title: "Thành công", description: "Đã xóa tin nhắn." });
        if (result.customerId && customer?.lastMessagePreview && messages.find(m=>m.id === messageId)?.content.startsWith(customer.lastMessagePreview)) {
            fetchChatData(); 
        }
      }
    } catch (error: any) {
      toast({ title: "Lỗi xóa tin nhắn", description: error.message, variant: "destructive" });
    }
  };


  const handlePinMessage = async (messageId: string) => {
    if (!customer || !staffSession) return;
    try {
      const updatedCustomer = await pinMessageToCustomerChat(customer.id, messageId, staffSession);
      if (updatedCustomer) {
        setCustomer(updatedCustomer);
        const messageToPin = messages.find(m => m.id === messageId);
        if (messageToPin) {
          setPinnedMessages(prev => {
            const newPinned = [...prev.filter(p => p.id !== messageId), {...messageToPin, isPinned: true}];
            return newPinned.slice(-3); 
          });
          setMessages(prev => prev.map(m => m.id === messageId ? {...m, isPinned: true} : m));
        }
        toast({title: "Thành công", description: "Đã ghim tin nhắn."});
      }
    } catch (error: any) {
      toast({title: "Lỗi", description: error.message, variant: "destructive"});
    }
  };

  const handleUnpinMessage = async (messageId: string) => {
    if (!customer || !staffSession) return;
    try {
      const updatedCustomer = await unpinMessageFromCustomerChat(customer.id, messageId, staffSession);
      if (updatedCustomer) {
        setCustomer(updatedCustomer);
        setPinnedMessages(prev => prev.filter(m => m.id !== messageId));
        setMessages(prev => prev.map(m => m.id === messageId ? {...m, isPinned: false} : m));
        toast({title: "Thành công", description: "Đã bỏ ghim tin nhắn."});
      }
    } catch (error: any) {
      toast({title: "Lỗi", description: error.message, variant: "destructive"});
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
       toast({title: "Thông báo", description: "Chỉ Admin mới có thể tự mời chính mình bằng tag."});
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
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><p>Đang tải cuộc trò chuyện...</p></div>;
  }

  if (!customer || !staffSession) {
    return <div className="flex items-center justify-center h-full"><p>Không tìm thấy khách hàng hoặc phiên làm việc.</p></div>;
  }

  const getStatusLabel = (status: AppointmentDetails['status']) => {
    switch (status) {
      case 'booked': return 'Đã đặt';
      case 'completed': return 'Hoàn thành';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };


  return (
    <div className="flex flex-col md:flex-row h-full gap-0 md:gap-4"> 
      <Card className="flex-grow h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={`https://picsum.photos/seed/${customer.id}/40/40`} data-ai-hint="profile avatar"/>
              <AvatarFallback>{(customer.name || customer.phoneNumber).charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{customer.name || customer.phoneNumber}</CardTitle>
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
             <Button variant="outline" size="sm" asChild>
                <Link href={staffSession.role === 'admin' ? `/admin/media/${customerId}` : `/staff/media/${customerId}`}>
                  <ImageIcon className="mr-1 h-4 w-4" /> Lịch sử File
                </Link>
              </Button>
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
          onPinMessage={handlePinMessage}
          onUnpinMessage={handleUnpinMessage}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
          currentStaffSessionId={staffSession.id}
        />
      </Card>

      <Card className="w-full md:max-w-xs lg:max-w-sm xl:max-w-md h-full flex-col hidden md:flex"> 
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
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm flex items-center mb-1"><Clock className="mr-2 h-4 w-4 text-primary" />Lịch hẹn ({appointments.length})</h4>
              {appointments.slice(0,2).map(appt => (
                <div key={appt.appointmentId} className="text-xs p-1.5 bg-muted/50 rounded mb-1">
                    <p>{appt.service} - {format(new Date(appt.date), 'dd/MM/yy', { locale: vi })} lúc {appt.time} ({getStatusLabel(appt.status)})</p>
                </div>
              ))}
              {appointments.length > 2 && <Button variant="link" size="sm" className="p-0 h-auto text-primary">Xem tất cả</Button>}
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
    </div>
  );
}
