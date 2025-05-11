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
import type { CustomerProfile, Message, AppointmentDetails } from '@/lib/types';
import { getCustomerDetails } from '@/app/actions'; // Assuming this function exists
// import { StaffMessageBubble } from '@/components/staff/StaffMessageBubble'; // TODO: Create this
// import { StaffMessageInput } from '@/components/staff/StaffMessageInput'; // TODO: Create this
// import { InternalNotesSection } from '@/components/staff/InternalNotesSection'; // TODO: Create this
// import { CustomerDetailsPanel } from '@/components/staff/CustomerDetailsPanel'; // TODO: Create this

export default function StaffIndividualChatPage() {
  const params = useParams();
  const customerId = params.customerId as string;

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (customerId) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const { customer: fetchedCustomer, messages: fetchedMessages, appointments: fetchedAppointments } = await getCustomerDetails(customerId);
          setCustomer(fetchedCustomer);
          setMessages(fetchedMessages || []);
          setAppointments(fetchedAppointments || []);
        } catch (error) {
          console.error("Failed to fetch customer details:", error);
          // Add toast notification
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [customerId]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !customer) return;
    // TODO: Implement sendMessage action for staff
    console.log(`Staff sending to ${customer.id}: ${newMessage}`);
    // Mock adding message
    const staffMessage: Message = {
        id: `staff_msg_${Date.now()}`,
        sender: 'ai', // Representing staff as 'ai' for now in Message type, or update Message type
        content: newMessage,
        timestamp: new Date(),
        name: "Staff Member" // Current staff name
    };
    setMessages(prev => [...prev, staffMessage]);
    setNewMessage('');
  };
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><p>Loading chat...</p></div>;
  }

  if (!customer) {
    return <div className="flex items-center justify-center h-full"><p>Customer not found.</p></div>;
  }

  return (
    <div className="flex h-[calc(100vh-var(--header-height,4rem)-2rem)] gap-4">
      {/* Main Chat Area */}
      <Card className="flex-grow h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={`https://picsum.photos/seed/${customer.id}/40/40`} data-ai-hint="profile avatar" />
              <AvatarFallback>{customer.name?.charAt(0) || customer.phoneNumber.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{customer.name || customer.phoneNumber}</CardTitle>
              <p className="text-xs text-muted-foreground">Last active: {new Date(customer.lastInteractionAt).toLocaleTimeString()} {customer.assignedStaffId ? `(Assigned to: ${customer.assignedStaffId})` : "(Unassigned)"}</p>
            </div>
          </div>
          <div>
            {/* Actions like assign staff, pin chat etc. */}
            <Button variant="outline" size="sm">More Actions</Button>
          </div>
        </CardHeader>

        <ScrollArea className="flex-grow p-4 bg-muted/20">
          <div className="space-y-3">
            {messages.map(msg => (
              // Replace with StaffMessageBubble later
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] p-3 rounded-lg ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background shadow'}`}>
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-xs mt-1 opacity-70 text-right">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {/* Placeholder for Message Input */}
        <CardFooter className="p-4 border-t">
            <div className="flex w-full items-center gap-2">
                <Button variant="ghost" size="icon"><Smile className="h-5 w-5 text-muted-foreground" /></Button>
                <Button variant="ghost" size="icon"><Paperclip className="h-5 w-5 text-muted-foreground" /></Button>
                <Input 
                    type="text" 
                    placeholder="Type your message..." 
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

      {/* Right Panel: Customer Details, Notes, Products, Appointments */}
      <Card className="w-1/3 lg:w-1/4 h-full flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center"><Info className="mr-2 h-5 w-5" /> Customer Info</CardTitle>
        </CardHeader>
        <ScrollArea className="flex-grow">
          <CardContent className="p-4 space-y-4">
            <div>
              <h4 className="font-semibold text-sm flex items-center mb-1"><UserCircle className="mr-2 h-4 w-4 text-primary" />Details</h4>
              <p className="text-xs"><span className="text-muted-foreground">Phone:</span> {customer.phoneNumber}</p>
              <p className="text-xs"><span className="text-muted-foreground">Internal Name:</span> {customer.internalName || 'N/A'} <Button variant="ghost" size="icon" className="h-5 w-5 ml-1"><Edit2 className="h-3 w-3"/></Button></p>
              <p className="text-xs"><span className="text-muted-foreground">Tags:</span> {customer.tags?.join(', ') || 'None'} <Button variant="ghost" size="icon" className="h-5 w-5 ml-1"><Tag className="h-3 w-3"/></Button></p>
            </div>
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm flex items-center mb-1"><Clock className="mr-2 h-4 w-4 text-primary" />Appointments ({appointments.length})</h4>
              {/* Placeholder for appointments list */}
              {appointments.slice(0,2).map(appt => (
                <div key={appt.appointmentId} className="text-xs p-1.5 bg-muted/50 rounded mb-1">
                    <p>{appt.service} - {new Date(appt.date).toLocaleDateString()} at {appt.time} ({appt.status})</p>
                </div>
              ))}
              {appointments.length > 2 && <Button variant="link" size="sm" className="p-0 h-auto">View all</Button>}
              <Button variant="outline" size="sm" className="w-full mt-1">New Appointment</Button>
            </div>
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm flex items-center mb-1">Internal Notes</h4>
               {/* Placeholder for InternalNotesSection */}
              <Textarea placeholder="Add an internal note for this customer..." rows={3} className="text-xs"/>
              <Button size="sm" className="mt-1 w-full">Add Note</Button>
            </div>
             {/* Placeholder for products/services section */}
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
}

// Ensure React is imported if not already by Next.js conventions for client components
import React from 'react';
import { Textarea } from '@/components/ui/textarea'; // Ensure Textarea is imported

