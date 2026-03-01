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
    const sortBy = searchParams.get('sort') || 'random'; // latest, popular, likes, random
    
    const client = getSupabaseClient();
    
    // 构建排序
    let orderBy = 'created_at';
    let orderAscending = false;
    let useRandom = false;
    
    switch (sortBy) {
      case 'popular': // 按浏览量排序
        orderBy = 'view_count';
        break;
      case 'likes': // 按点赞数排序
        orderBy = 'like_count';
        break;
      case 'random': // 随机排序
        useRandom = true;
        break;
      case 'latest':
      default:
        orderBy = 'created_at';
        break;
    }
    
    // 构建查询
    let query = client
      .from('images')
      .select('id, prompt, model, provider, image_url, is_public, created_at, config, view_count, like_count, create_count')
      .eq('is_public', true)
      .eq('status', 'completed')
      .not('image_url', 'is', null);
    
    if (useRandom) {
      // 使用 rpc 调用随机排序函数（需要在数据库中创建函数）
      // 或者使用原始 SQL
      const { data, error } = await client.rpc('get_random_images', {
        p_limit: limit,
        p_offset: offset,
      });
      
      if (error) {
        // 如果函数不存在，回退到普通查询
        console.log('Random function not found, using fallback');
        const fallbackQuery = client
          .from('images')
          .select('id, prompt, model, provider, image_url, is_public, created_at, config, view_count, like_count, create_count')
          .eq('is_public', true)
          .eq('status', 'completed')
          .not('image_url', 'is', null)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        
        if (fallbackError) throw fallbackError;
        
        // 处理回退数据
        return await processImages(fallbackData || [], client, userToken, page, limit);
      }
      
      // 处理随机查询结果
      return await processImages(data || [], client, userToken, page, limit);
    } else {
      query = query.order(orderBy, { ascending: orderAscending }).range(offset, offset + limit - 1);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return await processImages(data || [], client, userToken, page, limit);
  } catch (error) {
    console.error('Get gallery error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取作品集失败' },
      { status: 500 }
    );
  }
}

// 处理图片数据
async function processImages(
  data: Array<{
    id: string;
    prompt: string;
    model: string;
    provider: string;
    image_url: string | null;
    is_public: boolean;
    created_at: string;
    config: Record<string, unknown> | null;
    view_count: number | null;
    like_count: number | null;
    create_count: number | null;
  }>,
  client: ReturnType<typeof getSupabaseClient>,
  userToken: string | null,
  page: number,
  limit: number
) {
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
}
