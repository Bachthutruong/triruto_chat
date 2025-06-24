// src/components/media/MediaHistoryPage.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCustomerMediaMessages, getCustomerDetails } from '@/app/actions';
import type { Message, CustomerProfile, UserSession } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, FileText, Image as ImageIcon, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import NextImage from 'next/image'; // Changed from next/image to NextImage
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('');

  useEffect(() => {
    if (customerId) {
      const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          console.log('[MediaHistoryPage] Fetching data for customerId:', customerId);
          const [mediaData, customerDetailsResult] = await Promise.all([ // Renamed customerDetails to customerDetailsResult
            getCustomerMediaMessages(customerId),
            getCustomerDetails(customerId)
          ]);
          console.log('[MediaHistoryPage] Received media data:', mediaData);
          console.log('[MediaHistoryPage] Media data count:', mediaData.length);
          if (mediaData.length > 0) {
            console.log('[MediaHistoryPage] Sample media messages:', mediaData.slice(0, 3).map(m => ({
              id: m.id,
              sender: m.sender,
              contentStart: m.content.substring(0, 100),
              isCloudinary: m.content.startsWith('https://res.cloudinary.com/'),
              isDataUri: m.content.startsWith('data:')
            })));
          }
          setMediaMessages(mediaData);
          setCustomer(customerDetailsResult.customer); // Access .customer property
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

  const handleImageClick = (dataUri: string, fileName: string) => {
    setSelectedImagePreview(dataUri);
    setSelectedImageName(fileName);
  };

  const renderMediaItem = (message: Message) => {
    // Check for legacy data URI format with filename
    const dataUriRegex = /^(data:[^;]+;base64,[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;
    const dataUriMatch = message.content.match(dataUriRegex);

    // Check for Cloudinary URL format
    const cloudinaryRegex = /^https:\/\/res\.cloudinary\.com\//;
    const isCloudinaryUrl = cloudinaryRegex.test(message.content);

    if (dataUriMatch) {
      // Legacy data URI format
      const fileDataUri = dataUriMatch[1];
      const fileNameEncoded = dataUriMatch[2];
      let fileName = "attached_file";
      try {
        fileName = decodeURIComponent(fileNameEncoded);
      } catch (e) { /* ignore */ }

      return (
        <div key={message.id} className="border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow bg-card">
          {isImageDataURI(fileDataUri) ? (
            <button 
              type="button" 
              onClick={() => handleImageClick(fileDataUri, fileName)}
              className="w-full aspect-video relative rounded-md overflow-hidden mb-2 bg-muted cursor-pointer group"
              title="Nhấn để xem ảnh lớn"
            >
              <NextImage 
                src={fileDataUri} 
                alt={fileName} 
                layout="fill" 
                objectFit="cover" 
                className="rounded-md group-hover:opacity-80 transition-opacity"
                data-ai-hint="historical image"
              />
            </button>
          ) : (
            <a
              href={fileDataUri}
              download={fileName}
              className="flex flex-col items-center justify-center h-32 bg-muted rounded-md mb-2 hover:bg-muted/80 transition-colors"
              title={`Tải về ${fileName}`}
            >
              <FileText className="h-12 w-12 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mt-1 px-1 text-center truncate w-full">{fileName}</span>
            </a>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium truncate max-w-[calc(100%-2.5rem)]" title={fileName}>{fileName}</span>
            <a href={fileDataUri} download={fileName}>
              <Button variant="ghost" size="icon" className="h-7 w-7" title={`Tải về ${fileName}`}>
                <Download className="h-4 w-4" />
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gửi bởi: {message.name || message.sender} lúc {format(new Date(message.timestamp), 'HH:mm', { locale: vi })}
          </p>
        </div>
      );
    } else if (isCloudinaryUrl) {
      // New Cloudinary URL format
      const cloudinaryUrl = message.content;
      const fileName = cloudinaryUrl.split('/').pop() || 'cloudinary_file';
      
      // Determine if it's an image by checking the URL or file extension
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(cloudinaryUrl) || 
                      cloudinaryUrl.includes('/image/upload/');

      return (
        <div key={message.id} className="border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow bg-card">
          {isImage ? (
            <button 
              type="button" 
              onClick={() => handleImageClick(cloudinaryUrl, fileName)}
              className="w-full aspect-video relative rounded-md overflow-hidden mb-2 bg-muted cursor-pointer group"
              title="Nhấn để xem ảnh lớn"
            >
              <NextImage 
                src={cloudinaryUrl} 
                alt={fileName} 
                layout="fill" 
                objectFit="cover" 
                className="rounded-md group-hover:opacity-80 transition-opacity"
                data-ai-hint="cloudinary image"
              />
            </button>
          ) : (
            <a
              href={cloudinaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center h-32 bg-muted rounded-md mb-2 hover:bg-muted/80 transition-colors"
              title={`Xem ${fileName}`}
            >
              <FileText className="h-12 w-12 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mt-1 px-1 text-center truncate w-full">{fileName}</span>
            </a>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium truncate max-w-[calc(100%-2.5rem)]" title={fileName}>{fileName}</span>
            <a href={cloudinaryUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-7 w-7" title={`Xem ${fileName}`}>
                <Download className="h-4 w-4" />
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gửi bởi: {message.name || message.sender} lúc {format(new Date(message.timestamp), 'HH:mm', { locale: vi })}
          </p>
        </div>
      );
    }

    return null;
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
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-xl text-destructive">{error}</p>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {messagesOnDate.map(renderMediaItem)}
                  </div>
                </div>
              ))}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedImagePreview} onOpenChange={(open) => {if (!open) setSelectedImagePreview(null)}}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-2">
          <DialogHeader className="p-2 border-b">
            <DialogTitle className="text-sm truncate">{selectedImageName || "Xem trước ảnh"}</DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-auto p-2 flex items-center justify-center">
            {selectedImagePreview && (
              <NextImage
                src={selectedImagePreview}
                alt={selectedImageName || 'Xem trước ảnh'}
                width={1200} 
                height={800}
                className="max-w-full max-h-full object-contain"
                data-ai-hint="full image preview"
              />
            )}
          </div>
          <div className="p-2 border-t flex justify-end">
            {selectedImagePreview && (
                <a href={selectedImagePreview} download={selectedImageName || 'image.png'}>
                  <Button variant="outline"><Download className="mr-2 h-4 w-4" />Tải về</Button>
                </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
