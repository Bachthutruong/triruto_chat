'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Image as ImageIcon, FileText, Loader2, Download } from 'lucide-react';
import NextImage from 'next/image';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (mediaUrl: string, fileName: string) => void;
}

interface CloudinaryMediaItem {
  public_id: string;
  secure_url: string;
  format: string;
  resource_type: string;
  bytes: number;
  width?: number;
  height?: number;
  created_at: string;
  folder?: string;
  filename?: string;
}

function isImageFormat(format: string, resourceType: string): boolean {
  return resourceType === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(format.toLowerCase());
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function MediaLibraryModal({ isOpen, onClose, onSelectMedia }: MediaLibraryModalProps) {
  const [allMedia, setAllMedia] = useState<CloudinaryMediaItem[]>([]);
  const [imageItems, setImageItems] = useState<CloudinaryMediaItem[]>([]);
  const [fileItems, setFileItems] = useState<CloudinaryMediaItem[]>([]);
  const [filteredImageItems, setFilteredImageItems] = useState<CloudinaryMediaItem[]>([]);
  const [filteredFileItems, setFilteredFileItems] = useState<CloudinaryMediaItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<CloudinaryMediaItem | null>(null);
  const [activeTab, setActiveTab] = useState<'media' | 'files'>('media');
  const { toast } = useToast();

  const fetchCloudinaryMedia = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('[MediaLibrary] Fetching from Cloudinary...');
      
      // Fetch all media from all folders
      const response = await fetch('/api/media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folders: ['triruto_chat/messages', 'triruto_chat/notes', 'triruto_chat/general']
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch media from server');
      }

      const data = await response.json();
      const mediaItems: CloudinaryMediaItem[] = data.resources || [];
      
      console.log('[MediaLibrary] Received media items:', mediaItems.length);

      // Separate into images and files
      const images = mediaItems.filter(item => isImageFormat(item.format, item.resource_type));
      const files = mediaItems.filter(item => !isImageFormat(item.format, item.resource_type));
      
      console.log('[MediaLibrary] Images:', images.length, 'Files:', files.length);
      
      setAllMedia(mediaItems);
      setImageItems(images);
      setFileItems(files);
      setFilteredImageItems(images);
      setFilteredFileItems(files);
      
    } catch (error: any) {
      console.error('[MediaLibrary] Error fetching media:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải thư viện media từ Cloudinary. Vui lòng thử lại.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      fetchCloudinaryMedia();
    }
  }, [isOpen, fetchCloudinaryMedia]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      setFilteredImageItems(imageItems.filter(item =>
        (item.filename || '').toLowerCase().includes(searchLower)
      ));
      setFilteredFileItems(fileItems.filter(item =>
        (item.filename || '').toLowerCase().includes(searchLower)
      ));
    } else {
      setFilteredImageItems(imageItems);
      setFilteredFileItems(fileItems);
    }
  }, [searchTerm, imageItems, fileItems]);

  const handleSelectMedia = (item: CloudinaryMediaItem) => {
    const fileName = item.filename || `media.${item.format}`;
    onSelectMedia(item.secure_url, fileName);
    onClose();
    toast({
      title: "Thành công",
      description: `Đã chọn "${fileName}" từ thư viện Cloudinary.`
    });
  };

  const handlePreview = (item: CloudinaryMediaItem) => {
    setSelectedPreview(item);
  };

  const handleClose = () => {
    setSearchTerm('');
    setSelectedPreview(null);
    onClose();
  };

  const renderMediaGrid = (items: CloudinaryMediaItem[], emptyMessage: string) => (
    <div className="flex flex-col h-full">
      {items.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-muted-foreground py-20">
          {searchTerm ? 'Không tìm thấy kết quả phù hợp' : emptyMessage}
        </div>
      ) : (
        <ScrollArea className="flex-1" style={{ maxHeight: 'calc(70vh - 100px)' }}>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-1">
            {items.map((item) => {
              const isImage = isImageFormat(item.format, item.resource_type);
              const fileName = item.filename || `media.${item.format}`;
              const fileSize = formatFileSize(item.bytes);
              const uploadDate = new Date(item.created_at);

              return (
                <div
                  key={item.public_id}
                  className="border rounded-lg p-2 hover:shadow-md transition-all cursor-pointer group relative"
                  onClick={() => handleSelectMedia(item)}
                >
                  <div className="aspect-square relative mb-2 bg-muted rounded-md overflow-hidden">
                    {isImage ? (
                      <NextImage
                        src={item.secure_url}
                        alt={fileName}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        data-ai-hint="cloudinary media library image"
                        sizes="(max-width: 768px) 33vw, (max-width: 1200px) 25vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="flex gap-1">
                        <Button variant="secondary" size="sm">
                          Chọn
                        </Button>
                        {isImage && (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(item);
                            }}
                          >
                            Xem
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium truncate" title={fileName}>
                      {fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(uploadDate, 'dd/MM/yyyy', { locale: vi })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fileSize}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Thư viện Media & Files
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col flex-1 gap-4 min-h-0">
            {/* Search */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm theo tên tệp..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={fetchCloudinaryMedia} disabled={isLoading}>
                Làm mới
              </Button>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex items-center justify-center flex-1">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Đang tải...</span>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'media' | 'files')} className="flex flex-col flex-1 min-h-0">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="media" className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Ảnh & Hình ảnh ({filteredImageItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="files" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Tài liệu & Files ({filteredFileItems.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="media" className="flex-1 mt-4 min-h-0">
                  {renderMediaGrid(filteredImageItems, 'Chưa có ảnh nào trong thư viện Cloudinary')}
                </TabsContent>
                
                <TabsContent value="files" className="flex-1 mt-4 min-h-0">
                  {renderMediaGrid(filteredFileItems, 'Chưa có tài liệu nào trong thư viện Cloudinary')}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {selectedPreview && (
        <Dialog open={!!selectedPreview} onOpenChange={() => setSelectedPreview(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex flex-row items-center justify-between">
              <DialogTitle className="truncate">
                {selectedPreview.filename || `media.${selectedPreview.format}`}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectMedia(selectedPreview)}
                >
                  Chọn tệp này
                </Button>
                <a href={selectedPreview.secure_url} download={selectedPreview.filename} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-auto flex items-center justify-center">
              <NextImage
                src={selectedPreview.secure_url}
                alt={selectedPreview.filename || 'Preview'}
                width={800}
                height={600}
                className="max-w-full max-h-full object-contain"
                data-ai-hint="cloudinary media preview"
              />
            </div>
            <div className="border-t pt-2 text-sm text-muted-foreground">
              <div className="flex justify-between items-center">
                <span>Kích thước: {formatFileSize(selectedPreview.bytes)}</span>
                <span>Tải lên: {format(new Date(selectedPreview.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}</span>
              </div>
              {selectedPreview.width && selectedPreview.height && (
                <span>Độ phân giải: {selectedPreview.width}x{selectedPreview.height}px</span>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
} 