import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getImageUrl, isBase64DataUrl, uploadBase64Image } from '@/lib/storage';

// 获取公开作品集
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    const client = getSupabaseClient();
    
    // 获取公开且已完成的图片
    const { data, error } = await client
      .from('images')
      .select('id, prompt, model, provider, image_url, is_public, created_at, config')
      .eq('is_public', true)
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw error;
    }
    
    // 获取总数
    const { count, error: countError } = await client
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true)
      .eq('status', 'completed')
      .not('image_url', 'is', null);
    
    if (countError) {
      throw countError;
    }
    
    // 处理图片 URL（自动迁移 base64 到对象存储）
    const images = await Promise.all((data || []).map(async (img) => {
      let imageUrl = img.image_url;
      let proxyUrl: string | undefined;
      
      // 如果是 base64，上传到对象存储并更新数据库
      if (imageUrl && isBase64DataUrl(imageUrl)) {
        try {
          const key = await uploadBase64Image(imageUrl, `${img.id}.png`);
          // 更新数据库
          await client
            .from('images')
            .update({ image_url: key })
            .eq('id', img.id);
          // 生成签名 URL
          const signedUrl = await getImageUrl(key);
          // 创建代理 URL（解决跨域问题）
          proxyUrl = `/api/image-proxy?url=${encodeURIComponent(signedUrl)}`;
          imageUrl = signedUrl;
          console.log(`Migrated image ${img.id} to object storage`);
        } catch (e) {
          console.error('Failed to migrate image to storage:', img.id, e);
          // 迁移失败时返回原始 base64
        }
      }
      // 如果是对象存储 key，生成签名 URL
      else if (imageUrl && !imageUrl.startsWith('http')) {
        try {
          const signedUrl = await getImageUrl(imageUrl);
          // 创建代理 URL（解决跨域问题）
          proxyUrl = `/api/image-proxy?url=${encodeURIComponent(signedUrl)}`;
          imageUrl = signedUrl;
        } catch (e) {
          console.error('Failed to generate signed URL:', imageUrl, e);
        }
      }
      // 如果已经是完整的 URL（签名 URL），创建代理 URL
      else if (imageUrl && imageUrl.startsWith('http')) {
        proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      }
      
      return {
        ...img,
        image_url: proxyUrl || imageUrl, // 优先使用代理 URL
        original_url: imageUrl, // 保留原始 URL 供下载使用
      };
    }));
    
    return NextResponse.json({
      success: true,
      images,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Get gallery error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取作品集失败' },
      { status: 500 }
    );
  }
}
