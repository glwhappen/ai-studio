import { NextRequest, NextResponse } from 'next/server';

interface ModelsRequest {
  baseUrl: string;
  apiKey: string;
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

    // 构建 API URL
    const apiUrl = `${baseUrl.replace(/\/$/, '')}/v1beta/models?key=${apiKey}`;

    console.log('Fetching models from:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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
    
    // 过滤支持图片生成的模型
    const imageModels = (data.models || [])
      .filter((model: { supportedGenerationMethods?: string[] }) => 
        model.supportedGenerationMethods?.includes('generateContent')
      )
      .map((model: { name: string; displayName?: string; supportedGenerationMethods?: string[] }) => ({
        name: model.name,
        displayName: model.displayName || model.name.split('/').pop(),
        supportedGenerationMethods: model.supportedGenerationMethods,
      }));

    return NextResponse.json({
      success: true,
      models: imageModels,
    });
  } catch (error) {
    console.error('Models API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}
