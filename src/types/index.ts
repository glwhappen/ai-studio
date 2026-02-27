// 图片生成结果
export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  projectId: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  useCustomSize: boolean;
  createdAt: string;
}

// 编辑状态（用于继续编辑图片）
export interface EditImageState {
  prompt: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  useCustomSize: boolean;
  referenceImageUrl: string; // 作为参考图的图片 URL
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
export interface ImageSizeOption {
  id: string;
  label: string;
  value: string;
  description: string;
}

// 宽高比预设
export interface AspectRatioOption {
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
  aspectRatio: string;
  imageSize: string;
  useCustomSize: boolean; // 是否启用自定义尺寸
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

// 分辨率选项
export const IMAGE_SIZES: ImageSizeOption[] = [
  { id: '1k', label: '1K', value: '1K', description: '标准清晰度' },
  { id: '2k', label: '2K', value: '2K', description: '高清' },
  { id: '4k', label: '4K', value: '4K', description: '超高清' },
];

// 宽高比选项
export const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: '1:1', label: '正方形', value: '1:1', description: '适合头像、图标' },
  { id: '4:3', label: '横版 4:3', value: '4:3', description: '适合演示文稿' },
  { id: '16:9', label: '横版 16:9', value: '16:9', description: '适合封面、横幅' },
  { id: '3:4', label: '竖版 3:4', value: '3:4', description: '适合海报' },
  { id: '9:16', label: '竖版 9:16', value: '9:16', description: '适合手机壁纸' },
  { id: '3:2', label: '横版 3:2', value: '3:2', description: '适合照片' },
  { id: '2:3', label: '竖版 2:3', value: '2:3', description: '适合社交媒体' },
];
