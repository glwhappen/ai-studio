'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageViewer } from '@/components/ImageViewer';
import { ImagePreviewPanel, type PreviewImageInfo } from '@/components/ImagePreviewPanel';
import { Image as ImageIcon, Loader2, Download, Copy, Sparkles, Bot, Check, ImageIcon as RefImageIcon, RefreshCw, ThumbsUp, ThumbsDown, Eye, Flame, Clock, Share2 } from 'lucide-react';
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
  thumbnail_url?: string;
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedImage, setSelectedImage] = useState<PublicImage | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  
  // 分页和排序
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'likes' | 'random'>('random'); // 默认随机排序
  const [refreshKey, setRefreshKey] = useState(0); // 用于触发刷新
  
  // 用户 token
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false); // 是否已初始化
  
  // 使用 ref 追踪关闭状态，防止 useEffect 重复触发
  const isClosingRef = useRef(false);
  // 底部观察器 ref
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
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
    
    // 读取保存的排序偏好
    const savedSortBy = localStorage.getItem('gallery-sort-by');
    if (savedSortBy && ['latest', 'popular', 'likes', 'random'].includes(savedSortBy)) {
      setSortBy(savedSortBy as typeof sortBy);
    }
    
    setIsInitialized(true);
  }, []);

  const fetchGallery = useCallback(async (pageNum: number, sort: typeof sortBy, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    
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
        if (append) {
          // 追加模式：合并图片列表
          setImages(prev => [...prev, ...data.images]);
        } else {
          // 替换模式：重置图片列表
          setImages(data.images);
        }
        // 判断是否还有更多
        setHasMore(pageNum < data.pagination.totalPages);
        setFailedImages(new Set());
      }
    } catch (error) {
      console.error('Failed to fetch gallery:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [userToken]);

  // 初始加载
  useEffect(() => {
    if (!isInitialized) return;
    fetchGallery(1, sortBy);
  }, [isInitialized, sortBy, refreshKey, fetchGallery]);
  
  // 加载更多
  useEffect(() => {
    if (page > 1) {
      fetchGallery(page, sortBy, true);
    }
  }, [page, sortBy, fetchGallery]);
  
  // 无限滚动：滚动到底部时自动加载
  const loadingTriggeredRef = useRef(false);
  
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore) return;
    
    const handleLoadMore = () => {
      // 防止重复触发
      if (loadingTriggeredRef.current || isLoadingMore || isLoading) return;
      
      const rect = sentinel.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // 当 sentinel 距离视口底部 400px 以内时触发加载
      if (rect.top < windowHeight + 400) {
        loadingTriggeredRef.current = true;
        setPage(prev => prev + 1);
      }
    };
    
    // 使用 Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { 
        threshold: 0, 
        rootMargin: '400px'
      }
    );
    
    observer.observe(sentinel);
    
    // 同时监听 scroll 事件作为备选
    window.addEventListener('scroll', handleLoadMore, { passive: true });
    // 初始检查一次
    handleLoadMore();
    
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleLoadMore);
    };
  }, [hasMore, isLoadingMore, isLoading]);
  
  // 当加载完成后重置触发标记
  useEffect(() => {
    if (!isLoadingMore && !isLoading) {
      loadingTriggeredRef.current = false;
    }
  }, [isLoadingMore, isLoading]);
  
  // 更新 URL（打开/关闭图片时）
  const updateUrl = useCallback((imageId: string | null) => {
    // 直接使用 window.location 获取当前 URL，避免闭包问题
    const currentUrl = new URL(window.location.href);
    
    if (imageId) {
      currentUrl.searchParams.set('id', imageId);
    } else {
      currentUrl.searchParams.delete('id');
    }
    
    const newUrl = currentUrl.searchParams.toString() 
      ? `${currentUrl.pathname}?${currentUrl.searchParams.toString()}` 
      : currentUrl.pathname;
    router.replace(newUrl, { scroll: false });
  }, [router]);
  
  // 根据 URL 参数自动打开图片
  useEffect(() => {
    if (!isInitialized || images.length === 0) return;
    
    // 如果正在关闭，跳过
    if (isClosingRef.current) {
      return;
    }
    
    const imageIdFromUrl = searchParams.get('id');
    
    // 如果 URL 有 id 但预览未打开，自动打开
    if (imageIdFromUrl && !isPreviewOpen) {
      const image = images.find(img => img.id === imageIdFromUrl);
      if (image) {
        setSelectedImage(image);
        setIsPreviewOpen(true);
        // 记录浏览
        recordView(image);
      }
    }
  }, [isInitialized, images, searchParams, isPreviewOpen]);
  
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
    isClosingRef.current = false; // 重置关闭状态
    setSelectedImage(image);
    setIsPreviewOpen(true);
    // 更新 URL
    updateUrl(image.id);
    // 记录浏览
    recordView(image);
  };
  
  // 关闭图片预览
  const handleClosePreview = () => {
    isClosingRef.current = true; // 标记正在关闭
    setIsPreviewOpen(false);
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
              
              {/* 排序选择器和刷新按钮 */}
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => {
                  const newSort = v as typeof sortBy;
                  setSortBy(newSort);
                  setPage(1);
                  setImages([]); // 清空图片列表
                  setHasMore(true); // 重置 hasMore
                  // 保存排序偏好到本地
                  localStorage.setItem('gallery-sort-by', newSort);
                }}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        随机
                      </div>
                    </SelectItem>
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
                
                {/* 刷新按钮 */}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    setPage(1);
                    setImages([]);
                    setHasMore(true);
                    setRefreshKey(prev => prev + 1); // 触发刷新
                  }}
                  disabled={isLoading || isLoadingMore}
                  title="刷新"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
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
                          /* 图片容器 - 使用 CSS 骨架屏背景 */
                          <div className="relative min-h-[200px] bg-gradient-to-br from-muted via-muted/90 to-muted overflow-hidden">
                            {/* 骨架屏动画层 */}
                            <div className="skeleton-shimmer absolute inset-0" />
                            {/* 图片加载指示器 */}
                            <div className="skeleton-spinner absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-6 w-6 text-muted-foreground/50 animate-spin" />
                            </div>
                            {/* 实际图片 */}
                            <img
                              src={image.thumbnail_url || image.image_url}
                              alt={image.prompt}
                              className="relative z-10 w-full h-auto opacity-0 transition-opacity duration-500 group-hover:scale-[1.02]"
                              onLoad={(e) => {
                                const img = e.currentTarget;
                                img.classList.remove('opacity-0');
                                img.classList.add('opacity-100');
                                // 隐藏骨架屏元素
                                const parent = img.parentElement;
                                if (parent) {
                                  const shimmer = parent.querySelector('.skeleton-shimmer');
                                  const spinner = parent.querySelector('.skeleton-spinner');
                                  if (shimmer) shimmer.classList.add('hidden');
                                  if (spinner) spinner.classList.add('hidden');
                                }
                              }}
                              onError={() => handleImageError(image.id)}
                              loading="lazy"
                            />
                          </div>
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

                {/* 无限滚动加载指示器 */}
                <div 
                  ref={loadMoreRef} 
                  className="flex items-center justify-center min-h-[60px] py-4"
                >
                  {isLoadingMore && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">加载中...</span>
                    </div>
                  )}
                  {!hasMore && images.length > 0 && !isLoadingMore && (
                    <span className="text-sm text-muted-foreground">— 没有更多了 —</span>
                  )}
                </div>
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
      />

      {/* 底部操作栏 - 使用统一组件 */}
      <ImagePreviewPanel
        image={selectedImage ? {
          id: selectedImage.id,
          prompt: selectedImage.prompt,
          model: selectedImage.model,
          provider: selectedImage.provider,
          image_url: selectedImage.image_url,
          original_url: selectedImage.original_url,
          created_at: selectedImage.created_at,
          config: selectedImage.config,
          stats: selectedImage.stats,
          userInteraction: selectedImage.userInteraction,
        } as PreviewImageInfo : null}
        isOpen={isPreviewOpen}
        config={{
          mode: 'gallery',
          onClose: handleClosePreview,
          onLike: (img) => {
            // 转换类型并调用原始函数
            if (selectedImage) {
              handleLike(selectedImage);
            }
          },
          onDislike: (img) => {
            if (selectedImage) {
              handleDislike(selectedImage);
            }
          },
          userToken: userToken,
        }}
      />
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
