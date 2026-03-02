'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageViewerProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
  onImageClick?: () => void;
  thumbnailSrc?: string;
}

export function ImageViewer({ src, alt, isOpen, onClose, onImageClick, thumbnailSrc }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scale: 1 });
  const [lastPinchDist, setLastPinchDist] = useState(0);
  const [pinchStartScale, setPinchStartScale] = useState(1);
  
  // 图片加载状态
  const [showOriginal, setShowOriginal] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  
  // 使用 ref 防止重复加载
  const loadingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 重置状态
  const resetState = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setShowOriginal(false);
    setImageSize(null);
    loadingRef.current = false;
  }, []);

  // 关闭时重置
  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

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

  // 原图加载完成
  const handleOriginalLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!loadingRef.current) {
      loadingRef.current = true;
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      setShowOriginal(true);
    }
  }, []);

  if (!isOpen) return null;

  // 计算显示尺寸
  const displaySize = imageSize ? (() => {
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.85;
    const ratio = Math.min(maxWidth / imageSize.width, maxHeight / imageSize.height, 1);
    return {
      width: Math.round(imageSize.width * ratio),
      height: Math.round(imageSize.height * ratio),
    };
  })() : null;

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
        {/* 图片包装器 */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: displaySize ? `${displaySize.width}px` : '90vw',
            height: displaySize ? `${displaySize.height}px` : '85vh',
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
          {/* 缩略图（底层）- 有缩略图且与原图不同时显示 */}
          {thumbnailSrc && thumbnailSrc !== src && (
            <img
              src={thumbnailSrc}
              alt={alt}
              className="absolute inset-0 w-full h-full object-contain select-none"
              style={{
                opacity: showOriginal ? 0 : 1,
              }}
              draggable={false}
            />
          )}
          
          {/* 原图（顶层）- 如果与缩略图相同则直接显示 */}
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-contain select-none relative"
            style={{
              opacity: showOriginal || thumbnailSrc === src ? 1 : 0,
            }}
            draggable={false}
            onLoad={handleOriginalLoad}
          />
        </div>
      </div>

      {/* 加载提示 - 只有两张图不同时才显示 */}
      {thumbnailSrc && thumbnailSrc !== src && !showOriginal && (
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
