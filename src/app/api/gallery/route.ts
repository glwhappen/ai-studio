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
    const userToken = searchParams.get('userToken') || null;
    const sortBy = searchParams.get('sort') || 'latest'; // latest, popular, likes
    
    const client = getSupabaseClient();
    
    // 构建排序
    let orderBy = 'created_at';
    let orderAscending = false;
    
    switch (sortBy) {
      case 'popular': // 按浏览量排序
        orderBy = 'view_count';
        break;
      case 'likes': // 按点赞数排序
        orderBy = 'like_count';
        break;
      case 'latest':
      default:
        orderBy = 'created_at';
        break;
    }
    
    // 获取公开且已完成的图片
    const { data, error } = await client
      .from('images')
      .select('id, prompt, model, provider, image_url, is_public, created_at, config, view_count, like_count, create_count')
      .eq('is_public', true)
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .order(orderBy, { ascending: orderAscending })
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
    
    // 获取用户交互状态（如果有 userToken）
    let userInteractions: Record<string, { has_liked: boolean; has_disliked: boolean }> = {};
    if (userToken && data && data.length > 0) {
      const imageIds = data.map(img => img.id);
      const { data: interactions } = await client
        .from('image_interactions')
        .select('image_id, has_liked, has_disliked')
        .eq('user_token', userToken)
        .in('image_id', imageIds);
      
      if (interactions) {
        interactions.forEach(i => {
          userInteractions[i.image_id] = {
            has_liked: i.has_liked,
            has_disliked: i.has_disliked,
          };
        });
      }
    }
    
    // 处理图片 URL（自动迁移 base64 到对象存储）
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
      const stableUrl = `/api/images/${img.id}/file`;
      
      return {
        ...img,
        image_url: stableUrl, // 稳定的 URL，浏览器可缓存
        original_url: signedUrl || imageUrl, // 原始签名 URL，用于下载
        // 统计数据
        stats: {
          views: img.view_count || 0,
          likes: img.like_count || 0,
          creates: img.create_count || 0,
        },
        // 用户交互状态
        userInteraction: userInteractions[img.id] || {
          has_liked: false,
          has_disliked: false,
        },
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
