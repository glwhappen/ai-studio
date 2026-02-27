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

// 关键词过滤：只保留绘图相关模型
const IMAGE_MODEL_KEYWORDS = [
  'gemini', 'gpt-image', 'dall-e', 'flux', 'imagen', 'stable-diffusion',
  'midjourney', 'image', 'draw', 'paint', 'art', 'kontext'
];

// 排除关键词
const EXCLUDE_KEYWORDS = [
  'embedding', 'whisper', 'tts', 'speech', 'audio', 'moderation'
];

function isImageModel(modelName: string): boolean {
  const name = modelName.toLowerCase();
  
  // 排除不相关的模型
  if (EXCLUDE_KEYWORDS.some(kw => name.includes(kw))) {
    return false;
  }
  
  // 包含关键词
  return IMAGE_MODEL_KEYWORDS.some(kw => name.includes(kw));
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
