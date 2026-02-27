import { NextRequest, NextResponse } from 'next/server';

interface GenerateRequest {
  prompt: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  baseUrl: string;
  apiKey: string;
  referenceImage?: string; // base64 编码的参考图片
  referenceImageMime?: string; // 图片 MIME 类型
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { 
      prompt, 
      model, 
      aspectRatio, 
      imageSize, 
      baseUrl, 
      apiKey,
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
    const generationConfig = requestBody.generationConfig as Record<string, unknown>;
    generationConfig.imageConfig = {
      aspectRatio: aspectRatio || '1:1',
      imageSize: imageSize || '1K',
    };

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

    // 返回 base64 图片数据
    return NextResponse.json({
      success: true,
      image: {
        data: imageData.data,
        mimeType: imageData.mimeType || 'image/png',
      },
      textResponse,
      aspectRatio,
      imageSize,
    });
  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}
