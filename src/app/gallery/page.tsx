'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageViewer } from '@/components/ImageViewer';
import { Image as ImageIcon, Loader2, Download, Copy, Sparkles, Bot, Check, ImageIcon as RefImageIcon, RefreshCw, ThumbsUp, ThumbsDown, Eye, Flame, Clock } from 'lucide-react';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PublicImage {
  id: string;
  prompt: string;
  model: string;
  provider: string;
  image_url: string;
  original_url?: string;
  created_at: string;
  config: Record<string, unknown> | null;
  stats: {
    views: number;
    likes: number;
    creates: number;
  };
  userInteraction: {
    has_liked: boolean;
    has_disliked: boolean;
  };
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

// 格式化数字
function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return String(num);
}

// 主内容组件
function GalleryContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [images, setImages] = useState<PublicImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<PublicImage | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  
  // 分页和排序
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'likes'>('likes'); // 默认按最多赞排序
  
  // 用户 token
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false); // 提示词展开状态
  const [isInitialized, setIsInitialized] = useState(false); // 是否已初始化
  
  // 获取 userToken（与首页使用相同的 key）
  useEffect(() => {
    const token = localStorage.getItem('ai-image-user-token');
    if (token) {
      setUserToken(token);
    } else {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const newToken = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('ai-image-user-token', newToken);
      setUserToken(newToken);
    }
    setIsInitialized(true);
  }, []);

  const fetchGallery = useCallback(async (pageNum: number, sort: typeof sortBy) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '20',
        sort: sort,
      });
      if (userToken) {
        params.set('userToken', userToken);
      }
      
      const response = await fetch(`/api/gallery?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setImages(data.images);
        setTotalPages(data.pagination.totalPages);
        setFailedImages(new Set());
      }
    } catch (error) {
      console.error('Failed to fetch gallery:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userToken]);

  useEffect(() => {
    fetchGallery(page, sortBy);
  }, [page, sortBy, fetchGallery]);
  
  // 更新 URL（打开/关闭图片时）
  const updateUrl = useCallback((imageId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (imageId) {
      params.set('id', imageId);
    } else {
      params.delete('id');
    }
    
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [pathname, searchParams, router]);
  
  // 根据 URL 参数自动打开图片
  useEffect(() => {
    if (!isInitialized || images.length === 0) return;
    
    const imageIdFromUrl = searchParams.get('id');
    if (imageIdFromUrl) {
      const image = images.find(img => img.id === imageIdFromUrl);
      if (image) {
        setSelectedImage(image);
        setIsPreviewOpen(true);
      }
    }
  }, [isInitialized, images, searchParams]);
  
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
  
  // 记录浏览
  const recordView = async (image: PublicImage) => {
    if (!userToken) return;
    try {
      await fetch('/api/images/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: image.id,
          userToken,
          action: 'view',
        }),
      });
    } catch (error) {
      console.error('Record view error:', error);
    }
  };
  
  // 点赞/取消点赞
  const handleLike = async (image: PublicImage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!userToken) return;
    
    const action = image.userInteraction.has_liked ? 'unlike' : 'like';
    
    // 乐观更新
    setImages(prev => prev.map(img => 
      img.id === image.id 
        ? {
            ...img,
            stats: {
              ...img.stats,
              likes: img.stats.likes + (action === 'like' ? 1 : -1),
            },
            userInteraction: {
              ...img.userInteraction,
              has_liked: action === 'like',
              has_disliked: false,
            },
          }
        : img
    ));
    
    // 更新选中图片
    if (selectedImage?.id === image.id) {
      setSelectedImage(prev => prev ? {
        ...prev,
        stats: {
          ...prev.stats,
          likes: prev.stats.likes + (action === 'like' ? 1 : -1),
        },
        userInteraction: {
          ...prev.userInteraction,
          has_liked: action === 'like',
          has_disliked: false,
        },
      } : null);
    }
    
    try {
      await fetch('/api/images/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: image.id,
          userToken,
          action,
        }),
      });
    } catch (error) {
      console.error('Like error:', error);
    }
  };
  
  // 点踩/取消点踩
  const handleDislike = async (image: PublicImage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!userToken) return;
    
    const action = image.userInteraction.has_disliked ? 'undislike' : 'dislike';
    
    // 乐观更新
    setImages(prev => prev.map(img => 
      img.id === image.id 
        ? {
            ...img,
            userInteraction: {
              ...img.userInteraction,
              has_disliked: action === 'dislike',
              has_liked: false,
            },
          }
        : img
    ));
    
    // 更新选中图片
    if (selectedImage?.id === image.id) {
      setSelectedImage(prev => prev ? {
        ...prev,
        userInteraction: {
          ...prev.userInteraction,
          has_disliked: action === 'dislike',
          has_liked: false,
        },
      } : null);
    }
    
    try {
      await fetch('/api/images/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: image.id,
          userToken,
          action,
        }),
      });
    } catch (error) {
      console.error('Dislike error:', error);
    }
  };
  
  // 打开图片预览
  const handleOpenPreview = (image: PublicImage) => {
    setSelectedImage(image);
    setIsPreviewOpen(true);
    setIsPromptExpanded(false);
    // 更新 URL
    updateUrl(image.id);
    // 记录浏览
    recordView(image);
  };
  
  // 关闭图片预览
  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setIsPromptExpanded(false);
    // 清除 URL 中的图片 ID
    updateUrl(null);
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
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                社区精选作品
              </CardTitle>
              
              {/* 排序选择器 */}
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v as typeof sortBy); setPage(1); }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      最新
                    </div>
                  </SelectItem>
                  <SelectItem value="popular">
                    <div className="flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5" />
                      最热
                    </div>
                  </SelectItem>
                  <SelectItem value="likes">
                    <div className="flex items-center gap-1.5">
                      <ThumbsUp className="h-3.5 w-3.5" />
                      最多赞
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                        onClick={() => !hasError && handleOpenPreview(image)}
                      >
                        {hasError ? (
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
                        
                        {/* 悬停信息层 */}
                        {!hasError && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                              <p className="text-xs text-white line-clamp-2 mb-2">{image.prompt}</p>
                              
                              {/* 统计信息 */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="flex items-center gap-1 text-white/70 text-xs">
                                    <Eye className="h-3 w-3" />
                                    {formatNumber(image.stats.views)}
                                  </span>
                                  <span className="flex items-center gap-1 text-white/70 text-xs">
                                    <ThumbsUp className="h-3 w-3" />
                                    {formatNumber(image.stats.likes)}
                                  </span>
                                </div>
                                {getSizeText(image) && (
                                  <span className="text-xs text-white/60 bg-white/20 rounded px-1.5 py-0.5">
                                    {getSizeText(image)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* 提供商标识 */}
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
                            {hasReferenceImage(image) && (
                              <div className="bg-amber-500/80 rounded-full p-1" title="基于参考图生成">
                                <RefImageIcon className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 点赞/点踩按钮 - 悬停显示 */}
                        {!hasError && userToken && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className={`p-1.5 rounded-full transition-colors ${
                                image.userInteraction.has_liked 
                                  ? 'bg-green-500 text-white' 
                                  : 'bg-black/50 text-white/70 hover:bg-black/70'
                              }`}
                              onClick={(e) => handleLike(image, e)}
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </button>
                            <button
                              className={`p-1.5 rounded-full transition-colors ${
                                image.userInteraction.has_disliked 
                                  ? 'bg-red-500 text-white' 
                                  : 'bg-black/50 text-white/70 hover:bg-black/70'
                              }`}
                              onClick={(e) => handleDislike(image, e)}
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </button>
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

      {/* 全屏图片查看器 */}
      <ImageViewer
        src={selectedImage?.image_url || ''}
        alt={selectedImage?.prompt || ''}
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        onImageClick={() => setIsPromptExpanded(prev => !prev)} // 点击图片切换展开状态
      />

      {/* 底部操作栏 */}
      {selectedImage && isPreviewOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-t border-white/10">
          {/* 提示词区域 - 可点击展开 */}
          <div 
            className={`border-b border-white/10 cursor-pointer transition-all duration-300 ${
              isPromptExpanded ? 'max-h-40' : 'max-h-14'
            }`}
            onClick={() => setIsPromptExpanded(prev => !prev)}
          >
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white/40 text-xs">提示词</span>
                    <span className="text-white/30 text-xs">
                      {isPromptExpanded ? '点击收起' : '点击展开'}
                    </span>
                  </div>
                  <p className={`text-white/90 text-sm break-words ${
                    isPromptExpanded 
                      ? 'max-h-28 overflow-y-auto' 
                      : 'line-clamp-1'
                  }`}>
                    {selectedImage.prompt}
                  </p>
                </div>
                <button
                  className="text-white/60 hover:text-white shrink-0 p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClosePreview();
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* 操作按钮区域 */}
          <div className="container mx-auto px-4 py-3">
            {/* 统计信息 + 模型信息 */}
            <div className="flex items-center justify-between mb-3 text-xs text-white/50">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {formatNumber(selectedImage.stats.views)}
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {formatNumber(selectedImage.stats.likes)}
                </span>
              </div>
              <span>{selectedImage.model} · {formatDate(selectedImage.created_at)}</span>
            </div>

            {/* 主操作按钮 - 两行布局 */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              {/* 点赞 */}
              <Button 
                variant="outline" 
                size="sm"
                className={`h-10 ${
                  selectedImage.userInteraction.has_liked 
                    ? 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30' 
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
                onClick={() => userToken && handleLike(selectedImage)}
                disabled={!userToken}
              >
                <ThumbsUp className="h-4 w-4" />
              </Button>
              
              {/* 点踩 */}
              <Button 
                variant="outline" 
                size="sm"
                className={`h-10 ${
                  selectedImage.userInteraction.has_disliked 
                    ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30' 
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
                onClick={() => userToken && handleDislike(selectedImage)}
                disabled={!userToken}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
              
              {/* 下载 */}
              <Button 
                variant="outline" 
                size="sm" 
                className="h-10 bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => handleDownload(selectedImage)}
              >
                <Download className="h-4 w-4" />
              </Button>
              
              {/* 复制提示词 */}
              <Button 
                variant="outline" 
                size="sm"
                className="h-10 bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => handleCopyPrompt(selectedImage)}
              >
                {copiedId === selectedImage.id ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* 用此提示词创作 - 大按钮 */}
            <Link 
              href={buildCreateUrl(selectedImage)} 
              onClick={handleClosePreview}
              className="block"
            >
              <Button 
                size="sm" 
                className="w-full h-11 text-base font-medium"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                用此提示词创作
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// 用 Suspense 包裹的主页面组件
export default function GalleryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <GalleryContent />
    </Suspense>
  );
}
