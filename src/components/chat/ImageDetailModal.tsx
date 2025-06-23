'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Download, X, ZoomIn, ZoomOut, RotateCw, Maximize2, StickyNote, Calendar, User } from 'lucide-react';
import NextImage from 'next/image';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { Note } from '@/lib/types';

interface ImageDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  fileName: string;
  notes?: Note[];
  sender?: {
    name: string;
    role?: string;
  };
  timestamp?: Date;
}

export function ImageDetailModal({
  isOpen,
  onClose,
  imageUrl,
  fileName,
  notes = [],
  sender,
  timestamp
}: ImageDetailModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  const formatFileSize = (url: string) => {
    // Estimate file size from image dimensions or fetch if needed
    return 'Không xác định';
  };

  // Avoid SSR mismatch
  if (!isMounted) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isFullscreen ? 'max-w-screen max-h-screen w-screen h-screen' : 'max-w-6xl max-h-[95vh]'} p-0 flex flex-col`}>
        {/* Header */}
        <DialogHeader className="p-4 border-b bg-background">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="truncate text-lg font-semibold">
                {fileName}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                {sender && (
                  <>
                    <User className="h-4 w-4" />
                    <span>{sender.name}</span>
                    {sender.role && (
                      <Badge variant="secondary" className="text-xs">
                        {sender.role === 'staff' ? 'Nhân viên' : sender.role === 'admin' ? 'Quản trị' : 'Khách hàng'}
                      </Badge>
                    )}
                  </>
                )}
                {timestamp && (
                  <>
                    <Calendar className="h-4 w-4 ml-2" />
                    <span>{format(timestamp, 'dd/MM/yyyy HH:mm', { locale: vi })}</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-1 ml-4">
              <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Thu nhỏ">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs px-2 min-w-[4rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Phóng to">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleRotate} title="Xoay">
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} title="Toàn màn hình">
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleReset} title="Reset">
                Reset
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <a href={imageUrl} download={fileName} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" title="Tải về">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          {/* Image View */}
          <div className="flex-1 flex items-center justify-center bg-black/5 relative overflow-hidden">
            <div 
              className="relative transition-transform duration-200 ease-out"
              style={{ 
                transform: `scale(${scale}) rotate(${rotation}deg)`,
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            >
              <NextImage
                src={imageUrl}
                alt={fileName}
                width={800}
                height={600}
                className="max-w-full max-h-full object-contain"
                data-ai-hint="detailed image view"
                style={{
                  maxWidth: isFullscreen ? '90vw' : '600px',
                  maxHeight: isFullscreen ? '80vh' : '500px'
                }}
              />
            </div>
          </div>

          {/* Side Panel - Notes & Info */}
          <div className="w-80 border-l bg-background flex flex-col">
            {/* Image Info */}
            <Card className="m-4 mb-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Thông tin tệp</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kích thước:</span>
                  <span>{formatFileSize(imageUrl)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Định dạng:</span>
                  <span>{fileName.split('.').pop()?.toUpperCase() || 'Unknown'}</span>
                </div>
                {timestamp && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Thời gian:</span>
                    <span>{format(timestamp, 'HH:mm dd/MM/yyyy', { locale: vi })}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes Section */}
            {notes.length > 0 && (
              <Card className="mx-4 mb-4 flex-1 flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    Ghi chú liên quan ({notes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-2">
                  <ScrollArea className="h-full">
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="p-2 bg-muted/30 rounded-md">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-primary">
                              {note.staffName || 'Nhân viên'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(note.createdAt, 'dd/MM HH:mm', { locale: vi })}
                            </span>
                          </div>
                          {note.content && (
                            <p className="text-xs text-foreground whitespace-pre-wrap mb-2">
                              {note.content}
                            </p>
                          )}
                          {note.imageUrl && (
                            <div className="relative w-full aspect-video bg-muted rounded overflow-hidden">
                              <NextImage
                                src={note.imageUrl}
                                alt={note.imageFileName || 'Note image'}
                                fill
                                className="object-cover"
                                data-ai-hint="note attachment"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* No notes message */}
            {notes.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
                <div className="text-center">
                  <StickyNote className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Chưa có ghi chú nào</p>
                  <p className="text-xs mt-1">Ghi chú sẽ hiển thị tại đây</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 