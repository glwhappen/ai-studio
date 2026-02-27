import { NextRequest, NextResponse } from 'next/server';
import { getProviderFromModel, ApiProvider } from '@/types';

interface GenerateRequest {
  prompt: string;
  model: string;
  provider: ApiProvider;
  baseUrl: string;
  apiKey: string;
  // Gemini 参数
  aspectRatio?: string;
  imageSize?: string;
  // OpenAI 参数
  size?: string;
  // 参考图片（图生图）
  referenceImage?: string;
  referenceImageMime?: string;
}

// OpenAI API 响应格式
interface OpenAIImageResponse {
  id: string;
  object: string;
  created: number;
  choices?: Array<{
    index: number;
    message: {
      role: string;
      content: string; // base64
    };
    finish_reason: string;
  }>;
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { 
      prompt, 
      model, 
      provider,
      baseUrl, 
      apiKey,
      aspectRatio,
      imageSize,
      size,
      referenceImage,
      referenceImageMime,
    } = body;

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: '请先配置 API Base URL 和 API Key' },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: '请输入提示词' },
        { status: 400 }
      );
    }

    // 根据提供商选择不同的 API 格式
    if (provider === 'openai') {
      return await handleOpenAIRequest(body);
    } else {
      return await handleGeminiRequest(body);
    }
  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 处理 OpenAI 格式的请求
async function handleOpenAIRequest(body: GenerateRequest) {
  const { prompt, model, baseUrl, apiKey, size, referenceImage, referenceImageMime } = body;
  
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  // 如果有参考图片，使用编辑接口
  const isEdit = referenceImage && referenceImageMime;
  const apiUrl = isEdit 
    ? `${cleanBaseUrl}/v1/images/edits`
    : `${cleanBaseUrl}/v1/images/generations`;

  console.log('Calling OpenAI API:', apiUrl);

  let response: Response;

  if (isEdit) {
    // 使用 multipart/form-data 格式
    const formData = new FormData();
    
    // 将 base64 转换为 Blob
    const imageBuffer = Buffer.from(referenceImage!, 'base64');
    const imageBlob = new Blob([imageBuffer], { type: referenceImageMime! });
    formData.append('image', imageBlob, 'image.png');
    formData.append('prompt', prompt);
    formData.append('model', model);
    formData.append('n', '1');
    if (size && size !== 'auto') {
      formData.append('size', size);
    }

    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });
  } else {
    // 使用 JSON 格式
    const requestBody: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
    };
    
    if (size && size !== 'auto') {
      requestBody.size = size;
    }

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText);
    
    try {
      const errorJson = JSON.parse(errorText);
      return NextResponse.json(
        { error: errorJson.error?.message || errorJson.message || `API 请求失败: ${response.status}` },
        { status: response.status }
      );
    } catch {
      return NextResponse.json(
        { error: `API 请求失败: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }
  }

  const data: OpenAIImageResponse = await response.json();
  console.log('OpenAI API response:', JSON.stringify(data, null, 2));

  // 解析响应
  let imageData = '';
  let mimeType = 'image/png';

  // 新格式：choices[].message.content (base64)
  if (data.choices?.[0]?.message?.content) {
    imageData = data.choices[0].message.content;
  }
  // 旧格式：data[].b64_json
  else if (data.data?.[0]?.b64_json) {
    imageData = data.data[0].b64_json;
  }
  // URL 格式
  else if (data.data?.[0]?.url) {
    // 下载 URL 图片并转为 base64
    const imgResponse = await fetch(data.data[0].url);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    imageData = imgBuffer.toString('base64');
    mimeType = imgResponse.headers.get('content-type') || 'image/png';
  }

  if (!imageData) {
    return NextResponse.json(
      { error: '未生成图片，请重试' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    image: {
      data: imageData,
      mimeType,
    },
    provider: 'openai',
    size,
  });
}

// 处理 Gemini 格式的请求
async function handleGeminiRequest(body: GenerateRequest) {
  const { prompt, model, baseUrl, apiKey, aspectRatio, imageSize, referenceImage, referenceImageMime } = body;

  // 构建 parts 数组
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  
  // 如果有参考图片，先添加图片
  if (referenceImage && referenceImageMime) {
    parts.push({
      inlineData: {
        mimeType: referenceImageMime,
        data: referenceImage,
      },
    });
  }
  
  // 添加文本提示词
  parts.push({
    text: prompt,
  });

  // 构建请求体
  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      responseModalities: ['image', 'text'],
      responseMimeType: 'text/plain',
    },
  };

  // 添加 imageConfig 参数
  if (aspectRatio) {
    const generationConfig = requestBody.generationConfig as Record<string, unknown>;
    generationConfig.imageConfig = {
      aspectRatio: aspectRatio || '1:1',
      imageSize: imageSize || '1K',
    };
  }

  // 构建完整的 API URL
  const apiUrl = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  console.log('Calling Gemini API:', apiUrl);
  console.log('Request body:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    
    try {
      const errorJson = JSON.parse(errorText);
      return NextResponse.json(
        { error: errorJson.error?.message || `API 请求失败: ${response.status}` },
        { status: response.status }
      );
    } catch {
      return NextResponse.json(
        { error: `API 请求失败: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }
  }

  const data = await response.json();
  console.log('Gemini API response:', JSON.stringify(data, null, 2));

  // 解析响应，提取图片数据
  const candidates = data.candidates || [];
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: '未生成任何内容' },
      { status: 500 }
    );
  }

  const parts_response = candidates[0]?.content?.parts || [];
  let imageData = null;
  let textResponse = '';

  for (const part of parts_response) {
    if (part.inlineData) {
      imageData = part.inlineData;
    } else if (part.text) {
      textResponse = part.text;
    }
  }

  if (!imageData) {
    return NextResponse.json(
      { error: '未生成图片，请重试', textResponse },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    image: {
      data: imageData.data,
      mimeType: imageData.mimeType || 'image/png',
    },
    provider: 'gemini',
    aspectRatio,
    imageSize,
  });
}
