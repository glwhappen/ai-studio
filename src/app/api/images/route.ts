import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getImageUrl, isBase64DataUrl, uploadBase64Image } from '@/lib/storage';

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
    
    // 转换字段名，并处理图片 URL（自动迁移 base64 到对象存储）
    const images = await Promise.all((data || []).map(async (img) => {
      let imageUrl = img.image_url;
      let signedUrl: string | undefined;
      
      // 如果是 base64，上传到对象存储并更新数据库
      if (imageUrl && isBase64DataUrl(imageUrl)) {
        try {
          const key = await uploadBase64Image(imageUrl, `${img.id}.png`);
          await client
            .from('images')
            .update({ image_url: key })
            .eq('id', img.id);
          imageUrl = key;
          signedUrl = await getImageUrl(key);
        } catch (e) {
          console.error('Failed to migrate image to storage:', img.id, e);
        }
      }
      // 如果是对象存储 key，获取签名 URL（用于下载）
      else if (imageUrl && !imageUrl.startsWith('http')) {
        try {
          signedUrl = await getImageUrl(imageUrl);
        } catch (e) {
          console.error('Failed to generate signed URL:', imageUrl, e);
        }
      }
      else if (imageUrl && imageUrl.startsWith('http')) {
        signedUrl = imageUrl;
      }
      
      // 使用稳定的图片 API URL（便于浏览器缓存）
      const stableUrl = img.status === 'completed' && img.image_url 
        ? `/api/images/${img.id}/file` 
        : undefined;
      
      return {
        id: img.id,
        user_id: img.user_id,
        prompt: img.prompt,
        model: img.model,
        provider: img.provider,
        status: img.status,
        image_url: stableUrl, // 稳定的 URL，浏览器可缓存
        original_url: signedUrl || imageUrl, // 原始签名 URL，用于下载
        thumbnail_url: img.thumbnail_url ? `/api/images/${img.id}/thumbnail` : undefined,
        width: img.width,
        height: img.height,
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
