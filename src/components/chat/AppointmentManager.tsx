'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Trash2, PlusCircle } from 'lucide-react';
import type { AppointmentDetails } from '@/lib/types';

type AppointmentManagerProps = {
    isOpen: boolean;
    onClose: () => void;
    appointments: AppointmentDetails[];
    onCancelAppointment: (appointmentId: string) => Promise<void>;
    onBookNewAppointmentClick?: () => void;
    canBookNew?: boolean;
};

export function AppointmentManager({ isOpen, onClose, appointments, onCancelAppointment, onBookNewAppointmentClick, canBookNew = true }: AppointmentManagerProps) {
    const filteredAppointments = appointments
        .filter(appointment => {
            const appointmentDate = parseISO(appointment.date);
            const [hours, minutes] = appointment.time.split(':').map(Number);
            const appointmentDateTime = new Date(
                appointmentDate.getFullYear(),
                appointmentDate.getMonth(),
                appointmentDate.getDate(),
                hours,
                minutes
            );
            return appointmentDateTime > new Date();
        })
        .sort((a, b) => {
            const dateA = parseISO(a.date);
            const dateB = parseISO(b.date);
            const [hoursA, minutesA] = a.time.split(':').map(Number);
            const [hoursB, minutesB] = b.time.split(':').map(Number);

            const dateTimeA = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate(), hoursA, minutesA);
            const dateTimeB = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate(), hoursB, minutesB);

            return dateTimeB.getTime() - dateTimeA.getTime();
        });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle>Lịch hẹn của bạn</DialogTitle>
                    {onBookNewAppointmentClick && canBookNew && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { onClose(); onBookNewAppointmentClick(); }}
                            title="Đặt lịch hẹn mới"
                            className="flex items-center gap-1"
                        >
                            <PlusCircle className="h-4 w-4" />
                            <span>Đặt lịch hẹn mới</span>
                        </Button>
                    )}
                </DialogHeader>
                <ScrollArea className="max-h-[400px] pr-4">
                    {filteredAppointments.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                            Bạn chưa có lịch hẹn nào
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredAppointments.map((appointment) => (
                                <div key={appointment.appointmentId} className="border rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-medium">{appointment.service}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {format(parseISO(appointment.date), 'EEEE, dd/MM/yyyy', { locale: vi })}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {appointment.time} - {appointment.branch}
                                            </p>
                                        </div>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Hủy lịch hẹn</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Bạn có chắc chắn muốn hủy lịch hẹn này không?
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Không</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => appointment.appointmentId && onCancelAppointment(appointment.appointmentId)}
                                                    >
                                                        Có, hủy lịch
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
} 