'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ImageViewer } from '@/components/ImageViewer';
import { ImagePreviewPanel, type PreviewImageInfo } from '@/components/ImagePreviewPanel';
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
  RefreshCw,
  Wand2,
} from 'lucide-react';
import type { ImageRecord, ImageStatus } from '@/hooks/useAppState';

interface ImageGalleryProps {
  images: ImageRecord[];
  onDeleteImage: (id: string) => void;
  onTogglePublic?: (id: string, isPublic: boolean) => void;
  onEdit?: (image: ImageRecord) => void;
  showStatus?: boolean;
}

// 构建创作链接参数
function buildCreateUrl(image: ImageRecord): string {
  const params = new URLSearchParams();
  params.set('prompt', image.prompt);
  params.set('model', image.model);
  params.set('provider', image.provider);
  
  const config = image.config as Record<string, unknown> | null;
  if (config) {
    if (config.aspectRatio) params.set('aspectRatio', config.aspectRatio as string);
    if (config.imageSize) params.set('imageSize', config.imageSize as string);
    if (config.size) params.set('size', config.size as string);
    // 如果有参考图 URL，传递给创作页面
    if (config.referenceImageUrl) {
      params.set('referenceImageUrl', config.referenceImageUrl as string);
    }
  }
  
  return `/?${params.toString()}`;
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
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleDownload = async (image: ImageRecord) => {
    if (!image.image_url) return;
    
    // 使用原始 URL 下载（代理 URL 可能有问题）
    const downloadUrl = image.original_url || image.image_url;
    
    try {
      const response = await fetch(downloadUrl);
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
  
  // 图片加载错误处理
  const handleImageError = (imageId: string) => {
    setFailedImages(prev => new Set(prev).add(imageId));
  };
  
  // 重试加载图片
  const handleRetryImage = (imageId: string) => {
    setFailedImages(prev => {
      const next = new Set(prev);
      next.delete(imageId);
      return next;
    });
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
        {displayImages.map((image) => {
          const hasError = failedImages.has(image.id);
          
          return (
            <div
              key={image.id}
              className="group relative overflow-hidden rounded-xl bg-muted break-inside-avoid"
            >
              {/* 图片或状态占位 */}
              {image.status === 'completed' && image.image_url ? (
                hasError ? (
                  // 加载失败显示
                  <div className="aspect-square flex flex-col items-center justify-center gap-2 p-4 bg-muted/50">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground text-center">图片加载失败</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1"
                      onClick={() => handleRetryImage(image.id)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      重试
                    </Button>
                  </div>
                ) : (
                  <img
                    src={image.thumbnail_url || image.image_url}
                    alt={image.prompt}
                    className="w-full h-auto cursor-pointer transition-transform group-hover:scale-[1.02]"
                    onClick={() => {
                      setSelectedImage(image);
                      setIsPreviewOpen(true);
                    }}
                    onError={() => handleImageError(image.id)}
                    loading="lazy"
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 bg-muted/50 p-4 min-h-[120px]">
                  <StatusIcon status={image.status} />
                  <span className="text-xs text-muted-foreground">
                    {StatusText({ status: image.status })}
                  </span>
                  {image.status === 'failed' && image.error_message && (
                    <span className="text-xs text-red-500 text-center line-clamp-2 max-w-full" title={image.error_message}>
                      {image.error_message.length > 50 ? image.error_message.slice(0, 50) + '...' : image.error_message}
                    </span>
                  )}
                </div>
              )}
              
              {/* 悬停信息层 - 仅完成的图片且未加载失败 */}
              {image.status === 'completed' && image.image_url && !hasError && (
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
              {image.status === 'completed' && image.image_url && !hasError && (
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
            {image.is_public && !hasError && (
              <div className="absolute top-2 right-10 bg-green-500/80 rounded-full p-1" title="已公开">
                <Globe className="h-3 w-3 text-white" />
              </div>
            )}
            
            {/* 操作按钮 */}
            {image.status === 'completed' && image.image_url && !hasError && (
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
            {image.status === 'failed' && (
              <div className="absolute top-2 right-2 flex gap-1">
                {onEdit && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(image);
                    }}
                    title="编辑重试"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteImage(image.id);
                  }}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteImage(image.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* 全屏图片查看器 */}
      <ImageViewer
        src={selectedImage?.image_url || ''}
        alt={selectedImage?.prompt || ''}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />

      {/* 底部操作栏 - 使用统一组件 */}
      <ImagePreviewPanel
        image={selectedImage ? {
          id: selectedImage.id,
          prompt: selectedImage.prompt,
          model: selectedImage.model,
          provider: selectedImage.provider,
          image_url: selectedImage.image_url || '',
          original_url: selectedImage.original_url,
          created_at: selectedImage.created_at,
          config: selectedImage.config,
          is_public: selectedImage.is_public,
          status: selectedImage.status,
        } as PreviewImageInfo : null}
        isOpen={isPreviewOpen}
        config={{
          mode: 'my-images',
          onClose: () => setIsPreviewOpen(false),
          onTogglePublic: onTogglePublic,
          onDelete: onDeleteImage,
        }}
      />
    </>
  );
}
