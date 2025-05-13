// src/app/staff/chat/[customerId]/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Paperclip, Smile, UserCircle, Edit2, Tag, Clock, Phone, Info, X, StickyNote, PlusCircle, Trash2, UserPlus, LogOutIcon, UserCheck, Users } from 'lucide-react';
import type { CustomerProfile, Message, AppointmentDetails, UserSession, Note } from '@/lib/types';
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
  getStaffList
} from '@/app/actions';
import { Textarea } from '@/components/ui/textarea'; 
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export default function StaffIndividualChatPage() {
  const params = useParams();
  const customerId = params.customerId as string;
  const { toast } = useToast();

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDetails[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
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

  const chatScrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollAreaRef.current) {
      const viewport = chatScrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);


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
    if (customerId) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const { customer: fetchedCustomer, messages: fetchedMessages, appointments: fetchedAppointments, notes: fetchedNotes } = await getCustomerDetails(customerId);
          setCustomer(fetchedCustomer);
          setMessages(fetchedMessages || []);
          setAppointments(fetchedAppointments || []);
          setNotes(fetchedNotes || []);
          if (fetchedCustomer?.internalName) {
            setInternalNameInput(fetchedCustomer.internalName);
          } else if (fetchedCustomer) {
            setInternalNameInput(''); 
          }
        } catch (error) {
          console.error("Không thể tải chi tiết khách hàng:", error);
          toast({ title: "Lỗi", description: "Không thể tải chi tiết khách hàng.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [customerId, toast]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !customer || !staffSession) return;
    try {
      const sentMessage = await sendStaffMessage(staffSession, customer.id, newMessage);
      setMessages(prev => [...prev, sentMessage]);
      setNewMessage('');
    } catch (error: any) {
      toast({ title: "Lỗi gửi tin nhắn", description: error.message, variant: "destructive"});
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
      // Staff can only unassign if they are assigned. Admin can unassign anyone.
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
    // Admin invitation tag
    if (newTagName.toLowerCase().startsWith("admin:") && staffSession.role !== 'admin') {
       toast({title: "Thông báo", description: "Chỉ Admin mới có thể tự mời chính mình bằng tag."});
       // Or simply add the tag "Admin Attention"
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

  if (!customer) {
    return <div className="flex items-center justify-center h-full"><p>Không tìm thấy khách hàng.</p></div>;
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
    <div className="flex flex-col md:flex-row h-[calc(100vh-var(--header-height,4rem)-2rem)] gap-4">
      <Card className="flex-grow h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={`https://picsum.photos/seed/${customer.id}/40/40`} data-ai-hint="profile avatar" />
              <AvatarFallback>{customer.name?.charAt(0) || customer.phoneNumber.charAt(0)}</AvatarFallback>
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
          </div>
        </CardHeader>

        <ScrollArea className="flex-grow p-4 bg-muted/20" ref={chatScrollAreaRef}>
          <div className="space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] p-3 rounded-lg ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background shadow'}`}>
                  <p className="text-sm font-semibold mb-0.5">{msg.name || (msg.sender === 'user' ? 'Khách hàng' : 'Hệ thống')}</p>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs mt-1 opacity-70 text-right">{format(new Date(msg.timestamp), 'HH:mm', { locale: vi })}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <CardFooter className="p-4 border-t">
            <div className="flex w-full items-center gap-2">
                <Button variant="ghost" size="icon"><Smile className="h-5 w-5 text-muted-foreground" /></Button>
                <Button variant="ghost" size="icon"><Paperclip className="h-5 w-5 text-muted-foreground" /></Button>
                <Input 
                    type="text" 
                    placeholder="Nhập tin nhắn của bạn..." 
                    className="flex-grow" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                    <Send className="h-5 w-5" />
                </Button>
            </div>
        </CardFooter>
      </Card>

      <Card className="w-full md:w-1/3 lg:w-1/4 h-full flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center"><Info className="mr-2 h-5 w-5" /> Thông tin Khách hàng</CardTitle>
        </CardHeader>
        <ScrollArea className="flex-grow">
          <CardContent className="p-4 space-y-4">
            {/* Assignment Section */}
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
              <Button variant="outline" size="sm" className="w-full mt-1">Lịch hẹn mới</Button>
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
    </div>
  );
}
