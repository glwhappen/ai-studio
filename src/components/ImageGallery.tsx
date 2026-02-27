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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Download,
  Trash2,
  MoreVertical,
  Image as ImageIcon,
  Edit3,
  Copy,
} from 'lucide-react';
import type { GeneratedImage, EditImageState } from '@/types';

interface ImageGalleryProps {
  images: GeneratedImage[];
  onDeleteImage: (id: string) => void;
  onEditImage: (editState: EditImageState) => void;
  onReuseSettings: (editState: EditImageState) => void;
}

export function ImageGallery({ images, onDeleteImage, onEditImage, onReuseSettings }: ImageGalleryProps) {
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

  // 继续编辑：将图片作为参考图，填充原有提示词
  const handleEditImage = (image: GeneratedImage) => {
    onEditImage({
      prompt: image.prompt,
      model: image.model,
      aspectRatio: image.aspectRatio,
      imageSize: image.imageSize,
      useCustomSize: image.useCustomSize,
      referenceImageUrl: image.url,
    });
    setIsPreviewOpen(false);
  };

  // 复用设置：使用相同设置，不设置参考图
  const handleReuseSettings = (image: GeneratedImage) => {
    onReuseSettings({
      prompt: image.prompt,
      model: image.model,
      aspectRatio: image.aspectRatio,
      imageSize: image.imageSize,
      useCustomSize: image.useCustomSize,
      referenceImageUrl: '',
    });
    setIsPreviewOpen(false);
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
      {/* 瀑布流图片展示 */}
      <div className="columns-2 md:columns-3 gap-3 space-y-3">
        {images.map((image) => (
          <div
            key={image.id}
            className="group relative overflow-hidden rounded-xl bg-muted cursor-pointer break-inside-avoid"
            onClick={() => {
              setSelectedImage(image);
              setIsPreviewOpen(true);
            }}
          >
            <img
              src={image.url}
              alt={image.prompt}
              className="w-full h-auto transition-transform group-hover:scale-[1.02]"
            />
            {/* 悬停信息层 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-xs text-white line-clamp-2 mb-1">{image.prompt}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/70">{formatDate(image.createdAt)}</p>
                  <div className="flex items-center gap-1">
                    {image.aspectRatio && image.imageSize && (
                      <span className="text-xs text-white/60 bg-white/20 rounded px-1.5 py-0.5">
                        {image.aspectRatio} · {image.imageSize}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* 操作按钮 */}
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
                  <DropdownMenuItem onClick={() => handleEditImage(image)}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    继续编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleReuseSettings(image)}>
                    <Copy className="h-4 w-4 mr-2" />
                    复用设置
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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

      {/* 图片预览弹窗 */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-[90vw] lg:max-w-4xl max-h-[95vh] p-0 gap-0">
          <DialogHeader className="p-4 pb-2 border-b shrink-0">
            <DialogTitle className="font-serif">图片预览</DialogTitle>
            <DialogDescription className="line-clamp-2">
              {selectedImage?.prompt}
            </DialogDescription>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {selectedImage?.model && (
                <span className="bg-muted px-2 py-0.5 rounded">
                  模型: {selectedImage.model.split('/').pop()}
                </span>
              )}
              {selectedImage?.aspectRatio && selectedImage?.imageSize && (
                <span className="bg-muted px-2 py-0.5 rounded">
                  尺寸: {selectedImage.aspectRatio} · {selectedImage.imageSize}
                </span>
              )}
            </div>
          </DialogHeader>
          
          {/* 可滚动的图片区域 */}
          <ScrollArea className="flex-1 max-h-[60vh]">
            {selectedImage && (
              <div className="p-4">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.prompt}
                  className="w-full h-auto rounded-lg"
                />
              </div>
            )}
          </ScrollArea>
          
          {/* 底部操作栏 */}
          <div className="p-4 pt-2 border-t flex flex-wrap justify-end gap-2 shrink-0">
            {selectedImage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditImage(selectedImage)}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  继续编辑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReuseSettings(selectedImage)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  复用设置
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedImage && handleDownload(selectedImage)}
            >
              <Download className="h-4 w-4 mr-2" />
              下载
            </Button>
            <Button
              variant="destructive"
              size="sm"
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
