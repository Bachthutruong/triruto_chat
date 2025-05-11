'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, Users, CalendarCheck, ArrowRight } from 'lucide-react';
import type { CustomerProfile } from '@/lib/types';
import { getCustomersForStaffView } from '@/app/actions';
import Link from 'next/link';

export default function StaffDashboardPage() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        const fetchedCustomers = await getCustomersForStaffView();
        setCustomers(fetchedCustomers);
      } catch (error) {
        console.error("Failed to fetch customers:", error);
        // Add toast notification
      } finally {
        setIsLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Staff Dashboard</h1>
      <p className="text-muted-foreground">Manage customer interactions and appointments.</p>

       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div> {/* Placeholder */}
            <p className="text-xs text-muted-foreground">2 waiting for response</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div> {/* Placeholder */}
            <p className="text-xs text-muted-foreground">3 upcoming</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div> {/* Placeholder */}
            <p className="text-xs text-muted-foreground">Total customers</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Queue / Recent Interactions</CardTitle>
          <CardDescription>Customers needing attention or recently interacted with.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading customers...</p>
          ) : customers.length === 0 ? (
            <p>No customers to display.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Last Interaction</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.slice(0, 5).map((customer) => ( // Show top 5 for dashboard
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name || 'N/A'}</TableCell>
                    <TableCell>{customer.phoneNumber}</TableCell>
                    <TableCell>{new Date(customer.lastInteractionAt).toLocaleString()}</TableCell>
                    <TableCell>{customer.tags?.join(', ') || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/staff/chat/${customer.id}`}>
                          Open Chat <ArrowRight className="ml-2 h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
           {customers.length > 5 && (
             <div className="mt-4 text-center">
                <Button variant="link" asChild><Link href="/staff/customers">View All Customers</Link></Button>
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
