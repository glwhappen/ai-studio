'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AppState, Project, GeneratedImage, ApiConfig, ProviderConfig, ApiProvider } from '@/types';

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

const defaultState: AppState = {
  apiConfig: {
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
  },
  projects: [],
  images: [],
  currentProjectId: null,
};

export function useAppState() {
  const [state, setState] = useState<AppState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);

  // 从 localStorage 加载数据
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // 深度合并 apiConfig
        const storedApiConfig = parsed.apiConfig || {};
        const storedProviders = storedApiConfig.providers || {};
        
        const mergedApiConfig: ApiConfig = {
          currentProvider: storedApiConfig.currentProvider || 'openai',
          providers: {
            gemini: {
              ...DEFAULT_GEMINI_CONFIG,
              ...(storedProviders.gemini || {}),
            },
            openai: {
              ...DEFAULT_OPENAI_CONFIG,
              ...(storedProviders.openai || {}),
            },
          },
          selectedModel: storedApiConfig.selectedModel || '',
          aspectRatio: storedApiConfig.aspectRatio || '1:1',
          imageSize: storedApiConfig.imageSize || '1K',
          openaiSize: storedApiConfig.openaiSize || 'auto',
          useCustomSize: storedApiConfig.useCustomSize || false,
        };
        
        setState({
          ...defaultState,
          ...parsed,
          apiConfig: mergedApiConfig,
        });
      }
    } catch (error) {
      console.error('Failed to load state from localStorage:', error);
    }
    setIsLoaded(true);
  }, []);

  // 保存到 localStorage
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error('Failed to save state to localStorage:', error);
      }
    }
  }, [state, isLoaded]);

  // 获取当前供应商配置
  const getCurrentProviderConfig = useCallback((): ProviderConfig => {
    return state.apiConfig.providers[state.apiConfig.currentProvider];
  }, [state.apiConfig]);

  // 更新 API 配置
  const updateApiConfig = useCallback((config: Partial<ApiConfig>) => {
    setState((prev) => ({
      ...prev,
      apiConfig: { ...prev.apiConfig, ...config },
    }));
  }, []);

  // 更新特定供应商配置
  const updateProviderConfig = useCallback((provider: ApiProvider, config: Partial<ProviderConfig>) => {
    setState((prev) => ({
      ...prev,
      apiConfig: {
        ...prev.apiConfig,
        providers: {
          ...prev.apiConfig.providers,
          [provider]: {
            ...prev.apiConfig.providers[provider],
            ...config,
          },
        },
      },
    }));
  }, []);

  // 切换供应商
  const switchProvider = useCallback((provider: ApiProvider) => {
    setState((prev) => ({
      ...prev,
      apiConfig: {
        ...prev.apiConfig,
        currentProvider: provider,
        selectedModel: '', // 切换供应商时清空模型选择
      },
    }));
  }, []);

  // 项目管理
  const createProject = useCallback((name: string, description?: string) => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      projects: [...prev.projects, newProject],
      currentProjectId: newProject.id,
    }));
    return newProject;
  }, []);

  const updateProject = useCallback(
    (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
      setState((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === id
            ? { ...p, ...updates, updatedAt: new Date().toISOString() }
            : p
        ),
      }));
    },
    []
  );

  const deleteProject = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
      images: prev.images.filter((img) => img.projectId !== id),
      currentProjectId:
        prev.currentProjectId === id ? null : prev.currentProjectId,
    }));
  }, []);

  const selectProject = useCallback((id: string | null) => {
    setState((prev) => ({
      ...prev,
      currentProjectId: id,
    }));
  }, []);

  // 图片管理
  const addImage = useCallback((image: Omit<GeneratedImage, 'id' | 'createdAt'>) => {
    const newImage: GeneratedImage = {
      ...image,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      images: [newImage, ...prev.images],
    }));
    return newImage;
  }, []);

  const deleteImage = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      images: prev.images.filter((img) => img.id !== id),
    }));
  }, []);

  const getProjectImages = useCallback(
    (projectId: string) => {
      return state.images.filter((img) => img.projectId === projectId);
    },
    [state.images]
  );

  const getCurrentProject = useCallback(() => {
    return state.projects.find((p) => p.id === state.currentProjectId);
  }, [state.projects, state.currentProjectId]);

  return {
    state,
    isLoaded,
    updateApiConfig,
    updateProviderConfig,
    switchProvider,
    getCurrentProviderConfig,
    createProject,
    updateProject,
    deleteProject,
    selectProject,
    addImage,
    deleteImage,
    getProjectImages,
    getCurrentProject,
  };
}
