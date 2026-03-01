import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { uploadBase64Image, isBase64DataUrl, getImageUrl, generateAndUploadThumbnail, getImageDimensions } from '@/lib/storage';
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
  // 参考图片（图生图）
  referenceImage?: string;
  referenceImageMime?: string;
  // 是否公开
  isPublic?: boolean;
}

// 创建图片记录并启动生成任务
export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { 
      userId, prompt, model, provider, baseUrl, apiKey, 
      aspectRatio, imageSize, size,
      referenceImage, referenceImageMime,
      isPublic
    } = body;
    
    if (!userId || !prompt || !model || !provider || !baseUrl || !apiKey) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    // 如果有参考图片，先上传到对象存储
    let referenceImageUrl: string | undefined;
    if (referenceImage && referenceImageMime) {
      try {
        // 构建 base64 data URL
        const base64DataUrl = `data:${referenceImageMime};base64,${referenceImage}`;
        const key = await uploadBase64Image(base64DataUrl, `reference/${Date.now()}.png`);
        referenceImageUrl = await getImageUrl(key);
      } catch (uploadError) {
        console.error('Failed to upload reference image:', uploadError);
        // 上传失败时继续，但不存储参考图 URL
      }
    }
    
    // 创建图片记录（pending 状态）
    const { data: imageRecord, error: insertError } = await client
      .from('images')
      .insert({
        user_id: userId,
        prompt,
        model,
        provider,
        status: 'pending',
        is_public: isPublic ?? true, // 默认公开
        config: {
          aspectRatio,
          imageSize,
          size,
          hasReferenceImage: !!referenceImage,
          referenceImageUrl, // 存储参考图 URL
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
      prompt, model, provider, baseUrl, apiKey, aspectRatio, imageSize, size,
      referenceImage, referenceImageMime
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
    referenceImage?: string;
    referenceImageMime?: string;
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
    const { prompt, model, provider, baseUrl, apiKey, aspectRatio, imageSize, size, referenceImage, referenceImageMime } = params;
    
    let imageUrl: string | null = null;
    
    if (provider === 'openai') {
      imageUrl = await callOpenAI({ prompt, model, baseUrl, apiKey, size, referenceImage, referenceImageMime });
    } else {
      imageUrl = await callGemini({ prompt, model, baseUrl, apiKey, aspectRatio, imageSize, referenceImage, referenceImageMime });
    }
    
    if (imageUrl) {
      // 如果是 base64 data URL，上传到对象存储
      let storedUrl = imageUrl;
      let thumbnailUrl: string | undefined;
      let width: number | undefined;
      let height: number | undefined;
      
      if (isBase64DataUrl(imageUrl)) {
        try {
          // 获取图片尺寸
          try {
            const dimensions = await getImageDimensions(imageUrl);
            width = dimensions.width;
            height = dimensions.height;
          } catch (dimError) {
            console.error('Failed to get image dimensions:', dimError);
          }
          
          // 上传原图
          const key = await uploadBase64Image(imageUrl, `${imageId}.png`);
          storedUrl = key; // 存储对象存储的 key
          
          // 生成并上传缩略图
          try {
            const thumbnailKey = await generateAndUploadThumbnail(imageUrl, `${imageId}.jpg`);
            thumbnailUrl = thumbnailKey;
          } catch (thumbnailError) {
            console.error('Failed to generate thumbnail:', thumbnailError);
            // 缩略图生成失败不影响主流程
          }
        } catch (uploadError) {
          console.error('Failed to upload image to storage:', uploadError);
          // 上传失败时仍然保存 base64（兜底）
        }
      }
      
      // 更新状态为 completed
      await client
        .from('images')
        .update({
          status: 'completed',
          image_url: storedUrl,
          thumbnail_url: thumbnailUrl,
          width,
          height,
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
  referenceImage?: string;
  referenceImageMime?: string;
}): Promise<string | null> {
  const { prompt, model, baseUrl, apiKey, size, referenceImage, referenceImageMime } = params;
  
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  // 如果有参考图片，使用编辑接口（图生图）
  const isEdit = referenceImage && referenceImageMime;
  const apiUrl = isEdit 
    ? `${cleanBaseUrl}/v1/images/edits`
    : `${cleanBaseUrl}/v1/images/generations`;

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
  referenceImage?: string;
  referenceImageMime?: string;
}): Promise<string | null> {
  const { prompt, model, baseUrl, apiKey, aspectRatio, imageSize, referenceImage, referenceImageMime } = params;
  
  // Gemini 支持在 parts 中添加图片
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
  parts.push({ text: prompt });
  
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
