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
import {
  Download,
  Trash2,
  MoreVertical,
  Image as ImageIcon,
  Globe,
  GlobeLock,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  Bot,
  Copy,
  Pencil,
} from 'lucide-react';
import type { ImageRecord, ImageStatus } from '@/hooks/useAppState';

interface ImageGalleryProps {
  images: ImageRecord[];
  onDeleteImage: (id: string) => void;
  onTogglePublic?: (id: string, isPublic: boolean) => void;
  onEdit?: (image: ImageRecord) => void;
  showStatus?: boolean;
}

// 状态图标
function StatusIcon({ status }: { status: ImageStatus }) {
  switch (status) {
    case 'pending':
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    case 'processing':
      return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    case 'completed':
      return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    default:
      return null;
  }
}

// 状态文本
function StatusText({ status }: { status: ImageStatus }) {
  switch (status) {
    case 'pending':
      return '等待中';
    case 'processing':
      return '生成中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return '';
  }
}

export function ImageGallery({ images, onDeleteImage, onTogglePublic, onEdit, showStatus = false }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleDownload = async (image: ImageRecord) => {
    if (!image.image_url) return;
    
    try {
      const response = await fetch(image.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-${image.id.slice(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // 复制提示词
  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch (error) {
      console.error('Copy failed:', error);
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

  // 获取尺寸显示文本
  const getSizeText = (image: ImageRecord): string | null => {
    const config = image.config as Record<string, unknown> | null;
    
    if (image.provider === 'gemini' && config?.aspectRatio && config?.imageSize) {
      return `${config.aspectRatio} · ${config.imageSize}`;
    }
    if (image.provider === 'openai' && config?.size) {
      return config.size as string;
    }
    return null;
  };

  // 只显示完成的图片
  const displayImages = showStatus ? images : images.filter(img => img.status === 'completed' && img.image_url);

  if (displayImages.length === 0) {
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
      <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
        {displayImages.map((image) => (
          <div
            key={image.id}
            className="group relative overflow-hidden rounded-xl bg-muted break-inside-avoid"
          >
            {/* 图片或状态占位 */}
            {image.status === 'completed' && image.image_url ? (
              <img
                src={image.image_url}
                alt={image.prompt}
                className="w-full h-auto cursor-pointer transition-transform group-hover:scale-[1.02]"
                onClick={() => {
                  setSelectedImage(image);
                  setIsPreviewOpen(true);
                }}
              />
            ) : (
              <div className="aspect-square max-h-48 flex flex-col items-center justify-center gap-2 bg-muted/50 p-3">
                <StatusIcon status={image.status} />
                <span className="text-xs text-muted-foreground">
                  {StatusText({ status: image.status })}
                </span>
                {image.status === 'failed' && image.error_message && (
                  <span className="text-xs text-red-500 text-center line-clamp-2" title={image.error_message}>
                    {image.error_message}
                  </span>
                )}
              </div>
            )}
            
            {/* 悬停信息层 - 仅完成的图片 */}
            {image.status === 'completed' && image.image_url && (
              <div 
                className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => {
                  setSelectedImage(image);
                  setIsPreviewOpen(true);
                }}
              >
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-xs text-white line-clamp-2 mb-1">{image.prompt}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/70">{formatDate(image.created_at)}</p>
                    <div className="flex items-center gap-1">
                      {getSizeText(image) && (
                        <span className="text-xs text-white/60 bg-white/20 rounded px-1.5 py-0.5">
                          {getSizeText(image)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* 状态标识 */}
            {showStatus && image.status !== 'completed' && (
              <div className="absolute top-2 left-2 bg-background/80 rounded-full px-2 py-1 flex items-center gap-1">
                <StatusIcon status={image.status} />
                <span className="text-xs">{StatusText({ status: image.status })}</span>
              </div>
            )}
            
            {/* 提供商标识 */}
            {image.status === 'completed' && image.image_url && (
              <div className="absolute top-2 left-2">
                {image.provider === 'gemini' ? (
                  <div className="bg-primary/80 rounded-full p-1">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                ) : (
                  <div className="bg-blue-500/80 rounded-full p-1">
                    <Bot className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
            )}
            
            {/* 公开状态标识 */}
            {image.is_public && (
              <div className="absolute top-2 right-10 bg-green-500/80 rounded-full p-1" title="已公开">
                <Globe className="h-3 w-3 text-white" />
              </div>
            )}
            
            {/* 操作按钮 */}
            {image.status === 'completed' && image.image_url && (
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
                    {onTogglePublic && (
                      <DropdownMenuItem onClick={() => onTogglePublic(image.id, !image.is_public)}>
                        {image.is_public ? (
                          <>
                            <GlobeLock className="h-4 w-4 mr-2" />
                            取消公开
                          </>
                        ) : (
                          <>
                            <Globe className="h-4 w-4 mr-2" />
                            公开到作品集
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleCopyPrompt(image.prompt)}>
                      <Copy className="h-4 w-4 mr-2" />
                      复制提示词
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleDownload(image)}>
                      <Download className="h-4 w-4 mr-2" />
                      下载图片
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDeleteImage(image.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            
            {/* 操作按钮 - 失败状态 */}
            {image.status === 'failed' && onEdit && (
              <div className="absolute top-2 right-2 flex gap-1">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onEdit(image)}
                  title="编辑重试"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onDeleteImage(image.id)}
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            
            {/* 删除按钮 - pending/processing 状态 */}
            {(image.status === 'pending' || image.status === 'processing') && (
              <div className="absolute top-2 right-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onDeleteImage(image.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 图片预览弹窗 */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="font-serif">图片预览</DialogTitle>
            <DialogDescription className="sr-only">
              图片详细信息和操作
            </DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              {/* 图片 */}
              <div className="relative bg-muted rounded-lg overflow-hidden">
                <img
                  src={selectedImage.image_url!}
                  alt={selectedImage.prompt}
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>
              
              {/* 信息 */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">提示词:</span>
                  <p className="text-sm">{selectedImage.prompt}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>模型: {selectedImage.model}</span>
                  {getSizeText(selectedImage) && <span>尺寸: {getSizeText(selectedImage)}</span>}
                  <span>{formatDate(selectedImage.created_at)}</span>
                </div>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex items-center gap-2 pt-2">
                {onTogglePublic && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onTogglePublic(selectedImage.id, !selectedImage.is_public);
                      setSelectedImage({ ...selectedImage, is_public: !selectedImage.is_public });
                    }}
                  >
                    {selectedImage.is_public ? (
                      <>
                        <GlobeLock className="h-4 w-4 mr-1.5" />
                        取消公开
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4 mr-1.5" />
                        公开到作品集
                      </>
                    )}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleDownload(selectedImage)}>
                  <Download className="h-4 w-4 mr-1.5" />
                  下载
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    handleCopyPrompt(selectedImage.prompt);
                  }}
                >
                  <Copy className="h-4 w-4 mr-1.5" />
                  复制提示词
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="ml-auto"
                  onClick={() => {
                    onDeleteImage(selectedImage.id);
                    setIsPreviewOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  删除
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
