'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Download,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Globe,
  GlobeLock,
  Trash2,
  Sparkles,
  Eye,
} from 'lucide-react';

// 图片信息接口
export interface PreviewImageInfo {
  id: string;
  prompt: string;
  model: string;
  provider: string;
  image_url: string;
  original_url?: string;
  created_at: string;
  config?: Record<string, unknown> | null;
  width?: number | null;
  height?: number | null;
  // 我的作品特有
  is_public?: boolean;
  status?: string;
  // 公开作品集特有
  stats?: {
    views: number;
    likes: number;
    dislikes?: number;
  };
  userInteraction?: {
    has_liked: boolean;
    has_disliked: boolean;
  };
}

// 面板模式
export type PreviewPanelMode = 'gallery' | 'my-images';

// 面板配置
export interface PreviewPanelConfig {
  mode: PreviewPanelMode;
  // 公共回调
  onClose: () => void;
  // 公开作品集特有
  onLike?: (image: PreviewImageInfo) => void | Promise<void>;
  onDislike?: (image: PreviewImageInfo) => void | Promise<void>;
  userToken?: string | null;
  // 我的作品特有
  onTogglePublic?: (id: string, isPublic: boolean) => void;
  onDelete?: (id: string) => void;
}

// 格式化数字
function formatNumber(num: number): string {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? '刚刚' : `${minutes}分钟前`;
    }
    return `${hours}小时前`;
  }
  if (days < 7) {
    return `${days}天前`;
  }
  if (days < 30) {
    return `${Math.floor(days / 7)}周前`;
  }
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// 构建创作链接参数（使用 sessionStorage 避免 URL 过长）
function buildCreateUrl(image: PreviewImageInfo): string {
  // 将图片信息存入 sessionStorage，避免 URL 过长导致 414 错误
  const createData = {
    prompt: image.prompt,
    model: image.model,
    provider: image.provider,
    config: image.config,
  };
  
  try {
    sessionStorage.setItem('ai-studio-create', JSON.stringify(createData));
  } catch (e) {
    // sessionStorage 不可用时降级到 URL 参数
    console.warn('sessionStorage not available, falling back to URL params');
    const params = new URLSearchParams();
    params.set('prompt', image.prompt);
    params.set('model', image.model);
    params.set('provider', image.provider);
    
    if (image.config) {
      if (image.config.aspectRatio) params.set('aspectRatio', image.config.aspectRatio as string);
      if (image.config.imageSize) params.set('imageSize', image.config.imageSize as string);
      if (image.config.size) params.set('size', image.config.size as string);
    }
    
    return `/?${params.toString()}`;
  }
  
  // URL 只传递 create 标识
  return `/?create=${image.id}`;
}

interface ImagePreviewPanelProps {
  image: PreviewImageInfo | null;
  isOpen: boolean;
  config: PreviewPanelConfig;
}

export function ImagePreviewPanel({ image, isOpen, config }: ImagePreviewPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);

  // 使用最新的 image 作为 currentImage，避免闭包问题
  const currentImage = image;

  // 复制到剪贴板
  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, []);

  // 复制提示词
  const handleCopyPrompt = useCallback((img: PreviewImageInfo) => {
    copyToClipboard(img.prompt, img.id);
  }, [copyToClipboard]);

  // 分享
  const handleShare = useCallback((img: PreviewImageInfo) => {
    const shareUrl = `${window.location.origin}/gallery?highlight=${img.id}`;
    copyToClipboard(shareUrl, `share-${img.id}`);
  }, [copyToClipboard]);

  // 下载
  const handleDownload = useCallback(async (img: PreviewImageInfo) => {
    try {
      const imageUrl = img.original_url || img.image_url;
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      link.download = `ai-image-${img.id.slice(0, 8)}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下载失败:', err);
    }
  }, []);

  if (!isOpen || !image) return null;

  const isGallery = config.mode === 'gallery';

  // 处理公开状态切换
  const handleTogglePublic = () => {
    if (config.onTogglePublic && currentImage) {
      config.onTogglePublic(currentImage.id, !currentImage.is_public);
    }
  };

  // 处理删除
  const handleDelete = () => {
    if (config.onDelete && currentImage) {
      config.onDelete(currentImage.id);
      config.onClose();
    }
  };

  // 处理点赞
  const handleLike = () => {
    if (config.onLike && currentImage) {
      config.onLike(currentImage);
    }
  };

  // 处理点踩
  const handleDislike = () => {
    if (config.onDislike && currentImage) {
      config.onDislike(currentImage);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-t border-white/10">
      <div className="container mx-auto px-4 py-2 lg:py-3">
        {/* 提示词区域 - 移动端可点击展开，电脑端始终显示 */}
        <div 
          className={`transition-all duration-300 cursor-pointer lg:cursor-default ${
            isPromptExpanded ? 'max-h-20' : 'max-h-6 lg:max-h-12'
          }`}
          onClick={(e) => {
            // 只在移动端触发展开
            if (window.innerWidth < 1024) {
              setIsPromptExpanded(prev => !prev);
            }
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className={`text-white/90 text-sm break-words lg:text-xs lg:line-clamp-2 ${
                isPromptExpanded 
                  ? 'line-clamp-2 lg:line-clamp-2' 
                  : 'line-clamp-1 lg:line-clamp-2'
              }`}>
                {currentImage?.prompt}
              </p>
            </div>
            <button
              className="text-white/60 hover:text-white shrink-0 p-1 lg:hidden"
              onClick={(e) => {
                e.stopPropagation();
                config.onClose();
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 电脑端：单行紧凑布局 */}
        <div className="hidden lg:flex items-center justify-between gap-4 mt-2">
          {/* 左侧：信息 */}
          <div className="flex items-center gap-4 text-xs text-white/50">
            {isGallery && currentImage?.stats && (
              <>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {formatNumber(currentImage.stats.views)}
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {formatNumber(currentImage.stats.likes)}
                </span>
              </>
            )}
            {currentImage?.width && currentImage?.height && (
              <span>{currentImage.width} × {currentImage.height}</span>
            )}
            <span>{currentImage?.model}</span>
            <span>{currentImage?.created_at && formatDate(currentImage.created_at)}</span>
          </div>
          
          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-2">
            {isGallery ? (
              // 公开作品集按钮
              <>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={`h-8 px-3 ${
                    currentImage?.userInteraction?.has_liked 
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                  onClick={handleLike}
                  disabled={!config.userToken}
                >
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  赞
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={`h-8 px-3 ${
                    currentImage?.userInteraction?.has_disliked 
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                  onClick={handleDislike}
                  disabled={!config.userToken}
                >
                  <ThumbsDown className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-3 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => currentImage && handleCopyPrompt(currentImage)}
                >
                  {copiedId === currentImage?.id ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-3 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => currentImage && handleDownload(currentImage)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-3 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => currentImage && handleShare(currentImage)}
                >
                  {copiedId === `share-${currentImage?.id}` ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                </Button>
              </>
            ) : (
              // 我的作品按钮
              <>
                {config.onTogglePublic && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`h-8 px-3 ${
                      currentImage?.is_public 
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                    onClick={handleTogglePublic}
                    title={currentImage?.is_public ? '取消公开' : '公开'}
                  >
                    {currentImage?.is_public ? (
                      <GlobeLock className="h-4 w-4" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-3 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => currentImage && handleCopyPrompt(currentImage)}
                >
                  {copiedId === currentImage?.id ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-3 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => currentImage && handleDownload(currentImage)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {config.onDelete && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-8 px-3 text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            <Link href={currentImage ? buildCreateUrl(currentImage) : '#'} onClick={config.onClose}>
              <Button size="sm" className="h-8 px-4">
                <Sparkles className="h-4 w-4 mr-1" />
                创作
              </Button>
            </Link>
            <button
              className="text-white/60 hover:text-white p-2"
              onClick={config.onClose}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 移动端：按钮布局 */}
        <div className="lg:hidden mt-2">
          {/* 信息 */}
          <div className="flex items-center justify-between text-xs text-white/50 mb-2">
            <div className="flex items-center gap-3">
              {isGallery && currentImage?.stats && (
                <>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {formatNumber(currentImage.stats.views)}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    {formatNumber(currentImage.stats.likes)}
                  </span>
                </>
              )}
              {currentImage?.width && currentImage?.height && (
                <span>{currentImage.width} × {currentImage.height}</span>
              )}
            </div>
            <span>{currentImage?.model}</span>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            {isGallery ? (
              // 公开作品集按钮
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={`flex-1 h-9 ${
                    currentImage?.userInteraction?.has_liked 
                      ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                      : 'bg-white/10 border-white/20 text-white'
                  }`}
                  onClick={handleLike}
                  disabled={!config.userToken}
                >
                  <ThumbsUp className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={`flex-1 h-9 ${
                    currentImage?.userInteraction?.has_disliked 
                      ? 'bg-red-500/20 border-red-500/50 text-red-400' 
                      : 'bg-white/10 border-white/20 text-white'
                  }`}
                  onClick={handleDislike}
                  disabled={!config.userToken}
                >
                  <ThumbsDown className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 h-9 bg-white/10 border-white/20 text-white"
                  onClick={() => currentImage && handleDownload(currentImage)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 h-9 bg-white/10 border-white/20 text-white"
                  onClick={() => currentImage && handleShare(currentImage)}
                >
                  {copiedId === `share-${currentImage?.id}` ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                </Button>
                <Link href={currentImage ? buildCreateUrl(currentImage) : '#'} onClick={config.onClose} className="flex-1">
                  <Button size="sm" className="w-full h-9">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </Link>
              </>
            ) : (
              // 我的作品按钮
              <>
                {config.onTogglePublic && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={`flex-1 h-9 ${
                      currentImage?.is_public 
                        ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                        : 'bg-white/10 border-white/20 text-white'
                    }`}
                    onClick={handleTogglePublic}
                  >
                    {currentImage?.is_public ? (
                      <GlobeLock className="h-4 w-4" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 h-9 bg-white/10 border-white/20 text-white"
                  onClick={() => currentImage && handleDownload(currentImage)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 h-9 bg-white/10 border-white/20 text-white"
                  onClick={() => currentImage && handleCopyPrompt(currentImage)}
                >
                  {copiedId === currentImage?.id ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                {config.onDelete && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 h-9 bg-red-500/20 border-red-500/50 text-red-400"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Link href={currentImage ? buildCreateUrl(currentImage) : '#'} onClick={config.onClose} className="flex-1">
                  <Button size="sm" className="w-full h-9">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
