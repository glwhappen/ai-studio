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
import { IMAGE_SIZES, ASPECT_RATIOS, OPENAI_SIZES, ApiProvider } from '@/types';
import { Settings2, Square, Monitor } from 'lucide-react';

interface SizeSelectorProps {
  provider: ApiProvider;
  // Gemini 参数
  aspectRatio: string;
  imageSize: string;
  // OpenAI 参数
  openaiSize: string;
  useCustomSize: boolean;
  apiKey: string;
  onSizeChange: (params: {
    aspectRatio?: string;
    imageSize?: string;
    openaiSize?: string;
    useCustomSize?: boolean;
  }) => void;
}

export function SizeSelector({ 
  provider, 
  aspectRatio, 
  imageSize, 
  openaiSize,
  useCustomSize, 
  apiKey, 
  onSizeChange 
}: SizeSelectorProps) {
  const handleCustomSizeChange = (checked: boolean) => {
    onSizeChange({ useCustomSize: checked });
  };

  const handleAspectRatioChange = (value: string) => {
    onSizeChange({ aspectRatio: value });
  };

  const handleImageSizeChange = (value: string) => {
    onSizeChange({ imageSize: value });
  };

  const handleOpenAISizeChange = (value: string) => {
    onSizeChange({ openaiSize: value });
  };

  const currentAspect = ASPECT_RATIOS.find(a => a.value === aspectRatio);
  
  // 所有尺寸选项都可用
  const availableGeminiSizes = IMAGE_SIZES;

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
          {provider === 'gemini' ? (
            <>
              {/* Gemini: 宽高比选择 */}
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

              {/* Gemini: 分辨率选择 */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Monitor className="h-3 w-3" />
                  分辨率
                </Label>
                <div className="flex gap-2">
                  {availableGeminiSizes.map((size) => (
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
            </>
          ) : (
            <>
              {/* OpenAI: 尺寸选择 */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Monitor className="h-3 w-3" />
                  图片尺寸
                </Label>
                <Select value={openaiSize} onValueChange={handleOpenAISizeChange}>
                  <SelectTrigger className="w-full h-8">
                    <SelectValue placeholder="选择尺寸" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_SIZES.map((size) => (
                      <SelectItem key={size.id} value={size.value}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{size.label}</span>
                          <span className="text-muted-foreground text-xs">
                            {size.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* 当前设置显示 */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-background rounded text-xs">
            <span className="text-muted-foreground">输出:</span>
            <span className="font-mono font-medium">
              {provider === 'gemini' 
                ? `${aspectRatio} · ${imageSize}`
                : openaiSize
              }
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
