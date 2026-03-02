'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageViewerProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
  onImageClick?: () => void; // 点击图片回调
  thumbnailSrc?: string; // 缩略图 URL（先显示缩略图，原图加载后替换）
}

export function ImageViewer({ src, alt, isOpen, onClose, onImageClick, thumbnailSrc }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scale: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [lastPinchDist, setLastPinchDist] = useState(0);
  const [pinchStartScale, setPinchStartScale] = useState(1);
  
  // 缩略图和原图加载状态
  const [isOriginalLoaded, setIsOriginalLoaded] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  // 重置状态
  const resetState = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 关闭时重置
  useEffect(() => {
    if (!isOpen) {
      resetState();
      setIsOriginalLoaded(false);
      setImageSize(null);
    }
  }, [isOpen, resetState]);

  // 加载原图（预加载，获取尺寸）
  useEffect(() => {
    if (!isOpen || !src) return;
    
    // 如果没有缩略图，直接加载原图
    if (!thumbnailSrc) {
      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
        setIsOriginalLoaded(true);
      };
      img.src = src;
      return;
    }
    
    // 有缩略图：先显示缩略图，后台预加载原图
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      setIsOriginalLoaded(true);
    };
    img.onerror = () => {
      console.error('Failed to load original image:', src);
      // 即使加载失败，如果没有尺寸，也设置一个默认尺寸
      if (!imageSize) {
        setImageSize({ width: 800, height: 600 });
      }
    };
    img.src = src;
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isOpen, src, thumbnailSrc, imageSize]);

  // 计算图片显示尺寸（基于视口）
  const displaySize = imageSize ? (() => {
    const maxWidth = typeof window !== 'undefined' ? window.innerWidth * 0.9 : 800;
    const maxHeight = typeof window !== 'undefined' ? window.innerHeight * 0.85 : 600;
    
    const ratio = Math.min(maxWidth / imageSize.width, maxHeight / imageSize.height, 1);
    
    return {
      width: Math.round(imageSize.width * ratio),
      height: Math.round(imageSize.height * ratio),
    };
  })() : null;

  // 打开时禁用 body 滚动
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale(prev => Math.max(0.5, Math.min(prev + delta, 8)));
  }, []);

  // 双击缩放
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (scale === 1) {
      setScale(2);
    } else {
      resetState();
    }
  }, [scale, resetState]);

  // 鼠标拖拽开始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
      scale,
    });
  }, [position, scale]);

  // 鼠标移动
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 触摸开始
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setIsPinching(false);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
        scale,
      });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      setIsPinching(true);
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setLastPinchDist(dist);
      setPinchStartScale(scale);
    }
  }, [position, scale]);

  // 触摸移动
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging && !isPinching) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && isPinching) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (lastPinchDist > 0) {
        const scaleFactor = dist / lastPinchDist;
        const newScale = pinchStartScale * scaleFactor;
        setScale(Math.max(0.5, Math.min(newScale, 8)));
      }
    }
  }, [isDragging, isPinching, dragStart, lastPinchDist, pinchStartScale]);

  // 触摸结束
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setIsPinching(false);
    setLastPinchDist(0);
  }, []);

  // 点击背景关闭
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // 点击图片
  const handleImageClick = useCallback(() => {
    if (scale === 1 && onImageClick) {
      onImageClick();
    }
  }, [scale, onImageClick]);

  if (!isOpen) return null;

  // 图片容器样式 - 使用计算出的尺寸或默认尺寸
  const containerStyle = displaySize ? {
    width: `${displaySize.width}px`,
    height: `${displaySize.height}px`,
  } : {
    maxWidth: '90vw',
    maxHeight: '85vh',
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={handleBackdropClick}
      style={{ touchAction: 'none' }}
    >
      {/* 关闭按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* 缩放控制 */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/50 rounded-lg px-3 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20"
          onClick={() => setScale(prev => Math.max(0.5, prev - 0.5))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-white text-sm w-14 text-center tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20"
          onClick={() => setScale(prev => Math.min(8, prev + 0.5))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20 ml-2"
          onClick={resetState}
        >
          还原
        </Button>
      </div>

      {/* 图片容器 */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden relative"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        {/* 图片包装器 - 共享 transform */}
        <div
          className="relative flex items-center justify-center"
          style={{
            ...containerStyle,
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: (isDragging || isPinching) ? 'none' : 'transform 0.15s ease-out',
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (scale === 1 && !isDragging && !isPinching && onImageClick) {
              handleImageClick();
            }
          }}
        >
          {/* 缩略图（底层）- 如果有尺寸，使用固定尺寸 */}
          {thumbnailSrc && displaySize && (
            <img
              src={thumbnailSrc}
              alt={alt}
              className="absolute inset-0 select-none"
              style={{
                width: displaySize.width,
                height: displaySize.height,
                objectFit: 'contain',
                opacity: isOriginalLoaded ? 0 : 1,
                transition: 'opacity 0.3s ease-out',
              }}
              draggable={false}
            />
          )}
          
          {/* 原图（顶层）- 加载完成后淡入覆盖 */}
          <img
            src={src}
            alt={alt}
            className="select-none"
            style={{
              width: displaySize?.width || 'auto',
              height: displaySize?.height || 'auto',
              maxWidth: displaySize ? 'none' : '90vw',
              maxHeight: displaySize ? 'none' : '85vh',
              objectFit: 'contain',
              opacity: isOriginalLoaded ? 1 : (thumbnailSrc ? 0 : 1),
              transition: 'opacity 0.3s ease-out',
              position: 'relative',
            }}
            draggable={false}
          />
        </div>
      </div>

      {/* 加载提示 */}
      {!isOriginalLoaded && thumbnailSrc && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-white/60 text-sm bg-black/50 px-3 py-1.5 rounded-full">
          正在加载高清图片...
        </div>
      )}

      {/* 底部提示 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs bg-black/50 px-3 py-1.5 rounded-full">
        {scale === 1 ? '双击放大 · 滚轮缩放 · 点击展开提示词' : '拖拽移动 · 点击空白处关闭'}
      </div>
    </div>
  );
}
