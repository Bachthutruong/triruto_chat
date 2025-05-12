// src/app/staff/chat/[customerId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Paperclip, Smile, UserCircle, Edit2, Tag, Clock, Phone, Info } from 'lucide-react';
import type { CustomerProfile, Message, AppointmentDetails, UserSession } from '@/lib/types';
import { getCustomerDetails, sendStaffMessage, assignStaffToCustomer, addTagToCustomer, unassignStaffFromCustomer, removeTagFromCustomer } from '@/app/actions';
import { Textarea } from '@/components/ui/textarea'; 
import { useToast } from '@/hooks/use-toast';

export default function StaffIndividualChatPage() {
  const params = useParams();
  const customerId = params.customerId as string;
  const { toast } = useToast();

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [staffSession, setStaffSession] = useState<UserSession | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingInternalName, setEditingInternalName] = useState(false);
  const [internalNameInput, setInternalNameInput] = useState('');


  useEffect(() => {
    const sessionString = sessionStorage.getItem('aetherChatUserSession');
    if (sessionString) {
      setStaffSession(JSON.parse(sessionString));
    }
  }, []);

  useEffect(() => {
    if (customerId) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const { customer: fetchedCustomer, messages: fetchedMessages, appointments: fetchedAppointments } = await getCustomerDetails(customerId);
          setCustomer(fetchedCustomer);
          setMessages(fetchedMessages || []);
          setAppointments(fetchedAppointments || []);
          if (fetchedCustomer?.internalName) {
            setInternalNameInput(fetchedCustomer.internalName);
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

  const handleUnassign = async () => {
    if (!customer) return;
    setIsAssigning(true);
    try {
      const updatedCustomer = await unassignStaffFromCustomer(customer.id);
      setCustomer(updatedCustomer);
      toast({ title: "Thành công", description: `Khách hàng đã được đưa trở lại hàng đợi chung.`});
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive"});
    } finally {
      setIsAssigning(false);
    }
  }
  
  const handleAddTag = async () => {
    if (!customer || !newTagName.trim()) return;
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
    if (!customer) return;
    try {
        const updatedCustomer = await removeTagFromCustomer(customer.id, tagToRemove);
        setCustomer(updatedCustomer);
        toast({title: "Thành công", description: "Đã xóa nhãn."});
    } catch (error: any) {
        toast({title: "Lỗi", description: `Không thể xóa nhãn: ${error.message}`, variant: "destructive"});
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
    <div className="flex h-[calc(100vh-var(--header-height,4rem)-2rem)] gap-4">
      <Card className="flex-grow h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={`https://picsum.photos/seed/${customer.id}/40/40`} data-ai-hint="profile avatar" />
              <AvatarFallback>{customer.name?.charAt(0) || customer.phoneNumber.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{customer.name || customer.phoneNumber}</CardTitle>
              <p className="text-xs text-muted-foreground">Hoạt động cuối: {new Date(customer.lastInteractionAt).toLocaleTimeString('vi-VN')} 
                {customer.assignedStaffId ? ` (Giao cho: ${customer.assignedStaffId === staffSession?.id ? 'Bạn' : customer.assignedStaffId})` : "(Chưa giao)"}
              </p>
            </div>
          </div>
          <div>
            {!customer.assignedStaffId && staffSession && (
              <Button variant="outline" size="sm" onClick={handleAssignToSelf} disabled={isAssigning}>
                {isAssigning ? "Đang giao..." : "Nhận xử lý"}
              </Button>
            )}
            {customer.assignedStaffId === staffSession?.id && (
                 <Button variant="outline" size="sm" onClick={handleUnassign} disabled={isAssigning} className="ml-2">
                     {isAssigning ? "Đang xử lý..." : "Trả về hàng đợi"}
                 </Button>
            )}
          </div>
        </CardHeader>

        <ScrollArea className="flex-grow p-4 bg-muted/20">
          <div className="space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] p-3 rounded-lg ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background shadow'}`}>
                  <p className="text-sm font-semibold mb-0.5">{msg.name || (msg.sender === 'user' ? 'Khách hàng' : 'Hệ thống')}</p>
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-xs mt-1 opacity-70 text-right">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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

      <Card className="w-1/3 lg:w-1/4 h-full flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center"><Info className="mr-2 h-5 w-5" /> Thông tin Khách hàng</CardTitle>
        </CardHeader>
        <ScrollArea className="flex-grow">
          <CardContent className="p-4 space-y-4">
            <div>
              <h4 className="font-semibold text-sm flex items-center mb-1"><UserCircle className="mr-2 h-4 w-4 text-primary" />Chi tiết</h4>
              <p className="text-xs"><span className="text-muted-foreground">Điện thoại:</span> {customer.phoneNumber}</p>
              <div className="text-xs flex items-center">
                <span className="text-muted-foreground mr-1">Tên nội bộ:</span>
                {editingInternalName ? (
                    <Input 
                        value={internalNameInput}
                        onChange={(e) => setInternalNameInput(e.target.value)}
                        onBlur={() => { /* TODO: Save internal name */ setEditingInternalName(false); }}
                        onKeyPress={(e) => { if (e.key === 'Enter') { /* TODO: Save internal name */ setEditingInternalName(false); }}}
                        className="h-6 text-xs p-1"
                        autoFocus
                    />
                ) : (
                    <span>{customer.internalName || 'Chưa có'}</span>
                )}
                 <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => setEditingInternalName(!editingInternalName)}><Edit2 className="h-3 w-3"/></Button>
              </div>
              <div>
                <h5 className="font-semibold text-xs mt-2 mb-1 flex items-center"><Tag className="mr-2 h-3 w-3 text-primary" />Nhãn</h5>
                <div className="flex flex-wrap gap-1 mb-2">
                    {(customer.tags || []).map(tag => (
                        <span key={tag} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center">
                            {tag}
                            <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 p-0" onClick={() => handleRemoveTag(tag)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-1">
                    <Input 
                        value={newTagName} 
                        onChange={(e) => setNewTagName(e.target.value)} 
                        placeholder="Thêm nhãn mới"
                        className="h-7 text-xs"
                    />
                    <Button size="sm" onClick={handleAddTag} className="h-7 text-xs px-2">Thêm</Button>
                </div>
              </div>
            </div>
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm flex items-center mb-1"><Clock className="mr-2 h-4 w-4 text-primary" />Lịch hẹn ({appointments.length})</h4>
              {appointments.slice(0,2).map(appt => (
                <div key={appt.appointmentId} className="text-xs p-1.5 bg-muted/50 rounded mb-1">
                    <p>{appt.service} - {new Date(appt.date).toLocaleDateString('vi-VN')} lúc {appt.time} ({getStatusLabel(appt.status)})</p>
                </div>
              ))}
              {appointments.length > 2 && <Button variant="link" size="sm" className="p-0 h-auto">Xem tất cả</Button>}
              <Button variant="outline" size="sm" className="w-full mt-1">Lịch hẹn mới</Button>
            </div>
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm flex items-center mb-1">Ghi chú nội bộ</h4>
              <Textarea placeholder="Thêm ghi chú nội bộ cho khách hàng này..." rows={3} className="text-xs"/>
              <Button size="sm" className="mt-1 w-full">Thêm Ghi chú</Button>
            </div>
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
}

import React from 'react';
import { X } from 'lucide-react';


