// src/components/chat/PhoneNumberModal.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, LogIn } from 'lucide-react';

type PhoneNumberModalProps = {
  isOpen: boolean;
  onSubmit: (phoneNumber: string) => void; // This is for customer phone number submission
  isLoading?: boolean;
};

export function PhoneNumberModal({ isOpen, onSubmit, isLoading }: PhoneNumberModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.trim()) {
      onSubmit(phoneNumber.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { /* Modal should be controlled by parent state */ }}>
      <DialogContent className="sm:max-w-md"> {/* Increased width from sm:max-w-[425px] */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="text-primary" /> Welcome to AetherChat!
          </DialogTitle>
          <DialogDescription>
            To start chatting, please enter your phone number. This helps us retrieve your past conversations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="col-span-3"
                placeholder="e.g., (123) 456-7890"
                required
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-3 sm:flex-row sm:justify-between items-center">
            <Button type="submit" disabled={isLoading || !phoneNumber.trim()} className="w-full sm:w-auto">
              {isLoading ? 'Loading...' : 'Start Chat'}
            </Button>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" /> Staff/Admin Login
              </Link>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
