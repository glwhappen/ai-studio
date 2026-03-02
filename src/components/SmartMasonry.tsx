'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

interface Item {
  id: string;
  width?: number | null;
  height?: number | null;
}

interface SmartMasonryProps<T extends Item> {
  items: T[];
  gap?: number;
  columnWidth?: number;
  children: (item: T, columnIndex: number) => React.ReactNode;
}

/**
 * 智能瀑布流组件
 * 根据图片实际高度，将图片放入当前最短的列中，实现均衡布局
 */
export function SmartMasonry<T extends Item>({
  items,
  gap = 12,
  columnWidth = 240,
  children,
}: SmartMasonryProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [columnHeights, setColumnHeights] = useState<number[]>([]);

  // 计算列数
  const columnCount = useMemo(() => {
    if (containerWidth === 0) return 5; // 默认 5 列
    return Math.max(2, Math.floor((containerWidth + gap) / (columnWidth + gap)));
  }, [containerWidth, columnWidth, gap]);

  // 使用智能分配算法：将图片放入当前最短的列
  const { columns, columnHeightArray } = useMemo(() => {
    const cols: T[][] = Array.from({ length: columnCount }, () => []);
    const heights: number[] = Array(columnCount).fill(0);

    items.forEach((item) => {
      // 找到当前最短的列
      const minHeightIndex = heights.indexOf(Math.min(...heights));
      
      // 将图片放入该列
      cols[minHeightIndex].push(item);
      
      // 更新该列的高度
      // 使用实际高度，如果没有则使用默认高度 200
      const itemHeight = item.width && item.height 
        ? (item.height / item.width) * columnWidth 
        : 200;
      heights[minHeightIndex] += itemHeight + gap;
    });

    return { columns: cols, columnHeightArray: heights };
  }, [items, columnCount, columnWidth, gap]);

  // 更新列高度状态（用于调试或显示）
  useEffect(() => {
    setColumnHeights(columnHeightArray);
  }, [columnHeightArray]);

  // 监听容器宽度变化
  const updateWidth = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
  }, []);

  useEffect(() => {
    updateWidth();
    
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, [updateWidth]);

  return (
    <div 
      ref={containerRef}
      className="flex w-auto"
      style={{ gap }}
    >
      {columns.map((columnItems, columnIndex) => (
        <div 
          key={columnIndex} 
          className="flex-1 flex flex-col"
          style={{ gap }}
        >
          {columnItems.map((item) => (
            <div key={item.id}>
              {children(item, columnIndex)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
