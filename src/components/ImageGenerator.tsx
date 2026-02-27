'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sparkles, Loader2, AlertCircle, ImagePlus, X, ImageIcon } from 'lucide-react';
import { ModelSelector } from '@/components/ModelSelector';
import { SizeSelector } from '@/components/SizeSelector';
import { Checkbox } from '@/components/ui/checkbox';
import type { ApiConfig, EditImageState } from '@/types';

interface ImageGeneratorProps {
  apiConfig: ApiConfig;
  projectId: string;
  editState: EditImageState | null;
  onGenerate: (prompt: string, imageUrl: string, model: string, aspectRatio: string, imageSize: string, useCustomSize: boolean) => void;
  onOpenSettings: () => void;
  onModelChange: (model: string) => void;
  onSizeChange: (aspectRatio: string, imageSize: string, useCustomSize: boolean) => void;
  onClearEditState: () => void;
}

interface GeminiResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType: string;
          data: string;
        };
        text?: string;
      }>;
    };
  }>;
  error?: {
    message: string;
    code?: number;
  };
}

export function ImageGenerator({
  apiConfig,
  projectId,
  editState,
  onGenerate,
  onOpenSettings,
  onModelChange,
  onSizeChange,
  onClearEditState,
}: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfigAlert, setShowConfigAlert] = useState(false);
  
  // 图生图相关状态
  const [useReferenceImage, setUseReferenceImage] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageMime, setReferenceImageMime] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isConfigured = apiConfig.baseUrl && apiConfig.apiKey;
  const hasModel = apiConfig.selectedModel && apiConfig.selectedModel.length > 0;

  // 处理编辑状态变化
  useEffect(() => {
    if (editState) {
      // 填充提示词
      setPrompt(editState.prompt);
      
      // 更新模型
      if (editState.model) {
        onModelChange(editState.model);
      }
      
      // 更新尺寸设置
      onSizeChange(editState.aspectRatio, editState.imageSize, editState.useCustomSize);
      
      // 如果有参考图 URL，加载它
      if (editState.referenceImageUrl) {
        setUseReferenceImage(true);
        // 从 URL 加载图片并转换为 base64
        fetch(editState.referenceImageUrl)
          .then(response => response.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const result = event.target?.result as string;
              const matches = result.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                setReferenceImageMime(matches[1]);
                setReferenceImage(matches[2]);
              }
            };
            reader.readAsDataURL(blob);
          })
          .catch(err => {
            console.error('Failed to load reference image:', err);
          });
      }
      
      // 清除编辑状态，避免重复应用
      onClearEditState();
    }
  }, [editState, onModelChange, onSizeChange, onClearEditState]);

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }

    // 检查文件大小 (最大 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // 提取 base64 数据和 MIME 类型
      const matches = result.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        setReferenceImageMime(matches[1]);
        setReferenceImage(matches[2]);
      }
    };
    reader.readAsDataURL(file);
    
    // 清空 input 以便重复选择同一文件
    e.target.value = '';
  };

  // 移除参考图片
  const handleRemoveImage = () => {
    setReferenceImage(null);
    setReferenceImageMime(null);
    setUseReferenceImage(false);
  };

  // 触发文件选择
  const handleSelectImage = () => {
    fileInputRef.current?.click();
  };

  const handleGenerate = async () => {
    if (!isConfigured) {
      setShowConfigAlert(true);
      return;
    }

    if (!hasModel) {
      setError('请先选择一个模型');
      return;
    }

    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const baseUrl = apiConfig.baseUrl.replace(/\/+$/, '');
      const modelName = apiConfig.selectedModel.replace(/^models\//, '');
      const url = `${baseUrl}/v1beta/models/${modelName}:generateContent?key=${apiConfig.apiKey}`;

      // 构建 parts 数组
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
      
      // 如果有参考图片，先添加图片
      if (referenceImage && referenceImageMime) {
        parts.push({
          inlineData: {
            mimeType: referenceImageMime,
            data: referenceImage,
          },
        });
      }
      
      // 添加文本提示词
      parts.push({
        text: prompt.trim(),
      });

      // 构建请求体
      const requestBody: Record<string, unknown> = {
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      };

      // 如果启用了自定义尺寸，添加 imageConfig
      if (apiConfig.useCustomSize && apiConfig.aspectRatio) {
        (requestBody.generationConfig as Record<string, unknown>).imageConfig = {
          aspectRatio: apiConfig.aspectRatio,
          imageSize: apiConfig.imageSize || '1K',
        };
      }

      console.log('Request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
      }

      const data: GeminiResponse = await response.json();

      console.log('Response:', JSON.stringify(data, null, 2));

      if (data.error) {
        throw new Error(`API 错误: ${data.error.message}`);
      }

      const imageData = data.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData
      );

      if (imageData?.inlineData) {
        const imageUrl = `data:${imageData.inlineData.mimeType};base64,${imageData.inlineData.data}`;
        onGenerate(
          prompt.trim(),
          imageUrl,
          apiConfig.selectedModel,
          apiConfig.aspectRatio,
          apiConfig.imageSize,
          apiConfig.useCustomSize
        );
        setPrompt('');
        // 清除参考图片
        setReferenceImage(null);
        setReferenceImageMime(null);
        setUseReferenceImage(false);
      } else {
        // 检查是否有文本返回
        const textData = data.candidates?.[0]?.content?.parts?.find(
          (part) => part.text
        );
        
        let errorMsg = '未生成图片';
        
        if (textData?.text) {
          errorMsg += `，模型返回: "${textData.text.slice(0, 200)}${textData.text.length > 200 ? '...' : ''}"`;
        }
        
        // 检查 finishReason
        const finishReason = data.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
          errorMsg += `\n结束原因: ${finishReason}`;
        }
        
        throw new Error(errorMsg);
      }
    } catch (err) {
      console.error('Generation error:', err);
      const errorMsg = err instanceof Error ? err.message : '生成失败，请重试';
      setError(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="space-y-5">
        {/* 模型选择 */}
        <div className="space-y-2">
          <Label className="text-base font-serif">选择模型</Label>
          <ModelSelector
            apiConfig={apiConfig}
            selectedModel={apiConfig.selectedModel}
            onModelChange={onModelChange}
          />
        </div>

        {/* 尺寸选择 */}
        <SizeSelector
          aspectRatio={apiConfig.aspectRatio}
          imageSize={apiConfig.imageSize}
          useCustomSize={apiConfig.useCustomSize}
          apiKey={apiConfig.apiKey}
          onSizeChange={onSizeChange}
        />

        {/* 参考图片上传（图生图） */}
        <div className="space-y-3">
          {/* 图生图开关 */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="use-reference-image" 
              checked={useReferenceImage}
              onCheckedChange={(checked) => {
                setUseReferenceImage(checked as boolean);
                if (!checked) {
                  // 取消勾选时清除图片
                  setReferenceImage(null);
                  setReferenceImageMime(null);
                }
              }}
            />
            <label
              htmlFor="use-reference-image"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1.5"
            >
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              图生图（上传参考图片）
            </label>
          </div>

          {/* 图片上传区域 */}
          {useReferenceImage && (
            <div className="p-3 bg-muted/30 rounded-lg border">
              {/* 隐藏的文件输入 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              
              {referenceImage ? (
                // 显示已上传的图片预览
                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-background">
                  <img
                    src={`data:${referenceImageMime};base64,${referenceImage}`}
                    alt="参考图片"
                    className="w-full h-full object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                // 上传按钮
                <button
                  onClick={handleSelectImage}
                  className="w-full aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-background transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ImagePlus className="h-8 w-8" />
                  <span className="text-sm">点击上传参考图片</span>
                  <span className="text-xs">支持 JPG、PNG、WebP，最大 10MB</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 提示词输入 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="prompt" className="text-base font-serif">
              创作提示词
            </Label>
            {!isConfigured && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenSettings}
                className="h-7 gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                需要配置 API
              </Button>
            )}
          </div>
          <Textarea
            id="prompt"
            placeholder={referenceImage ? "描述你想如何变换这张图片，例如：将其转换为水彩画风格" : "描述你想要生成的图片，例如：一只可爱的香蕉在阳光下微笑，水彩画风格"}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px] resize-none"
            disabled={isGenerating}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="whitespace-pre-wrap break-words flex-1">{error}</div>
            </div>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim() || !hasModel}
          className="w-full h-11"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {referenceImage ? '图生图' : '生成图片'}
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          {referenceImage 
            ? '提示：描述清楚你想要的变化效果，如风格转换、内容修改等'
            : '提示：详细的描述能获得更好的效果'}
        </p>
      </div>

      <AlertDialog open={showConfigAlert} onOpenChange={setShowConfigAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">需要配置 API</AlertDialogTitle>
            <AlertDialogDescription>
              请先在设置中配置你的 Gemini API 参数才能生成图片
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowConfigAlert(false)}>
              稍后配置
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setShowConfigAlert(false);
                onOpenSettings();
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              前往设置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
