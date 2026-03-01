import { NextRequest, NextResponse } from 'next/server';

// 模型缓存
let modelsCache: { id: string; name: string; description: string }[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1小时缓存

// 默认模型列表（作为后备）
const DEFAULT_MODELS = [
  { id: 'gpt-5', name: 'GPT-5', description: '最新旗舰' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '快速经济' },
  { id: 'gpt-4o', name: 'GPT-4o', description: '智能均衡' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '经典增强' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '轻量快速' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: '最新Claude' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: '快速响应' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '国产智能' },
  { id: 'doubao-seed-1-6-flash-250615', name: '豆包 Flash', description: '国产快速' },
];

// 从 API 获取模型列表
async function fetchModels(baseUrl: string, apiKey: string): Promise<{ id: string; name: string; description: string }[]> {
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      console.error('Failed to fetch models:', response.status);
      return DEFAULT_MODELS;
    }
    
    const data = await response.json();
    const models = data.data || [];
    
    // 过滤出聊天模型（排除 embedding、image 等专用模型）
    const chatModels = models
      .filter((model: { id: string }) => {
        const id = model.id.toLowerCase();
        // 排除明显不是聊天模型的
        if (id.includes('embedding') || id.includes('whisper') || id.includes('tts') || id.includes('dall-e')) {
          return false;
        }
        // 包含 gpt、claude、deepseek、doubao 等聊天模型
        if (id.includes('gpt') || id.includes('claude') || id.includes('deepseek') || id.includes('doubao')) {
          return true;
        }
        return true; // 默认保留
      })
      .map((model: { id: string }) => ({
        id: model.id,
        name: formatModelName(model.id),
        description: '',
      }));
    
    // 如果获取到的模型太少，使用默认列表
    if (chatModels.length < 3) {
      return DEFAULT_MODELS;
    }
    
    // 按 id 排序，gpt-5 优先，然后 gpt-4，再其他
    chatModels.sort((a: { id: string }, b: { id: string }) => {
      const aId = a.id.toLowerCase();
      const bId = b.id.toLowerCase();
      
      // gpt-5 最优先
      if (aId.includes('gpt-5') && !bId.includes('gpt-5')) return -1;
      if (!aId.includes('gpt-5') && bId.includes('gpt-5')) return 1;
      // gpt-4 次优先
      if (aId.includes('gpt-4') && !bId.includes('gpt-4')) return -1;
      if (!aId.includes('gpt-4') && bId.includes('gpt-4')) return 1;
      // 其他按字母排序
      return aId.localeCompare(bId);
    });
    
    return chatModels.slice(0, 20); // 最多返回 20 个
  } catch (error) {
    console.error('Error fetching models:', error);
    return DEFAULT_MODELS;
  }
}

// 格式化模型名称
function formatModelName(id: string): string {
  // 常见模型名称映射
  const nameMap: Record<string, string> = {
    'gpt-5.2': 'GPT-5.2',
    'gpt-5': 'GPT-5',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4o': 'GPT-4o',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4': 'GPT-4',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
    'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
    'claude-3-haiku-20240307': 'Claude 3 Haiku',
    'claude-3-opus-20240229': 'Claude 3 Opus',
    'deepseek-chat': 'DeepSeek Chat',
    'deepseek-coder': 'DeepSeek Coder',
    'doubao-seed-1-6-flash-250615': '豆包 Flash',
  };
  
  if (nameMap[id]) {
    return nameMap[id];
  }
  
  // 通用格式化：提取主要部分
  const parts = id.split('-');
  const brand = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  if (parts.length === 1) return brand;
  
  const version = parts.slice(1).join('-');
  return `${brand} ${version}`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const baseUrl = searchParams.get('baseUrl') || 'https://ai.nflow.red';
  const apiKey = searchParams.get('apiKey') || process.env.OPENAI_API_KEY || 'sk-V7ZFfhmndbAQXklSz2IC7gV68WGggGC5nxnlv0cXRq6ob3DN';
  
  // 检查缓存
  const now = Date.now();
  if (modelsCache && (now - cacheTime) < CACHE_DURATION) {
    return NextResponse.json({ models: modelsCache, cached: true });
  }
  
  // 获取模型列表
  const models = await fetchModels(baseUrl, apiKey);
  
  // 更新缓存
  modelsCache = models;
  cacheTime = now;
  
  return NextResponse.json({ models, cached: false });
}
