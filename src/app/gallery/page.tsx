'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Image as ImageIcon, Loader2, Download, Copy, Sparkles, Bot, Check, ImageIcon as RefImageIcon, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface PublicImage {
  id: string;
  prompt: string;
  model: string;
  provider: string;
  image_url: string;
  created_at: string;
  config: Record<string, unknown> | null;
}

// 图片加载状态追踪
const imageLoadStates = new Map<string, 'loading' | 'loaded' | 'error'>();

// 获取尺寸显示文本
function getSizeText(image: PublicImage): string | null {
  const config = image.config;
  
  if (image.provider === 'gemini' && config?.aspectRatio && config?.imageSize) {
    return `${config.aspectRatio} · ${config.imageSize}`;
  }
  if (image.provider === 'openai' && config?.size) {
    return config.size as string;
  }
  return null;
}

// 检查是否有参考图
function hasReferenceImage(image: PublicImage): boolean {
  return !!image.config?.hasReferenceImage;
}

// 构建创作链接参数
function buildCreateUrl(image: PublicImage): string {
  const params = new URLSearchParams();
  params.set('prompt', image.prompt);
  params.set('model', image.model);
  params.set('provider', image.provider);
  
  const config = image.config;
  if (config) {
    if (config.aspectRatio) params.set('aspectRatio', config.aspectRatio as string);
    if (config.imageSize) params.set('imageSize', config.imageSize as string);
    if (config.size) params.set('size', config.size as string);
  }
  
  return `/?${params.toString()}`;
}

export default function GalleryPage() {
  const [images, setImages] = useState<PublicImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<PublicImage | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  
  // 分页
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchGallery = useCallback(async (pageNum: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/gallery?page=${pageNum}&limit=20`);
      const data = await response.json();
      
      if (data.success) {
        setImages(data.images);
        setTotalPages(data.pagination.totalPages);
        // 清除失败记录
        setFailedImages(new Set());
      }
    } catch (error) {
      console.error('Failed to fetch gallery:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery(page);
  }, [page, fetchGallery]);
  
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
    // 强制刷新图片（添加时间戳）
    setImages(prev => prev.map(img => 
      img.id === imageId 
        ? { ...img, image_url: img.image_url.includes('?') 
            ? img.image_url.split('?')[0] + '?t=' + Date.now()
            : img.image_url + '?t=' + Date.now() 
          }
        : img
    ));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleCopyPrompt = async (image: PublicImage) => {
    try {
      await navigator.clipboard.writeText(image.prompt);
      setCopiedId(image.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleDownload = async (image: PublicImage) => {
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

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-serif text-xl font-bold tracking-tight">
            公开作品集
          </h1>
          <Link href="/">
            <Button variant="ghost" size="sm">
              返回创作
            </Button>
          </Link>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-serif flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              社区精选作品
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">暂无公开作品</p>
                <Link href="/">
                  <Button variant="link" className="mt-2">
                    成为第一个分享作品的人
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {/* 瀑布流图片展示 */}
                <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 space-y-3">
                  {images.map((image) => {
                    const hasError = failedImages.has(image.id);
                    
                    return (
                      <div
                        key={image.id}
                        className="group relative overflow-hidden rounded-xl bg-muted break-inside-avoid cursor-pointer"
                        onClick={() => {
                          if (!hasError) {
                            setSelectedImage(image);
                            setIsPreviewOpen(true);
                          }
                        }}
                      >
                        {hasError ? (
                          // 加载失败显示
                          <div className="aspect-square flex flex-col items-center justify-center gap-2 p-4 bg-muted/50">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground text-center">图片加载失败</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryImage(image.id);
                              }}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              重试
                            </Button>
                          </div>
                        ) : (
                          <img
                            src={image.image_url}
                            alt={image.prompt}
                            className="w-full h-auto transition-transform group-hover:scale-[1.02]"
                            onError={() => handleImageError(image.id)}
                            loading="lazy"
                          />
                        )}
                        {/* 悬停信息层 - 仅图片加载成功时显示 */}
                        {!hasError && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                              <p className="text-xs text-white line-clamp-2 mb-1">{image.prompt}</p>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-white/70">{formatDate(image.created_at)}</p>
                                {getSizeText(image) && (
                                  <span className="text-xs text-white/60 bg-white/20 rounded px-1.5 py-0.5">
                                    {getSizeText(image)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {/* 提供商标识 - 仅图片加载成功时显示 */}
                        {!hasError && (
                          <div className="absolute top-2 left-2 flex items-center gap-1">
                            {image.provider === 'gemini' ? (
                              <div className="bg-primary/80 rounded-full p-1">
                                <Sparkles className="h-3 w-3 text-white" />
                              </div>
                            ) : (
                              <div className="bg-blue-500/80 rounded-full p-1">
                                <Bot className="h-3 w-3 text-white" />
                              </div>
                            )}
                            {/* 参考图标识 */}
                            {hasReferenceImage(image) && (
                              <div className="bg-amber-500/80 rounded-full p-1" title="基于参考图生成">
                                <RefImageIcon className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      上一页
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 图片预览弹窗 */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-serif">作品详情</DialogTitle>
            <DialogDescription className="sr-only">
              作品详细信息和操作
            </DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <>
              {/* 可滚动内容区 */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
                {/* 图片 */}
                <div className="relative bg-muted rounded-lg overflow-hidden">
                  <img
                    src={selectedImage.image_url}
                    alt={selectedImage.prompt}
                    className="w-full h-auto max-h-[50vh] object-contain"
                  />
                </div>
                
                {/* 信息 */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">提示词:</span>
                    <p className="text-sm">{selectedImage.prompt}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span>模型: {selectedImage.model}</span>
                    {getSizeText(selectedImage) && <span>尺寸: {getSizeText(selectedImage)}</span>}
                    {hasReferenceImage(selectedImage) && (
                      <span className="text-amber-600 flex items-center gap-1">
                        <RefImageIcon className="h-3 w-3" />
                        基于参考图生成
                      </span>
                    )}
                    <span>{formatDate(selectedImage.created_at)}</span>
                  </div>
                </div>
              </div>
              
              {/* 操作按钮 - 固定在底部 */}
              <div className="shrink-0 flex items-center gap-2 pt-4 border-t mt-4">
                <Button variant="outline" size="sm" onClick={() => handleDownload(selectedImage)}>
                  <Download className="h-4 w-4 mr-1.5" />
                  下载
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleCopyPrompt(selectedImage)}
                >
                  {copiedId === selectedImage.id ? (
                    <>
                      <Check className="h-4 w-4 mr-1.5 text-green-500" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1.5" />
                      复制提示词
                    </>
                  )}
                </Button>
                <Link href={buildCreateUrl(selectedImage)}>
                  <Button size="sm">
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    用此提示词创作
                  </Button>
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
