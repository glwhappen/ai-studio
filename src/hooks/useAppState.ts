'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AppState, Project, GeneratedImage, ApiConfig } from '@/types';

const STORAGE_KEY = 'gemini-image-generator-state';

const defaultState: AppState = {
  apiConfig: {
    baseUrl: '',
    apiKey: '',
    selectedModel: '',
    imageWidth: 1024,
    imageHeight: 1024,
    resolution: '', // 空字符串表示未启用高级尺寸设置
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
        // 深度合并 apiConfig，确保默认值存在
        const mergedApiConfig = {
          ...defaultState.apiConfig,
          ...(parsed.apiConfig || {}),
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

  // API 配置
  const updateApiConfig = useCallback((config: Partial<ApiConfig>) => {
    setState((prev) => ({
      ...prev,
      apiConfig: { ...prev.apiConfig, ...config },
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
