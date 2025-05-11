'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, MessageSquarePlus, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import type { CustomerProfile } from '@/lib/types';
import { getCustomersForStaffView } from '@/app/actions';

export default function StaffChatPage() {
  const [activeCustomers, setActiveCustomers] = useState<CustomerProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        const customers = await getCustomersForStaffView();
        // Filter for customers who might need attention or are unassigned
        // This logic would be more complex in a real app (e.g., based on unread messages, assignment status)
        setActiveCustomers(customers.filter(c => !c.assignedStaffId || Math.random() > 0.5).slice(0, 10));
      } catch (error) {
        console.error("Failed to fetch active customers:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const filteredCustomers = activeCustomers.filter(customer =>
    (customer.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    customer.phoneNumber.includes(searchTerm)
  );

  return (
    <div className="flex h-[calc(100vh-var(--header-height,4rem)-2rem)]"> {/* Adjust height based on your header */}
      {/* Customer List / Queue */}
      <Card className="w-1/3 lg:w-1/4 h-full flex flex-col mr-4">
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" /> Customer Queue</CardTitle>
          <CardDescription>Customers waiting or in active chats.</CardDescription>
          <div className="flex gap-2 pt-2">
            <Input 
              placeholder="Search by name or phone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <ScrollArea className="flex-grow">
          <CardContent className="p-0">
            {isLoading && <p className="p-4 text-muted-foreground">Loading customers...</p>}
            {!isLoading && filteredCustomers.length === 0 && <p className="p-4 text-muted-foreground">No active customers found.</p>}
            <ul className="divide-y">
              {filteredCustomers.map(customer => (
                <li key={customer.id}>
                  <Button variant="ghost" className="w-full justify-start h-auto p-3 rounded-none" asChild>
                    <Link href={`/staff/chat/${customer.id}`}>
                      <div className="flex flex-col items-start text-left">
                        <span className="font-semibold">{customer.name || customer.phoneNumber}</span>
                        <span className="text-xs text-muted-foreground">
                          Last active: {new Date(customer.lastInteractionAt).toLocaleTimeString()}
                          {customer.tags && customer.tags.length > 0 && ` | Tags: ${customer.tags.join(', ')}`}
                        </span>
                         {/* Add unread message indicator here */}
                      </div>
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </ScrollArea>
      </Card>

      {/* Chat Window Area (placeholder) */}
      <Card className="flex-grow h-full flex flex-col items-center justify-center">
        <CardContent className="text-center">
          <MessageSquarePlus className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Select a chat</h2>
          <p className="text-muted-foreground">Choose a customer from the list to start or continue a conversation.</p>
          <p className="text-sm mt-2">Or, <Link href="/staff/customers" className="text-primary hover:underline">view all customers</Link>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
