'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IMAGE_SIZE_PRESETS, type ImageSizePreset } from '@/types';
import { Maximize2, Square } from 'lucide-react';

interface SizeSelectorProps {
  width: number;
  height: number;
  onSizeChange: (width: number, height: number) => void;
}

export function SizeSelector({ width, height, onSizeChange }: SizeSelectorProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [customWidth, setCustomWidth] = useState(width.toString());
  const [customHeight, setCustomHeight] = useState(height.toString());

  // 检查当前尺寸是否匹配某个预设
  const currentPreset = IMAGE_SIZE_PRESETS.find(
    (p) => p.width === width && p.height === height
  );

  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      setIsCustom(true);
    } else {
      const preset = IMAGE_SIZE_PRESETS.find((p) => p.id === value);
      if (preset) {
        setIsCustom(false);
        onSizeChange(preset.width, preset.height);
        setCustomWidth(preset.width.toString());
        setCustomHeight(preset.height.toString());
      }
    }
  };

  const handleCustomApply = () => {
    const w = parseInt(customWidth, 10);
    const h = parseInt(customHeight, 10);
    if (w > 0 && h > 0) {
      onSizeChange(w, h);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Square className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm">图片尺寸</Label>
      </div>

      <Select
        value={isCustom ? 'custom' : (currentPreset?.id || 'square')}
        onValueChange={handlePresetChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="选择尺寸" />
        </SelectTrigger>
        <SelectContent>
          {IMAGE_SIZE_PRESETS.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{preset.label}</span>
                <span className="text-muted-foreground text-xs">
                  {preset.width}×{preset.height}
                </span>
              </div>
            </SelectItem>
          ))}
          <SelectItem value="custom">
            <div className="flex items-center gap-2">
              <Maximize2 className="h-3.5 w-3.5" />
              <span>自定义尺寸</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {isCustom && (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">宽度 (px)</Label>
              <Input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                min={256}
                max={2048}
                className="h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">高度 (px)</Label>
              <Input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
                min={256}
                max={2048}
                className="h-8"
              />
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCustomApply}
            className="w-full h-8"
          >
            应用自定义尺寸
          </Button>
        </div>
      )}

      {/* 显示当前尺寸 */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md py-1.5">
        <span>当前尺寸:</span>
        <span className="font-mono font-medium text-foreground">
          {width} × {height}
        </span>
      </div>
    </div>
  );
}
