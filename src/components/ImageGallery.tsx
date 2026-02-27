'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  Trash2,
  MoreVertical,
  ZoomIn,
  Image as ImageIcon,
} from 'lucide-react';
import type { GeneratedImage } from '@/types';

interface ImageGalleryProps {
  images: GeneratedImage[];
  onDeleteImage: (id: string) => void;
}

export function ImageGallery({ images, onDeleteImage }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleDownload = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gemini-${image.id.slice(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">还没有生成的图片</p>
        <p className="text-sm text-muted-foreground mt-1">
          输入提示词开始创作吧
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((image) => (
          <div
            key={image.id}
            className="group relative aspect-square overflow-hidden rounded-xl bg-muted cursor-pointer"
            onClick={() => {
              setSelectedImage(image);
              setIsPreviewOpen(true);
            }}
          >
            <img
              src={image.url}
              alt={image.prompt}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-xs text-white line-clamp-2">{image.prompt}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-white/70">{formatDate(image.createdAt)}</p>
                  {image.model && (
                    <span className="text-xs text-white/60 bg-white/20 rounded px-1.5 py-0.5">
                      {image.model.split('/').pop()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDownload(image)}>
                    <Download className="h-4 w-4 mr-2" />
                    下载图片
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDeleteImage(image.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      {/* 图片预览 */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-serif">图片预览</DialogTitle>
            <DialogDescription className="line-clamp-2">
              {selectedImage?.prompt}
            </DialogDescription>
            {selectedImage?.model && (
              <p className="text-xs text-muted-foreground">
                模型: {selectedImage.model.split('/').pop()}
              </p>
            )}
          </DialogHeader>
          {selectedImage && (
            <div className="relative">
              <img
                src={selectedImage.url}
                alt={selectedImage.prompt}
                className="w-full rounded-lg"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => selectedImage && handleDownload(selectedImage)}
            >
              <Download className="h-4 w-4 mr-2" />
              下载
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedImage) {
                  onDeleteImage(selectedImage.id);
                  setIsPreviewOpen(false);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
