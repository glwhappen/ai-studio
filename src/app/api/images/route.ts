import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getImageUrl, isBase64DataUrl } from '@/lib/storage';

// 获取用户的图片列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: '缺少 userId' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('images')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    // 转换字段名（snake_case -> camelCase），并生成签名 URL
    const images = await Promise.all((data || []).map(async (img) => {
      let imageUrl = img.image_url;
      
      // 如果 image_url 不是 base64（即对象存储 key），生成签名 URL
      if (imageUrl && !isBase64DataUrl(imageUrl) && !imageUrl.startsWith('http')) {
        try {
          imageUrl = await getImageUrl(imageUrl);
        } catch (e) {
          console.error('Failed to generate signed URL for:', imageUrl, e);
          // 保留原始值
        }
      }
      
      return {
        id: img.id,
        user_id: img.user_id,
        prompt: img.prompt,
        model: img.model,
        provider: img.provider,
        status: img.status,
        image_url: imageUrl,
        image_key: img.image_url !== imageUrl ? img.image_url : undefined, // 返回 key 供前端使用
        error_message: img.error_message,
        is_public: img.is_public,
        config: img.config,
        created_at: img.created_at,
        updated_at: img.updated_at,
      };
    }));
    
    return NextResponse.json({ success: true, images });
  } catch (error) {
    console.error('Get images error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取图片列表失败' },
      { status: 500 }
    );
  }
}
