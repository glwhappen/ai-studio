'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle, Sparkles, Bot } from 'lucide-react';
import type { ApiConfig, ModelInfo, ApiProvider } from '@/types';

interface ModelSelectorProps {
  apiConfig: ApiConfig;
  selectedModel: string;
  onModelChange: (model: string, provider: ApiProvider) => void;
}

interface ModelsResponse {
  success?: boolean;
  models?: ModelInfo[];
  error?: string;
}

export function ModelSelector({
  apiConfig,
  selectedModel,
  onModelChange,
}: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      setModels([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseUrl: apiConfig.baseUrl,
          apiKey: apiConfig.apiKey,
        }),
      });

      const data: ModelsResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `获取模型列表失败: ${response.status}`);
      }

      const fetchedModels = data.models || [];
      setModels(fetchedModels);

      // 如果当前没有选择模型且有可用模型，自动选择第一个
      if (!selectedModel && fetchedModels.length > 0) {
        onModelChange(fetchedModels[0].name, fetchedModels[0].provider);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
      setError(err instanceof Error ? err.message : '获取模型列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [apiConfig.baseUrl, apiConfig.apiKey, selectedModel, onModelChange]);

  // 当 API 配置变化时获取模型列表
  useEffect(() => {
    fetchModels();
  }, [apiConfig.baseUrl, apiConfig.apiKey]);

  const isConfigured = apiConfig.baseUrl && apiConfig.apiKey;

  // 获取当前选中模型的信息
  const selectedModelInfo = models.find((m) => m.name === selectedModel || m.name === `models/${selectedModel}`);

  if (!isConfigured) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        请先配置 API
      </div>
    );
  }

  // 按提供商分组
  const geminiModels = models.filter(m => m.provider === 'gemini');
  const openaiModels = models.filter(m => m.provider === 'openai');

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedModel}
        onValueChange={(value) => {
          const model = models.find(m => m.name === value);
          if (model) {
            onModelChange(value, model.provider);
          }
        }}
        disabled={isLoading || models.length === 0}
      >
        <SelectTrigger className="w-full min-w-[200px]">
          <SelectValue placeholder="选择模型...">
            {selectedModel ? (
              <div className="flex items-center gap-2 truncate">
                {selectedModelInfo?.provider === 'gemini' ? (
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                )}
                <span className="truncate">
                  {selectedModelInfo?.displayName || selectedModel.split('/').pop()}
                </span>
              </div>
            ) : (
              '选择模型...'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {models.length === 0 && !isLoading && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              未找到支持图片生成的模型
            </div>
          )}
          
          {/* Gemini 模型组 */}
          {geminiModels.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Gemini 系列
              </div>
              {geminiModels.map((model) => (
                <SelectItem key={model.name} value={model.name}>
                  <span>{model.displayName || model.name.split('/').pop()}</span>
                </SelectItem>
              ))}
            </>
          )}

          {/* OpenAI 模型组 */}
          {openaiModels.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1 border-t mt-1 pt-1">
                <Bot className="h-3 w-3" />
                GPT Image 系列
              </div>
              {openaiModels.map((model) => (
                <SelectItem key={model.name} value={model.name}>
                  <span>{model.displayName || model.name.split('/').pop()}</span>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        onClick={fetchModels}
        disabled={isLoading}
        title="刷新模型列表"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </Button>
      {error && (
        <span className="text-xs text-destructive" title={error}>
          加载失败
        </span>
      )}
    </div>
  );
}
