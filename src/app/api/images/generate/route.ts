import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { ApiProvider } from '@/types';

interface GenerateRequest {
  userId: string;
  prompt: string;
  model: string;
  provider: ApiProvider;
  baseUrl: string;
  apiKey: string;
  aspectRatio?: string;
  imageSize?: string;
  size?: string;
}

// 创建图片记录并启动生成任务
export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { userId, prompt, model, provider, baseUrl, apiKey, aspectRatio, imageSize, size } = body;
    
    if (!userId || !prompt || !model || !provider || !baseUrl || !apiKey) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    // 创建图片记录（pending 状态）
    const { data: imageRecord, error: insertError } = await client
      .from('images')
      .insert({
        user_id: userId,
        prompt,
        model,
        provider,
        status: 'pending',
        config: {
          aspectRatio,
          imageSize,
          size,
        },
      })
      .select('id')
      .single();
    
    if (insertError || !imageRecord) {
      throw insertError || new Error('创建记录失败');
    }
    
    const imageId = imageRecord.id;
    
    // 启动后台生成任务（不等待结果）
    generateImageAsync(imageId, {
      prompt, model, provider, baseUrl, apiKey, aspectRatio, imageSize, size
    }).catch(error => {
      console.error('Background generation error:', error);
    });
    
    return NextResponse.json({ success: true, imageId });
  } catch (error) {
    console.error('Submit generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提交失败' },
      { status: 500 }
    );
  }
}

// 后台生成图片
async function generateImageAsync(
  imageId: string,
  params: {
    prompt: string;
    model: string;
    provider: ApiProvider;
    baseUrl: string;
    apiKey: string;
    aspectRatio?: string;
    imageSize?: string;
    size?: string;
  }
) {
  const client = getSupabaseClient();
  
  try {
    // 更新状态为 processing
    await client
      .from('images')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', imageId);
    
    // 根据提供商调用不同的生成 API
    const { prompt, model, provider, baseUrl, apiKey, aspectRatio, imageSize, size } = params;
    
    let imageUrl: string | null = null;
    
    if (provider === 'openai') {
      imageUrl = await callOpenAI({ prompt, model, baseUrl, apiKey, size });
    } else {
      imageUrl = await callGemini({ prompt, model, baseUrl, apiKey, aspectRatio, imageSize });
    }
    
    if (imageUrl) {
      // 更新状态为 completed
      await client
        .from('images')
        .update({
          status: 'completed',
          image_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', imageId);
    } else {
      throw new Error('未生成图片');
    }
  } catch (error) {
    console.error('Generation failed:', error);
    
    // 更新状态为 failed
    await client
      .from('images')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : '生成失败',
        updated_at: new Date().toISOString(),
      })
      .eq('id', imageId);
  }
}

// 调用 OpenAI 格式的 API
async function callOpenAI(params: {
  prompt: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  size?: string;
}): Promise<string | null> {
  const { prompt, model, baseUrl, apiKey, size } = params;
  
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const apiUrl = `${cleanBaseUrl}/v1/images/generations`;
  
  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
  };
  
  if (size && size !== 'auto') {
    requestBody.size = size;
  }
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  // 解析响应
  let imageData = '';
  
  // 新格式：choices[].message.content (base64)
  if (data.choices?.[0]?.message?.content) {
    imageData = data.choices[0].message.content;
    return `data:image/png;base64,${imageData}`;
  }
  // 旧格式：data[].b64_json
  if (data.data?.[0]?.b64_json) {
    imageData = data.data[0].b64_json;
    return `data:image/png;base64,${imageData}`;
  }
  // URL 格式
  if (data.data?.[0]?.url) {
    // 下载 URL 图片并转为 base64
    const imgResponse = await fetch(data.data[0].url);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    const base64 = imgBuffer.toString('base64');
    const mimeType = imgResponse.headers.get('content-type') || 'image/png';
    return `data:${mimeType};base64,${base64}`;
  }
  
  return null;
}

// 调用 Gemini 格式的 API
async function callGemini(params: {
  prompt: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  aspectRatio?: string;
  imageSize?: string;
}): Promise<string | null> {
  const { prompt, model, baseUrl, apiKey, aspectRatio, imageSize } = params;
  
  const parts: Array<{ text?: string }> = [{ text: prompt }];
  
  const requestBody: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['image', 'text'],
      responseMimeType: 'text/plain',
    },
  };
  
  if (aspectRatio) {
    (requestBody.generationConfig as Record<string, unknown>).imageConfig = {
      aspectRatio: aspectRatio || '1:1',
      imageSize: imageSize || '1K',
    };
  }
  
  const apiUrl = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  const candidates = data.candidates || [];
  
  if (candidates.length === 0) {
    throw new Error('未生成任何内容');
  }
  
  const parts_response = candidates[0]?.content?.parts || [];
  
  for (const part of parts_response) {
    if (part.inlineData) {
      const mimeType = part.inlineData.mimeType || 'image/png';
      return `data:${mimeType};base64,${part.inlineData.data}`;
    }
  }
  
  return null;
}
