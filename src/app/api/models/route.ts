import { NextRequest, NextResponse } from 'next/server';

// 判断是否为图片生成模型
function isImageModel(modelId: string, provider?: string): boolean {
  const lowerId = modelId.toLowerCase();
  
  if (provider === 'gemini') {
    // Gemini: 包含 imagen，或者同时包含 gemini 和 image
    const hasImagen = lowerId.includes('imagen');
    const hasGemini = lowerId.includes('gemini');
    const hasImage = lowerId.includes('image');
    return hasImagen || (hasGemini && hasImage);
  } else {
    // OpenAI: 只显示 gpt-image 和 dall-e 模型
    return lowerId.includes('gpt-image') || lowerId.includes('dall-e') || lowerId.includes('dalle');
  }
}

// 从 API 获取模型列表
async function fetchModels(baseUrl: string, apiKey: string, provider?: string): Promise<{ id: string }[]> {
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
    const allModels = data.data || [];
    
    // 过滤出图片生成模型
    const imageModels = allModels
      .filter((model: { id: string }) => isImageModel(model.id, provider))
      .map((model: { id: string }) => ({ id: model.id }));
    
    return imageModels;
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const baseUrl = searchParams.get('baseUrl') || 'https://ai.nflow.red';
  const apiKey = searchParams.get('apiKey') || process.env.OPENAI_API_KEY || 'sk-V7ZFfhmndbAQXklSz2IC7gV68WGggGC5nxnlv0cXRq6ob3DN';
  const provider = searchParams.get('provider') || undefined;
  
  // 获取模型列表
  const models = await fetchModels(baseUrl, apiKey, provider);
  
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
    
    // 获取模型列表（已过滤）
    const modelIds = await fetchModels(baseUrl, apiKey, provider);
    
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
