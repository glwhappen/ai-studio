// 图片生成结果
export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  projectId: string;
  model: string;
  createdAt: string;
}

// 项目
export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// API 配置
export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
}

// Gemini 模型信息
export interface GeminiModel {
  name: string;
  displayName: string;
  supportedGenerationMethods?: string[];
}

// 应用状态
export interface AppState {
  apiConfig: ApiConfig;
  projects: Project[];
  images: GeneratedImage[];
  currentProjectId: string | null;
}
