// 图片生成结果
export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  projectId: string;
  model: string;
  width?: number;
  height?: number;
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

// 图片尺寸预设
export interface ImageSizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  description: string;
}

// API 配置
export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
  imageWidth: number;
  imageHeight: number;
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

// 预设尺寸列表
export const IMAGE_SIZE_PRESETS: ImageSizePreset[] = [
  { id: 'square', label: '正方形', width: 1024, height: 1024, description: '1:1 适合头像、图标' },
  { id: 'landscape-4-3', label: '横版 4:3', width: 1024, height: 768, description: '适合演示文稿' },
  { id: 'landscape-16-9', label: '横版 16:9', width: 1024, height: 576, description: '适合封面、横幅' },
  { id: 'landscape-3-2', label: '横版 3:2', width: 1024, height: 683, description: '适合照片展示' },
  { id: 'portrait-3-4', label: '竖版 3:4', width: 768, height: 1024, description: '适合海报、手机壁纸' },
  { id: 'portrait-9-16', label: '竖版 9:16', width: 576, height: 1024, description: '适合手机全屏' },
  { id: 'portrait-2-3', label: '竖版 2:3', width: 683, height: 1024, description: '适合社交媒体' },
];
