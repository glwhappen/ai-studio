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
import type { ApiProvider, ProviderConfig } from '@/types';

// 缓存 key 前缀
const MODELS_CACHE_PREFIX = 'ai-image-models-cache-';

// 模型信息
interface ModelInfo {
  name: string;
  displayName: string;
  provider: ApiProvider;
}

// API 配置状态（简化版）
interface ApiConfigState {
  currentProvider: ApiProvider;
  providers: {
    gemini: ProviderConfig;
    openai: ProviderConfig;
  };
  selectedModel: string;
  aspectRatio: string;
  imageSize: string;
  openaiSize: string;
  useCustomSize: boolean;
}

// 生成缓存 key
function getCacheKey(provider: ApiProvider, baseUrl: string): string {
  const normalizedUrl = baseUrl.replace(/https?:\/\//, '').replace(/\/$/, '');
  return `${MODELS_CACHE_PREFIX}${provider}-${normalizedUrl}`;
}

// 从缓存读取模型列表
function getModelsFromCache(provider: ApiProvider, baseUrl: string): ModelInfo[] | null {
  try {
    const cacheKey = getCacheKey(provider, baseUrl);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('Failed to read models from cache:', e);
  }
  return null;
}

// 保存模型列表到缓存
function saveModelsToCache(provider: ApiProvider, baseUrl: string, models: ModelInfo[]): void {
  try {
    const cacheKey = getCacheKey(provider, baseUrl);
    localStorage.setItem(cacheKey, JSON.stringify(models));
  } catch (e) {
    console.error('Failed to save models to cache:', e);
  }
}

interface ModelSelectorProps {
  apiConfig: ApiConfigState;
  selectedModel: string;
  currentProvider: ApiProvider;
  currentProviderConfig: ProviderConfig;
  onModelChange: (model: string) => void;
}

interface ModelsResponse {
  success?: boolean;
  models?: ModelInfo[];
  error?: string;
}

export function ModelSelector({
  apiConfig,
  selectedModel,
  currentProvider,
  currentProviderConfig,
  onModelChange,
}: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedFromCache, setHasLoadedFromCache] = useState(false);

  const fetchModels = useCallback(async (forceRefresh: boolean = false) => {
    if (!currentProviderConfig.baseUrl || !currentProviderConfig.apiKey) {
      setModels([]);
      return;
    }

    // 如果不是强制刷新，先尝试从缓存读取
    if (!forceRefresh) {
      const cachedModels = getModelsFromCache(currentProvider, currentProviderConfig.baseUrl);
      if (cachedModels && cachedModels.length > 0) {
        setModels(cachedModels);
        setHasLoadedFromCache(true);
        
        // 如果当前没有选择模型，自动选择第一个
        if (!selectedModel && cachedModels.length > 0) {
          onModelChange(cachedModels[0].name);
        }
        return;
      }
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
          baseUrl: currentProviderConfig.baseUrl,
          apiKey: currentProviderConfig.apiKey,
          provider: currentProvider,
        }),
      });

      const data: ModelsResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `获取模型列表失败: ${response.status}`);
      }

      const allModels = data.models || [];
      
      // 保存到缓存
      if (allModels.length > 0) {
        saveModelsToCache(currentProvider, currentProviderConfig.baseUrl, allModels);
      }
      
      setModels(allModels);
      setHasLoadedFromCache(false);

      // 如果当前选择的模型不在列表中，清空选择
      if (selectedModel && !allModels.find(m => m.name === selectedModel)) {
        if (allModels.length > 0) {
          onModelChange(allModels[0].name);
        } else {
          onModelChange('');
        }
      } else if (!selectedModel && allModels.length > 0) {
        // 如果没有选择模型，自动选择第一个
        onModelChange(allModels[0].name);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
      setError(err instanceof Error ? err.message : '获取模型列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [currentProviderConfig.baseUrl, currentProviderConfig.apiKey, currentProvider, selectedModel, onModelChange]);

  // 当供应商配置变化时获取模型列表（从缓存或请求）
  useEffect(() => {
    setHasLoadedFromCache(false);
    fetchModels(false);
  }, [currentProviderConfig.baseUrl, currentProviderConfig.apiKey, currentProvider]);

  // 手动刷新
  const handleRefresh = () => {
    fetchModels(true);
  };

  const isConfigured = currentProviderConfig.baseUrl && currentProviderConfig.apiKey;

  // 获取当前选中模型的信息
  const selectedModelInfo = models.find((m) => m.name === selectedModel || m.name === `models/${selectedModel}`);

  if (!isConfigured) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        请先在设置中配置 {currentProvider === 'gemini' ? 'Gemini' : 'GPT Image'} API
      </div>
    );
  }

  if (!currentProviderConfig.enabled) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        当前供应商已禁用，请在设置中启用
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedModel}
        onValueChange={(value) => {
          onModelChange(value);
        }}
        disabled={isLoading || models.length === 0}
      >
        <SelectTrigger className="w-full min-w-[200px]">
          <SelectValue placeholder="选择模型...">
            {selectedModel ? (
              <div className="flex items-center gap-2 truncate">
                {currentProvider === 'gemini' ? (
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
              未找到该供应商的图片生成模型
            </div>
          )}
          
          {models.map((model) => (
            <SelectItem key={model.name} value={model.name}>
              <div className="flex items-center gap-2">
                {model.provider === 'gemini' ? (
                  <Sparkles className="h-3 w-3 text-primary" />
                ) : (
                  <Bot className="h-3 w-3 text-blue-500" />
                )}
                <span>{model.displayName || model.name.split('/').pop()}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleRefresh}
        disabled={isLoading}
        title={hasLoadedFromCache ? "从缓存加载，点击刷新" : "刷新模型列表"}
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
