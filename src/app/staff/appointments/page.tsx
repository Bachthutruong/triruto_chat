'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar'; 
import { PlusCircle, ListFilter, Edit, Trash2 } from 'lucide-react';
import type { AppointmentDetails } from '@/lib/types';
// import { getAppointmentsByDateRange, createAppointment, updateAppointment, deleteAppointment } from '@/app/actions';

// Dữ liệu mẫu bằng tiếng Việt
const MOCK_APPOINTMENTS_STAFF: AppointmentDetails[] = [
    { appointmentId: 's_appt_1', userId: 'cust_abc', service: 'Cắt tóc', date: '2024-08-15', time: '10:00 SA', status: 'booked', branch: 'Chi nhánh Chính', staffId: 'staff_001_user', createdAt: new Date(), updatedAt: new Date() },
    { appointmentId: 's_appt_2', userId: 'cust_def', service: 'Làm móng', date: '2024-08-15', time: '11:30 SA', status: 'booked', branch: 'Chi nhánh Phụ', staffId: 'staff_002_user', createdAt: new Date(), updatedAt: new Date() },
    { appointmentId: 's_appt_3', userId: 'cust_ghi', service: 'Chăm sóc da mặt', date: '2024-08-16', time: '02:00 CH', status: 'completed', branch: 'Chi nhánh Chính', staffId: 'staff_001_user', createdAt: new Date(), updatedAt: new Date() },
];


export default function StaffAppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<AppointmentDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!selectedDate) return;
      setIsLoading(true);
      
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23,59,59,999);

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const filtered = MOCK_APPOINTMENTS_STAFF.filter(appt => {
        // Ensure date comparison is robust, assuming appt.date is YYYY-MM-DD
        const apptDateParts = appt.date.split('-');
        const apptDate = new Date(parseInt(apptDateParts[0]), parseInt(apptDateParts[1]) - 1, parseInt(apptDateParts[2]));
        
        return apptDate.getFullYear() === dayStart.getFullYear() &&
               apptDate.getMonth() === dayStart.getMonth() &&
               apptDate.getDate() === dayStart.getDate();
      });
      setAppointments(filtered);
      setIsLoading(false);
    };
    fetchAppointments();
  }, [selectedDate]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý Lịch hẹn</h1>
          <p className="text-muted-foreground">Xem, tạo và quản lý lịch hẹn của khách hàng.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Tạo Lịch hẹn Mới
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Chọn Ngày</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              // locale="vi" prop removed as it's handled internally by Calendar component
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lịch hẹn ngày {selectedDate ? selectedDate.toLocaleDateString('vi-VN') : 'N/A'}</CardTitle>
                <CardDescription>Danh sách các lịch hẹn đã đặt.</CardDescription>
              </div>
              <Button variant="outline" size="sm"><ListFilter className="mr-2 h-4 w-4" /> Lọc</Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Đang tải lịch hẹn...</p>
            ) : appointments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Không có lịch hẹn nào cho ngày này.</p>
            ) : (
              <ul className="space-y-3">
                {appointments.map(appt => (
                  <li key={appt.appointmentId} className="p-4 border rounded-lg bg-card shadow hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{appt.service} - {appt.time}</h3>
                        <p className="text-sm text-muted-foreground">Mã KH: {appt.userId} | Chi nhánh: {appt.branch || 'Chưa có'}</p>
                        <p className="text-sm"><span className={`px-2 py-0.5 text-xs rounded-full ${appt.status === 'booked' ? 'bg-blue-100 text-blue-700' : appt.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{getStatusLabel(appt.status)}</span></p>
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
