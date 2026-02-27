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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  IMAGE_SIZE_PRESETS, 
  RESOLUTION_TIERS, 
  type ImageSizePreset 
} from '@/types';
import { Maximize2, Square, Monitor, Sparkles, Crown, Settings2 } from 'lucide-react';

interface SizeSelectorProps {
  width?: number;
  height?: number;
  resolution?: string;
  onSizeChange: (width: number, height: number, resolution: string) => void;
}

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 1024;
const DEFAULT_RESOLUTION = '1k';

const resolutionIcons: Record<string, React.ReactNode> = {
  '1k': <Monitor className="h-3.5 w-3.5" />,
  '2k': <Sparkles className="h-3.5 w-3.5" />,
  '4k': <Crown className="h-3.5 w-3.5" />,
};

export function SizeSelector({ width, height, resolution, onSizeChange }: SizeSelectorProps) {
  const actualWidth = width ?? DEFAULT_WIDTH;
  const actualHeight = height ?? DEFAULT_HEIGHT;
  // 如果 resolution 为空，表示未启用高级设置
  const hasResolution = !!resolution;
  const actualResolution = resolution || DEFAULT_RESOLUTION;
  
  const [showAdvanced, setShowAdvanced] = useState(hasResolution);
  const [isCustom, setIsCustom] = useState(false);
  const [customWidth, setCustomWidth] = useState(actualWidth.toString());
  const [customHeight, setCustomHeight] = useState(actualHeight.toString());

  // 根据分辨率获取预设
  const currentPresets = IMAGE_SIZE_PRESETS.filter(p => p.id.startsWith(actualResolution));
  
  // 检查当前尺寸是否匹配某个预设
  const currentPreset = IMAGE_SIZE_PRESETS.find(
    (p) => p.width === actualWidth && p.height === actualHeight
  );

  // 当开关状态改变时
  const handleAdvancedChange = (checked: boolean) => {
    setShowAdvanced(checked);
    if (checked) {
      // 开启时，使用默认分辨率
      handleResolutionChange(DEFAULT_RESOLUTION);
    } else {
      // 关闭时，清空分辨率设置
      onSizeChange(actualWidth, actualHeight, '');
    }
  };

  const handleResolutionChange = (newResolution: string) => {
    const presets = IMAGE_SIZE_PRESETS.filter(p => p.id.startsWith(newResolution));
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
        onSizeChange(preset.width, preset.height, actualResolution);
        setCustomWidth(preset.width.toString());
        setCustomHeight(preset.height.toString());
      }
    }
  };

  const handleCustomApply = () => {
    const w = parseInt(customWidth, 10);
    const h = parseInt(customHeight, 10);
    if (w > 0 && h > 0) {
      onSizeChange(w, h, actualResolution);
    }
  };

  return (
    <div className="space-y-3">
      {/* 高级设置开关 */}
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="advanced-size" 
          checked={showAdvanced}
          onCheckedChange={handleAdvancedChange}
        />
        <label
          htmlFor="advanced-size"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1.5"
        >
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          指定图片尺寸和分辨率
        </label>
      </div>

      {/* 高级设置面板 */}
      {showAdvanced && (
        <div className="space-y-4 p-3 bg-muted/30 rounded-lg border">
          {/* 分辨率档位选择 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">分辨率质量</Label>
            <div className="grid grid-cols-3 gap-2">
              {RESOLUTION_TIERS.map((tier) => (
                <Button
                  key={tier.id}
                  type="button"
                  variant={actualResolution === tier.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleResolutionChange(tier.id)}
                  className="h-auto py-1.5 flex-col gap-0"
                >
                  <div className="flex items-center gap-1 text-xs">
                    {resolutionIcons[tier.id]}
                    <span className="font-semibold">{tier.label}</span>
                  </div>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {RESOLUTION_TIERS.find(t => t.id === actualResolution)?.description}
            </p>
          </div>

          {/* 宽高比选择 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">宽高比</Label>
            <Select
              value={isCustom ? 'custom' : (currentPreset?.id || currentPresets[0]?.id)}
              onValueChange={handlePresetChange}
            >
              <SelectTrigger className="w-full h-8">
                <SelectValue placeholder="选择宽高比" />
              </SelectTrigger>
              <SelectContent>
                {currentPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <div className="flex items-center gap-2 text-sm">
                      <span>{preset.label}</span>
                      <span className="text-muted-foreground text-xs">
                        ({preset.aspectRatio})
                      </span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="custom">
                  <div className="flex items-center gap-2 text-sm">
                    <Maximize2 className="h-3 w-3" />
                    <span>自定义</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 自定义尺寸输入 */}
          {isCustom && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
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
                <div className="space-y-1">
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
                className="w-full h-7 text-xs"
              >
                应用
              </Button>
            </div>
          )}

          {/* 当前尺寸信息 */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-background rounded text-xs">
            <span className="text-muted-foreground">输出:</span>
            <span className="font-mono font-medium">
              {actualWidth} × {actualHeight}
            </span>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <p className="text-xs text-muted-foreground">
        💡 默认由模型决定尺寸。勾选上方选项可指定分辨率，尺寸描述会自动添加到提示词中。
      </p>
    </div>
  );
}
