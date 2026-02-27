'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { IMAGE_SIZES, ASPECT_RATIOS } from '@/types';
import { DEFAULT_API_KEY } from '@/hooks/useAppState';
import { Settings2, Square, Monitor } from 'lucide-react';

interface SizeSelectorProps {
  aspectRatio: string;
  imageSize: string;
  useCustomSize: boolean;
  apiKey: string;
  onSizeChange: (aspectRatio: string, imageSize: string, useCustomSize: boolean) => void;
}

export function SizeSelector({ aspectRatio, imageSize, useCustomSize, apiKey, onSizeChange }: SizeSelectorProps) {
  const handleCustomSizeChange = (checked: boolean) => {
    onSizeChange(aspectRatio, imageSize, checked);
  };

  const handleAspectRatioChange = (value: string) => {
    onSizeChange(value, imageSize, useCustomSize);
  };

  const handleImageSizeChange = (value: string) => {
    onSizeChange(aspectRatio, value, useCustomSize);
  };

  const currentAspect = ASPECT_RATIOS.find(a => a.value === aspectRatio);
  
  // 如果使用默认 key，隐藏 4K 选项
  const isDefaultKey = apiKey === DEFAULT_API_KEY;
  const availableSizes = isDefaultKey 
    ? IMAGE_SIZES.filter(size => size.id !== '4k')
    : IMAGE_SIZES;

  return (
    <div className="space-y-3">
      {/* 高级设置开关 */}
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="custom-size" 
          checked={useCustomSize}
          onCheckedChange={(checked) => handleCustomSizeChange(checked as boolean)}
        />
        <label
          htmlFor="custom-size"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1.5"
        >
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          指定图片尺寸
        </label>
      </div>

      {/* 尺寸设置面板 */}
      {useCustomSize && (
        <div className="space-y-4 p-3 bg-muted/30 rounded-lg border">
          {/* 宽高比选择 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Square className="h-3 w-3" />
              宽高比
            </Label>
            <Select value={aspectRatio} onValueChange={handleAspectRatioChange}>
              <SelectTrigger className="w-full h-8">
                <SelectValue placeholder="选择宽高比" />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((ratio) => (
                  <SelectItem key={ratio.id} value={ratio.value}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ratio.label}</span>
                      <span className="text-muted-foreground text-xs">
                        ({ratio.value})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentAspect && (
              <p className="text-xs text-muted-foreground">{currentAspect.description}</p>
            )}
          </div>

          {/* 分辨率选择 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Monitor className="h-3 w-3" />
              分辨率
            </Label>
            <div className="flex gap-2">
              {availableSizes.map((size) => (
                <Button
                  key={size.id}
                  type="button"
                  variant={imageSize === size.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleImageSizeChange(size.value)}
                  className="flex-1 h-8"
                >
                  <span className="font-medium text-sm">{size.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* 当前设置显示 */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-background rounded text-xs">
            <span className="text-muted-foreground">输出:</span>
            <span className="font-mono font-medium">
              {aspectRatio} · {imageSize}
            </span>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <p className="text-xs text-muted-foreground">
        💡 默认由模型决定尺寸。勾选上方选项可指定宽高比和分辨率。
      </p>
    </div>
  );
}
