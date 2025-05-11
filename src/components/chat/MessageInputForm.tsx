'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

type MessageInputFormProps = {
  onSubmit: (messageContent: string) => void;
  isLoading?: boolean;
};

export function MessageInputForm({ onSubmit, isLoading }: MessageInputFormProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSubmit(message.trim());
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t bg-card flex items-center gap-2">
      <Input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message..."
        className="flex-grow"
        disabled={isLoading}
        autoComplete="off"
      />
      <Button type="submit" size="icon" disabled={isLoading || !message.trim()}>
        <Send className="h-5 w-5" />
        <span className="sr-only">Send message</span>
      </Button>
    </form>
  );
}
