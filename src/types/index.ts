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

// 分辨率档位
export interface ResolutionTier {
  id: string;
  label: string;
  description: string;
  promptHint: string; // 用于添加到提示词中
}

// 图片尺寸预设
export interface ImageSizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  description: string;
  aspectRatio: string; // 宽高比描述
}

// API 配置
export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
  imageWidth: number;
  imageHeight: number;
  resolution: string; // 分辨率档位 ID
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

// 分辨率档位列表
export const RESOLUTION_TIERS: ResolutionTier[] = [
  { 
    id: '1k', 
    label: '1K (标准)', 
    description: '1024px 左右，快速生成',
    promptHint: 'standard resolution'
  },
  { 
    id: '2k', 
    label: '2K (高清)', 
    description: '2048px 左右，高质量',
    promptHint: 'high resolution, 2K, detailed'
  },
  { 
    id: '4k', 
    label: '4K (超高清)', 
    description: '4096px 左右，极致清晰',
    promptHint: 'ultra high resolution, 4K, extremely detailed, sharp'
  },
];

// 预设尺寸列表（按分辨率分组）
export const IMAGE_SIZE_PRESETS: ImageSizePreset[] = [
  // 1K 分辨率
  { id: '1k-square', label: '1K 正方形', width: 1024, height: 1024, description: '标准质量', aspectRatio: '1:1' },
  { id: '1k-landscape', label: '1K 横版', width: 1024, height: 768, description: '标准横版', aspectRatio: '4:3' },
  { id: '1k-portrait', label: '1K 竖版', width: 768, height: 1024, description: '标准竖版', aspectRatio: '3:4' },
  
  // 2K 分辨率
  { id: '2k-square', label: '2K 正方形', width: 2048, height: 2048, description: '高清质量', aspectRatio: '1:1' },
  { id: '2k-landscape', label: '2K 横版', width: 2048, height: 1152, description: '高清横版 16:9', aspectRatio: '16:9' },
  { id: '2k-portrait', label: '2K 竖版', width: 1152, height: 2048, description: '高清竖版 9:16', aspectRatio: '9:16' },
  
  // 4K 分辨率
  { id: '4k-square', label: '4K 正方形', width: 4096, height: 4096, description: '超高清质量', aspectRatio: '1:1' },
  { id: '4k-landscape', label: '4K 横版', width: 4096, height: 2160, description: '超高清横版 16:9', aspectRatio: '16:9' },
  { id: '4k-portrait', label: '4K 竖版', width: 2160, height: 3840, description: '超高清竖版 9:16', aspectRatio: '9:16' },
];

// 根据分辨率档位获取尺寸预设
export function getPresetsByResolution(resolution: string): ImageSizePreset[] {
  return IMAGE_SIZE_PRESETS.filter(preset => preset.id.startsWith(resolution));
}

// 根据尺寸获取分辨率档位
export function getResolutionBySize(width: number): string {
  if (width >= 3000) return '4k';
  if (width >= 1500) return '2k';
  return '1k';
}
