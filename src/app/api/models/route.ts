import { NextRequest, NextResponse } from 'next/server';

// 模型缓存
let modelsCache: { id: string }[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1小时缓存

// 从 API 获取模型列表
async function fetchModels(baseUrl: string, apiKey: string): Promise<{ id: string }[]> {
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      console.error('Failed to fetch models:', response.status);
      return [];
    }
    
    const data = await response.json();
    const models = data.data || [];
    
    // 返回所有模型，不做过滤
    return models.map((model: { id: string }) => ({
      id: model.id,
    }));
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
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

// POST 方法支持（用于传递敏感参数如 apiKey）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl, apiKey, provider } = body;
    
    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    // 获取模型列表
    const modelIds = await fetchModels(baseUrl, apiKey);
    
    // 转换为前端需要的格式
    const models = modelIds.map(m => ({
      name: m.id,
      displayName: m.id.split('/').pop() || m.id,
      provider: provider || 'openai',
    }));
    
    return NextResponse.json({ 
      success: true, 
      models,
    });
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取模型列表失败' },
      { status: 500 }
    );
  }
}
