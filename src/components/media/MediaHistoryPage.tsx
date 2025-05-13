// src/components/media/MediaHistoryPage.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCustomerMediaMessages, getCustomerDetails } from '@/app/actions';
import type { Message, CustomerProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

function isImageDataURI(uri: string): boolean {
  return typeof uri === 'string' && uri.startsWith('data:image/');
}

export default function MediaHistoryPage() {
  const params = useParams();
  const customerId = params.customerId as string;
  const [mediaMessages, setMediaMessages] = useState<Message[]>([]);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerId) {
      const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const [mediaData, customerDetails] = await Promise.all([
            getCustomerMediaMessages(customerId),
            getCustomerDetails(customerId)
          ]);
          setMediaMessages(mediaData);
          setCustomer(customerDetails.customer);
        } catch (err) {
          console.error('Lỗi tải lịch sử media:', err);
          setError('Không thể tải lịch sử media. Vui lòng thử lại.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [customerId]);

  const groupMediaByDate = (messages: Message[]) => {
    return messages.reduce((acc, msg) => {
      const dateKey = format(new Date(msg.timestamp), 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(msg);
      return acc;
    }, {} as Record<string, Message[]>);
  };

  const groupedMedia = groupMediaByDate(mediaMessages);

  const renderMediaItem = (message: Message) => {
    const dataUriRegex = /^(data:[^;]+;base64,[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;
    const match = message.content.match(dataUriRegex);

    if (!match) return null;

    const fileDataUri = match[1];
    const fileNameEncoded = match[2];
    let fileName = "attached_file";
    try {
      fileName = decodeURIComponent(fileNameEncoded);
    } catch (e) { /* ignore */ }

    return (
      <div key={message.id} className="border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow bg-card">
        {isImageDataURI(fileDataUri) ? (
          <div className="w-full aspect-video relative rounded-md overflow-hidden mb-2 bg-muted">
            <Image 
              src={fileDataUri} 
              alt={fileName} 
              layout="fill" 
              objectFit="contain" 
              className="rounded-md"
              data-ai-hint="historical image"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 bg-muted rounded-md mb-2">
            <FileText className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium truncate" title={fileName}>{fileName}</span>
          <a href={fileDataUri} download={fileName}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Download className="h-4 w-4" />
            </Button>
          </a>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Gửi bởi: {message.name || message.sender} lúc {format(new Date(message.timestamp), 'HH:mm', { locale: vi })}
        </p>
      </div>
    );
  };

  const session = typeof window !== 'undefined' ? sessionStorage.getItem('aetherChatUserSession') : null;
  const userRole = session ? (JSON.parse(session) as UserSession).role : null;
  const backUrl = userRole === 'admin' ? `/admin/chat/${customerId}` : `/staff/chat/${customerId}`;


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Đang tải lịch sử media...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Thử lại</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
       <Button variant="outline" asChild className="mb-4">
          <Link href={backUrl}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại Chat
          </Link>
        </Button>
      <Card>
        <CardHeader>
          <CardTitle>Lịch sử File & Hình ảnh</CardTitle>
          <CardDescription>
            Tất cả các file và hình ảnh đã được chia sẻ với {customer?.name || customer?.phoneNumber || 'khách hàng này'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mediaMessages.length === 0 ? (
            <div className="text-center py-10">
              <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Chưa có file hoặc hình ảnh nào được chia sẻ.</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-var(--header-height,4rem)-18rem)]"> {/* Adjust height as needed */}
              {Object.entries(groupedMedia).sort((a,b) => b[0].localeCompare(a[0])).map(([date, messagesOnDate]) => (
                <div key={date} className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 sticky top-0 bg-background/95 py-2 z-10 border-b">
                    {format(new Date(date), 'EEEE, dd MMMM, yyyy', { locale: vi })}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {messagesOnDate.map(renderMediaItem)}
                  </div>
                </div>
              ))}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}