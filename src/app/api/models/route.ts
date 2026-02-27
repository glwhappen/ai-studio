import { NextRequest, NextResponse } from 'next/server';
import { ModelInfo, getProviderFromModel } from '@/types';

interface ModelsRequest {
  baseUrl: string;
  apiKey: string;
}

// Gemini 模型响应格式
interface GeminiModelsResponse {
  models: Array<{
    name: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }>;
}

// OpenAI 模型响应格式
interface OpenAIModelsResponse {
  data: Array<{
    id: string;
    owned_by?: string;
  }>;
}

// 排除关键词
const EXCLUDE_KEYWORDS = [
  'embedding', 'whisper', 'tts', 'speech', 'audio', 'moderation'
];

// 判断是否为图片生成模型
function isImageModel(modelName: string): boolean {
  const name = modelName.toLowerCase();
  
  // 排除不相关的模型
  if (EXCLUDE_KEYWORDS.some(kw => name.includes(kw))) {
    return false;
  }
  
  // Gemini 绘图模型：必须同时包含 "gemini" 和 "image"
  if (name.includes('gemini') && name.includes('image')) {
    return true;
  }
  
  // OpenAI/GPT Image 系列：包含 "gpt-image"
  if (name.includes('gpt-image')) {
    return true;
  }
  
  // DALL-E 系列
  if (name.includes('dall-e') || name.includes('dalle')) {
    return true;
  }
  
  // Flux 系列
  if (name.includes('flux') && name.includes('kontext')) {
    return true;
  }
  
  // Imagen 系列
  if (name.includes('imagen')) {
    return true;
  }
  
  // Stable Diffusion 系列
  if (name.includes('stable-diffusion') || name.includes('sd-')) {
    return true;
  }
  
  // Midjourney 系列
  if (name.includes('midjourney')) {
    return true;
  }
  
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body: ModelsRequest = await request.json();
    const { baseUrl, apiKey } = body;

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: '请先配置 API Base URL 和 API Key' },
        { status: 400 }
      );
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const models: ModelInfo[] = [];

    // 尝试 OpenAI 格式的 models 接口
    try {
      const openaiUrl = `${cleanBaseUrl}/v1/models`;
      console.log('Trying OpenAI models endpoint:', openaiUrl);
      
      const openaiResponse = await fetch(openaiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (openaiResponse.ok) {
        const data: OpenAIModelsResponse = await openaiResponse.json();
        console.log('OpenAI models response:', data.data?.length || 0, 'models');
        
        for (const model of data.data || []) {
          if (isImageModel(model.id)) {
            models.push({
              name: model.id,
              displayName: model.id,
              provider: getProviderFromModel(model.id),
            });
          }
        }
      }
    } catch (error) {
      console.log('OpenAI models endpoint failed:', error);
    }

    // 尝试 Gemini 格式的 models 接口
    try {
      const geminiUrl = `${cleanBaseUrl}/v1beta/models?key=${apiKey}`;
      console.log('Trying Gemini models endpoint:', geminiUrl);
      
      const geminiResponse = await fetch(geminiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (geminiResponse.ok) {
        const data: GeminiModelsResponse = await geminiResponse.json();
        console.log('Gemini models response:', data.models?.length || 0, 'models');
        
        for (const model of data.models || []) {
          const modelName = model.name.replace(/^models\//, '');
          if (isImageModel(modelName)) {
            // 避免重复
            if (!models.find(m => m.name === modelName || m.name === model.name)) {
              models.push({
                name: modelName,
                displayName: model.displayName || modelName,
                provider: getProviderFromModel(modelName),
                supportedGenerationMethods: model.supportedGenerationMethods,
              });
            }
          }
        }
      }
    } catch (error) {
      console.log('Gemini models endpoint failed:', error);
    }

    // 按提供商分组排序
    models.sort((a, b) => {
      if (a.provider === b.provider) {
        return a.displayName.localeCompare(b.displayName);
      }
      return a.provider.localeCompare(b.provider);
    });

    console.log('Total models found:', models.length);

    return NextResponse.json({
      success: true,
      models,
    });
  } catch (error) {
    console.error('Models API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}
