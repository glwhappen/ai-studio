'use client';

import { useState } from 'react';
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
import { Sparkles, Loader2, AlertCircle, Settings } from 'lucide-react';
import type { ApiConfig } from '@/types';

interface ImageGeneratorProps {
  apiConfig: ApiConfig;
  projectId: string;
  onGenerate: (prompt: string, imageUrl: string) => void;
  onOpenSettings: () => void;
}

interface GeminiResponse {
  candidates?: Array<{
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
  };
}

export function ImageGenerator({
  apiConfig,
  projectId,
  onGenerate,
  onOpenSettings,
}: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfigAlert, setShowConfigAlert] = useState(false);

  const isConfigured = apiConfig.baseUrl && apiConfig.apiKey;

  const handleGenerate = async () => {
    if (!isConfigured) {
      setShowConfigAlert(true);
      return;
    }

    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const url = `${apiConfig.baseUrl}/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiConfig.apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
      }

      const data: GeminiResponse = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const imageData = data.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData
      );

      if (imageData?.inlineData) {
        const imageUrl = `data:${imageData.inlineData.mimeType};base64,${imageData.inlineData.data}`;
        onGenerate(prompt.trim(), imageUrl);
        setPrompt('');
      } else {
        throw new Error('未生成图片，请尝试不同的提示词');
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
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
            placeholder="描述你想要生成的图片，例如：一只可爱的香蕉在阳光下微笑，水彩画风格"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px] resize-none"
            disabled={isGenerating}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
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
              生成图片
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          提示：详细的描述能获得更好的效果
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
