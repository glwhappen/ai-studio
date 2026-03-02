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
  const [isPinching, setIsPinching] = useState(false); // 是否正在双指缩放
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scale: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [lastPinchDist, setLastPinchDist] = useState(0);
  const [pinchStartScale, setPinchStartScale] = useState(1); // 双指缩放开始时的缩放比例
  
  // 缩略图和原图加载状态
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [isOriginalLoaded, setIsOriginalLoaded] = useState(false);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

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
      // 如果有缩略图，先显示缩略图
      if (thumbnailSrc) {
        setDisplaySrc(thumbnailSrc);
      } else {
        setDisplaySrc(null);
      }
    }
  }, [isOpen, resetState, thumbnailSrc]);

  // 加载原图
  useEffect(() => {
    if (!isOpen || !src || isOriginalLoaded) return;
    
    // 如果没有缩略图，直接显示原图
    if (!thumbnailSrc) {
      setDisplaySrc(src);
      setIsOriginalLoaded(true);
      return;
    }
    
    // 先显示缩略图
    setDisplaySrc(thumbnailSrc);
    
    // 后台加载原图
    const img = new Image();
    img.onload = () => {
      setDisplaySrc(src);
      setIsOriginalLoaded(true);
    };
    img.onerror = () => {
      // 原图加载失败，保持缩略图
      console.error('Failed to load original image:', src);
    };
    img.src = src;
    originalImageRef.current = img;
    
    return () => {
      // 清理
      if (originalImageRef.current) {
        originalImageRef.current.onload = null;
        originalImageRef.current.onerror = null;
      }
    };
  }, [isOpen, src, thumbnailSrc, isOriginalLoaded]);

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
    if (e.button !== 0) return; // 只响应左键
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
      // 单指拖拽
      setIsDragging(true);
      setIsPinching(false);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
        scale,
      });
    } else if (e.touches.length === 2) {
      // 双指缩放
      setIsDragging(false);
      setIsPinching(true);
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setLastPinchDist(dist);
      setPinchStartScale(scale); // 记录开始时的缩放比例
    }
  }, [position, scale]);

  // 触摸移动
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging && !isPinching) {
      // 单指拖拽
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && isPinching) {
      // 双指缩放 - 使用比例计算，更跟手
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (lastPinchDist > 0) {
        // 计算缩放比例：当前距离 / 初始距离
        const scaleFactor = dist / lastPinchDist;
        // 基于初始缩放比例计算新缩放
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

      {/* 图片 */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
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
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={alt}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: (isDragging || isPinching) ? 'none' : 'transform 0.15s ease-out, opacity 0.3s ease-out',
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
              // 原图加载后稍微淡入，实现平滑过渡
              opacity: isOriginalLoaded ? 1 : 0.95,
            }}
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              // 缩放为1时，点击图片触发回调
              if (scale === 1 && !isDragging && !isPinching && onImageClick) {
                handleImageClick();
              }
            }}
          />
        ) : (
          // 加载中占位
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs bg-black/50 px-3 py-1.5 rounded-full">
        {scale === 1 ? '双击放大 · 滚轮缩放 · 点击展开提示词' : '拖拽移动 · 点击空白处关闭'}
      </div>
    </div>
  );
}
