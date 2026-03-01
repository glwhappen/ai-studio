'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getOrCreateUserToken } from '@/lib/user';
import type { ApiProvider, ProviderConfig } from '@/types';

// 图片状态类型
export type ImageStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 图片记录
export interface ImageRecord {
  id: string;
  user_id: string;
  prompt: string;
  model: string;
  provider: ApiProvider;
  status: ImageStatus;
  image_url: string | null;
  thumbnail_url?: string | null; // 缩略图 URL
  original_url?: string; // 原始签名 URL，用于下载
  width?: number | null; // 图片宽度
  height?: number | null; // 图片高度
  error_message: string | null;
  is_public: boolean;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// API 配置
export interface ApiConfigState {
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

const STORAGE_KEY = 'ai-image-generator-state';

// 默认供应商配置
const DEFAULT_GEMINI_CONFIG: ProviderConfig = {
  baseUrl: 'https://ai.nflow.red',
  apiKey: 'sk-OQElE8IYLAryIy92mdyfnzvjCcgtRrMJk5hIGLgH0QbkEfYC',
  enabled: true,
};

const DEFAULT_OPENAI_CONFIG: ProviderConfig = {
  baseUrl: 'https://ai.nflow.red',
  apiKey: 'sk-V7ZFfhmndbAQXklSz2IC7gV68WGggGC5nxnlv0cXRq6ob3DN',
  enabled: true,
};

const defaultApiConfig: ApiConfigState = {
  currentProvider: 'openai',
  providers: {
    gemini: DEFAULT_GEMINI_CONFIG,
    openai: DEFAULT_OPENAI_CONFIG,
  },
  selectedModel: '',
  aspectRatio: '1:1',
  imageSize: '1K',
  openaiSize: 'auto',
  useCustomSize: false,
};

export function useAppState() {
  const [apiConfig, setApiConfig] = useState<ApiConfigState>(defaultApiConfig);
  const [autoPublic, setAutoPublic] = useState(true); // 默认自动公开
  const [userId, setUserId] = useState<string | null>(null);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // 使用 ref 来追踪是否有处理中的图片，避免 useEffect 依赖 images
  const hasPendingRef = useRef(false);

  // 从 localStorage 加载配置
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const storedProviders = parsed.apiConfig?.providers || {};
        
        setApiConfig({
          currentProvider: parsed.apiConfig?.currentProvider || 'openai',
          providers: {
            gemini: { ...DEFAULT_GEMINI_CONFIG, ...storedProviders.gemini },
            openai: { ...DEFAULT_OPENAI_CONFIG, ...storedProviders.openai },
          },
          selectedModel: parsed.apiConfig?.selectedModel || '',
          aspectRatio: parsed.apiConfig?.aspectRatio || '1:1',
          imageSize: parsed.apiConfig?.imageSize || '1K',
          openaiSize: parsed.apiConfig?.openaiSize || 'auto',
          useCustomSize: parsed.apiConfig?.useCustomSize || false,
        });
        
        // 读取自动公开设置
        if (typeof parsed.autoPublic === 'boolean') {
          setAutoPublic(parsed.autoPublic);
        }
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
    setIsLoaded(true);
  }, []);

  // 保存配置到 localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiConfig, autoPublic }));
    }
  }, [apiConfig, autoPublic, isLoaded]);

  // 初始化用户（通过 API）
  useEffect(() => {
    if (!isLoaded) return;
    
    const initUser = async () => {
      const token = getOrCreateUserToken();
      if (token) {
        try {
          const response = await fetch('/api/user/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          
          const data = await response.json();
          if (data.success && data.userId) {
            setUserId(data.userId);
          }
        } catch (error) {
          console.error('Failed to init user:', error);
        }
      }
    };
    
    initUser();
  }, [isLoaded]);

  // 获取用户图片列表
  const fetchImages = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/images?userId=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        const newImages = data.images || [];
        setImages(newImages);
        
        // 更新 ref
        hasPendingRef.current = newImages.some(
          (img: ImageRecord) => img.status === 'pending' || img.status === 'processing'
        );
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // 初始加载图片
  useEffect(() => {
    if (!userId) return;
    fetchImages();
  }, [userId, fetchImages]);

  // 定期刷新（检查处理中的图片状态）
  useEffect(() => {
    if (!userId) return;
    
    const interval = setInterval(() => {
      if (hasPendingRef.current) {
        fetchImages();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [userId, fetchImages]);

  // 获取当前供应商配置
  const getCurrentProviderConfig = useCallback((): ProviderConfig => {
    return apiConfig.providers[apiConfig.currentProvider];
  }, [apiConfig]);

  // 更新 API 配置
  const updateApiConfig = useCallback((config: Partial<ApiConfigState>) => {
    setApiConfig(prev => ({ ...prev, ...config }));
  }, []);

  // 更新特定供应商配置
  const updateProviderConfig = useCallback((provider: ApiProvider, config: Partial<ProviderConfig>) => {
    setApiConfig(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [provider]: { ...prev.providers[provider], ...config },
      },
    }));
  }, []);

  // 切换供应商
  const switchProvider = useCallback((provider: ApiProvider) => {
    setApiConfig(prev => ({
      ...prev,
      currentProvider: provider,
      selectedModel: '',
    }));
  }, []);

  // 提交图片生成任务
  const submitGeneration = useCallback(async (
    prompt: string,
    referenceImage?: { base64: string; mimeType: string } | null
  ): Promise<string | null> => {
    if (!userId) return null;
    
    const currentConfig = getCurrentProviderConfig();
    
    try {
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          prompt,
          model: apiConfig.selectedModel,
          provider: apiConfig.currentProvider,
          baseUrl: currentConfig.baseUrl,
          apiKey: currentConfig.apiKey,
          aspectRatio: apiConfig.useCustomSize ? apiConfig.aspectRatio : undefined,
          imageSize: apiConfig.useCustomSize ? apiConfig.imageSize : undefined,
          size: apiConfig.useCustomSize && apiConfig.openaiSize !== 'auto' ? apiConfig.openaiSize : undefined,
          referenceImage: referenceImage?.base64,
          referenceImageMime: referenceImage?.mimeType,
          isPublic: autoPublic, // 传递自动公开设置
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 标记有处理中的任务
        hasPendingRef.current = true;
        // 刷新图片列表
        fetchImages();
        return data.imageId;
      } else {
        throw new Error(data.error || '提交失败');
      }
    } catch (error) {
      console.error('Failed to submit generation:', error);
      throw error;
    }
  }, [userId, apiConfig, autoPublic, getCurrentProviderConfig, fetchImages]);

  // 更新自动公开设置
  const updateAutoPublic = useCallback((value: boolean) => {
    setAutoPublic(value);
  }, []);

  // 切换图片公开状态
  const toggleImagePublic = useCallback(async (imageId: string, isPublic: boolean) => {
    try {
      const response = await fetch(`/api/images/${imageId}/public`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic, userId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setImages(prev => prev.map(img => 
          img.id === imageId ? { ...img, is_public: isPublic } : img
        ));
      }
    } catch (error) {
      console.error('Failed to toggle public:', error);
    }
  }, [userId]);

  // 删除图片
  const deleteImage = useCallback(async (imageId: string) => {
    try {
      const response = await fetch(`/api/images/${imageId}?userId=${userId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setImages(prev => prev.filter(img => img.id !== imageId));
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  }, [userId]);
  
  // 更新用户 ID（用于导入身份）
  const updateUserId = useCallback((newUserId: string) => {
    setUserId(newUserId);
    // 同时更新 localStorage 中的 token
    localStorage.setItem('ai-image-user-token', newUserId);
  }, []);

  return {
    apiConfig,
    autoPublic,
    userId,
    images,
    isLoading,
    isLoaded,
    updateApiConfig,
    updateAutoPublic,
    updateProviderConfig,
    switchProvider,
    getCurrentProviderConfig,
    fetchImages,
    submitGeneration,
    toggleImagePublic,
    deleteImage,
    updateUserId,
  };
}
