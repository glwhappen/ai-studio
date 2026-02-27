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
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import type { GeminiModel, ApiConfig } from '@/types';

interface ModelSelectorProps {
  apiConfig: ApiConfig;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

interface ModelsResponse {
  models?: Array<{
    name: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }>;
}

export function ModelSelector({
  apiConfig,
  selectedModel,
  onModelChange,
}: ModelSelectorProps) {
  const [models, setModels] = useState<GeminiModel[]>([]);
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
      // 移除 baseUrl 末尾的斜杠
      const baseUrl = apiConfig.baseUrl.replace(/\/+$/, '');
      const url = `${baseUrl}/v1beta/models?key=${apiConfig.apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`获取模型列表失败: ${response.status}`);
      }

      const data: ModelsResponse = await response.json();

      // 过滤包含 gemini 和 image 的模型
      const filteredModels: GeminiModel[] = (data.models || [])
        .filter((model) => {
          const nameLower = model.name.toLowerCase();
          const displayNameLower = (model.displayName || '').toLowerCase();
          return (
            (nameLower.includes('gemini') || displayNameLower.includes('gemini')) &&
            (nameLower.includes('image') || displayNameLower.includes('image'))
          );
        })
        .map((model) => ({
          name: model.name,
          displayName: model.displayName || model.name,
          supportedGenerationMethods: model.supportedGenerationMethods,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      setModels(filteredModels);

      // 如果当前没有选择模型且有可用模型，自动选择第一个
      if (!selectedModel && filteredModels.length > 0) {
        onModelChange(filteredModels[0].name);
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

  if (!isConfigured) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        请先配置 API
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedModel}
        onValueChange={onModelChange}
        disabled={isLoading || models.length === 0}
      >
        <SelectTrigger className="w-full min-w-[200px]">
          <SelectValue placeholder="选择模型...">
            {selectedModel ? (
              <span className="truncate">
                {models.find((m) => m.name === selectedModel)?.displayName ||
                  selectedModel.split('/').pop()}
              </span>
            ) : (
              '选择模型...'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {models.length === 0 && !isLoading && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              未找到支持图片生成的模型
            </div>
          )}
          {models.map((model) => (
            <SelectItem key={model.name} value={model.name}>
              <div className="flex flex-col">
                <span className="font-medium">
                  {model.displayName || model.name.split('/').pop()}
                </span>
              </div>
            </SelectItem>
          ))}
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
