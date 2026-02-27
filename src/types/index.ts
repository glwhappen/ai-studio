// API 提供商类型
export type ApiProvider = 'gemini' | 'openai';

// 图片生成结果
export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  projectId: string;
  model: string;
  provider: ApiProvider;
  // Gemini 格式
  aspectRatio?: string;
  imageSize?: string;
  // OpenAI 格式
  size?: string;
  useCustomSize: boolean;
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

// 分辨率档位 (Gemini)
export interface ImageSizeOption {
  id: string;
  label: string;
  value: string;
  description: string;
}

// 宽高比预设 (Gemini)
export interface AspectRatioOption {
  id: string;
  label: string;
  value: string;
  description: string;
}

// OpenAI 尺寸选项
export interface OpenAISizeOption {
  id: string;
  label: string;
  value: string;
  description: string;
}

// API 配置
export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
  // Gemini 参数
  aspectRatio: string;
  imageSize: string;
  // OpenAI 参数
  openaiSize: string;
  useCustomSize: boolean;
}

// 模型信息
export interface ModelInfo {
  name: string;
  displayName: string;
  provider: ApiProvider;
  supportedGenerationMethods?: string[];
}

// 应用状态
export interface AppState {
  apiConfig: ApiConfig;
  projects: Project[];
  images: GeneratedImage[];
  currentProjectId: string | null;
}

// 编辑状态（用于继续编辑图片）
export interface EditImageState {
  prompt: string;
  model: string;
  provider: ApiProvider;
  // Gemini
  aspectRatio?: string;
  imageSize?: string;
  // OpenAI
  size?: string;
  useCustomSize: boolean;
  referenceImageUrl: string;
}

// Gemini 分辨率选项
export const IMAGE_SIZES: ImageSizeOption[] = [
  { id: '1k', label: '1K', value: '1K', description: '标准清晰度' },
  { id: '2k', label: '2K', value: '2K', description: '高清' },
  { id: '4k', label: '4K', value: '4K', description: '超高清' },
];

// Gemini 宽高比选项
export const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: '1:1', label: '正方形', value: '1:1', description: '适合头像、图标' },
  { id: '4:3', label: '横版 4:3', value: '4:3', description: '适合演示文稿' },
  { id: '16:9', label: '横版 16:9', value: '16:9', description: '适合封面、横幅' },
  { id: '3:4', label: '竖版 3:4', value: '3:4', description: '适合海报' },
  { id: '9:16', label: '竖版 9:16', value: '9:16', description: '适合手机壁纸' },
  { id: '3:2', label: '横版 3:2', value: '3:2', description: '适合照片' },
  { id: '2:3', label: '竖版 2:3', value: '2:3', description: '适合社交媒体' },
];

// OpenAI 尺寸选项
export const OPENAI_SIZES: OpenAISizeOption[] = [
  { id: 'auto', label: '自动', value: 'auto', description: '模型自动选择' },
  { id: '1024x1024', label: '正方形', value: '1024x1024', description: '1024×1024' },
  { id: '1536x1024', label: '横版', value: '1536x1024', description: '1536×1024' },
  { id: '1024x1536', label: '竖版', value: '1024x1536', description: '1024×1536' },
];

// 已知的绘图模型（用于识别 API 类型）
export const KNOWN_MODELS: Record<string, ApiProvider> = {
  // Gemini 系列
  'gemini-2.0-flash-exp': 'gemini',
  'gemini-2.0-flash-exp-image-generation': 'gemini',
  'gemini-2.0-flash-preview-image-generation': 'gemini',
  'gemini-2.5-pro-preview-06-05': 'gemini',
  'gemini-exp-1206': 'gemini',
  // OpenAI / GPT Image 系列
  'gpt-image-1': 'openai',
  'gpt-image-1.5': 'openai',
  'gpt-image-1-all': 'openai',
  'dall-e-2': 'openai',
  'dall-e-3': 'openai',
  'flux-kontext-pro': 'openai',
  'flux-kontext-max': 'openai',
};

// 根据模型名判断 API 类型
export function getProviderFromModel(modelName: string): ApiProvider {
  const normalizedName = modelName.toLowerCase().replace(/^models\//, '');
  
  for (const [pattern, provider] of Object.entries(KNOWN_MODELS)) {
    if (normalizedName.includes(pattern.toLowerCase())) {
      return provider;
    }
  }
  
  // 默认使用 OpenAI 格式（更通用）
  return 'openai';
}
