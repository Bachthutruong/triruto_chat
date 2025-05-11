'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar'; // ShadCN Calendar
import { PlusCircle, ListFilter, Edit, Trash2 } from 'lucide-react';
import type { AppointmentDetails } from '@/lib/types';
// Mock action, replace with actual API call
// import { getAppointmentsByDateRange, createAppointment, updateAppointment, deleteAppointment } from '@/app/actions';

// Mock Data
const MOCK_APPOINTMENTS_STAFF: AppointmentDetails[] = [
    { appointmentId: 's_appt_1', userId: 'cust_abc', service: 'Haircut', date: '2024-08-15', time: '10:00 AM', status: 'booked', branch: 'Main Street', staffId: 'staff_001_user', createdAt: new Date(), updatedAt: new Date() },
    { appointmentId: 's_appt_2', userId: 'cust_def', service: 'Manicure', date: '2024-08-15', time: '11:30 AM', status: 'booked', branch: 'Oak Avenue', staffId: 'staff_002_user', createdAt: new Date(), updatedAt: new Date() },
    { appointmentId: 's_appt_3', userId: 'cust_ghi', service: 'Facial', date: '2024-08-16', time: '02:00 PM', status: 'completed', branch: 'Main Street', staffId: 'staff_001_user', createdAt: new Date(), updatedAt: new Date() },
];


export default function StaffAppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<AppointmentDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!selectedDate) return;
      setIsLoading(true);
      // Replace with actual API call:
      // const fetchedAppointments = await getAppointmentsByDateRange(selectedDate, selectedDate);
      // For demo, filter mock data
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23,59,59,999);

      const filtered = MOCK_APPOINTMENTS_STAFF.filter(appt => {
        const apptDate = new Date(appt.date); // Assuming YYYY-MM-DD format
        return apptDate >= dayStart && apptDate <= dayEnd;
      });
      setAppointments(filtered);
      setIsLoading(false);
    };
    fetchAppointments();
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Appointments</h1>
          <p className="text-muted-foreground">View, create, and manage customer appointments.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Appointment
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Calendar View */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Appointments List for selected date */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Appointments for {selectedDate ? selectedDate.toLocaleDateString() : 'N/A'}</CardTitle>
                <CardDescription>List of scheduled appointments.</CardDescription>
              </div>
              <Button variant="outline" size="sm"><ListFilter className="mr-2 h-4 w-4" /> Filter</Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Loading appointments...</p>
            ) : appointments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No appointments scheduled for this date.</p>
            ) : (
              <ul className="space-y-3">
                {appointments.map(appt => (
                  <li key={appt.appointmentId} className="p-4 border rounded-lg bg-card shadow hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{appt.service} - {appt.time}</h3>
                        <p className="text-sm text-muted-foreground">Customer ID: {appt.userId} | Branch: {appt.branch || 'N/A'}</p>
                        <p className="text-sm"><span className={`px-2 py-0.5 text-xs rounded-full ${appt.status === 'booked' ? 'bg-blue-100 text-blue-700' : appt.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{appt.status}</span></p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
