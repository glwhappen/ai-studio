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
import { 
  IMAGE_SIZE_PRESETS, 
  RESOLUTION_TIERS, 
  getPresetsByResolution,
  getResolutionBySize,
  type ImageSizePreset 
} from '@/types';
import { Maximize2, Square, Monitor, Sparkles, Crown } from 'lucide-react';

interface SizeSelectorProps {
  width?: number;
  height?: number;
  resolution?: string;
  onSizeChange: (width: number, height: number, resolution: string) => void;
}

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 1024;

const resolutionIcons: Record<string, React.ReactNode> = {
  '1k': <Monitor className="h-4 w-4" />,
  '2k': <Sparkles className="h-4 w-4" />,
  '4k': <Crown className="h-4 w-4" />,
};

export function SizeSelector({ width, height, resolution, onSizeChange }: SizeSelectorProps) {
  const actualWidth = width ?? DEFAULT_WIDTH;
  const actualHeight = height ?? DEFAULT_HEIGHT;
  const actualResolution = resolution ?? getResolutionBySize(actualWidth);
  
  const [isCustom, setIsCustom] = useState(false);
  const [customWidth, setCustomWidth] = useState(actualWidth.toString());
  const [customHeight, setCustomHeight] = useState(actualHeight.toString());

  // 获取当前分辨率下的预设
  const currentPresets = getPresetsByResolution(actualResolution);
  
  // 检查当前尺寸是否匹配某个预设
  const currentPreset = IMAGE_SIZE_PRESETS.find(
    (p) => p.width === actualWidth && p.height === actualHeight
  );

  const handleResolutionChange = (newResolution: string) => {
    const presets = getPresetsByResolution(newResolution);
    if (presets.length > 0) {
      // 默认选择正方形
      const squarePreset = presets.find(p => p.aspectRatio === '1:1') || presets[0];
      onSizeChange(squarePreset.width, squarePreset.height, newResolution);
      setCustomWidth(squarePreset.width.toString());
      setCustomHeight(squarePreset.height.toString());
    }
    setIsCustom(false);
  };

  const handlePresetChange = (presetId: string) => {
    if (presetId === 'custom') {
      setIsCustom(true);
    } else {
      const preset = IMAGE_SIZE_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        setIsCustom(false);
        const newResolution = getResolutionBySize(preset.width);
        onSizeChange(preset.width, preset.height, newResolution);
        setCustomWidth(preset.width.toString());
        setCustomHeight(preset.height.toString());
      }
    }
  };

  const handleCustomApply = () => {
    const w = parseInt(customWidth, 10);
    const h = parseInt(customHeight, 10);
    if (w > 0 && h > 0) {
      const newResolution = getResolutionBySize(w);
      onSizeChange(w, h, newResolution);
    }
  };

  return (
    <div className="space-y-4">
      {/* 分辨率档位选择 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Square className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">分辨率</Label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {RESOLUTION_TIERS.map((tier) => (
            <Button
              key={tier.id}
              type="button"
              variant={actualResolution === tier.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleResolutionChange(tier.id)}
              className="h-auto py-2 flex-col gap-0.5"
            >
              <div className="flex items-center gap-1">
                {resolutionIcons[tier.id]}
                <span className="font-semibold">{tier.label}</span>
              </div>
              <span className="text-xs opacity-70">{tier.description}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* 宽高比选择 */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">宽高比</Label>
        <Select
          value={isCustom ? 'custom' : (currentPreset?.id || currentPresets[0]?.id)}
          onValueChange={handlePresetChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择宽高比" />
          </SelectTrigger>
          <SelectContent>
            {currentPresets.map((preset) => (
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
      </div>

      {/* 自定义尺寸输入 */}
      {isCustom && (
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">宽度 (px)</Label>
              <Input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                min={256}
                max={4096}
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
                max={4096}
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

      {/* 当前尺寸信息 */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-md text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">输出尺寸:</span>
          <span className="font-mono font-medium">
            {actualWidth} × {actualHeight}
          </span>
        </div>
        <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded">
          {currentPreset?.aspectRatio || '自定义'}
        </span>
      </div>
      
      {/* 提示信息 */}
      <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md p-2">
        💡 <strong>提示:</strong> 尺寸信息会自动添加到提示词中，帮助模型生成更精确的分辨率。你也可以在提示词中明确写出尺寸要求。
      </p>
    </div>
  );
}
