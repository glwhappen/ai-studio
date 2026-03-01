import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getImageUrl, isBase64DataUrl, uploadBase64Image } from '@/lib/storage';

// Fisher-Yates 洗牌算法
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 加权随机选择（点赞多概率高，点踩多概率低）
function weightedRandomSelect<T extends { id: string; like_count: number | null; dislike_count?: number | null }>(
  items: T[],
  count: number
): T[] {
  if (items.length <= count) return items;
  
  // 计算每项的权重
  // 基础权重 = 1
  // 点赞权重 = like_count * 0.1（每个点赞增加 10% 权重）
  // 点踩权重 = dislike_count * 0.5（每个点踩减少 50% 权重）
  // 最小权重 = 0.1（保证有点踩的图片仍有机会被选中）
  const weights = items.map(item => {
    const baseWeight = 1;
    const likeBonus = (item.like_count || 0) * 0.1;
    const dislikePenalty = (item.dislike_count || 0) * 0.5;
    return Math.max(0.1, baseWeight + likeBonus - dislikePenalty);
  });
  
  // 计算总权重
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  
  // 加权随机选择（不放回）
  const selected: T[] = [];
  const remaining = [...items];
  const remainingWeights = [...weights];
  
  while (selected.length < count && remaining.length > 0) {
    // 计算剩余项的总权重
    const currentTotal = remainingWeights.reduce((sum, w) => sum + w, 0);
    
    // 生成随机数
    let random = Math.random() * currentTotal;
    
    // 找到对应的项
    for (let i = 0; i < remaining.length; i++) {
      random -= remainingWeights[i];
      if (random <= 0) {
        selected.push(remaining[i]);
        remaining.splice(i, 1);
        remainingWeights.splice(i, 1);
        break;
      }
    }
  }
  
  return selected;
}

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
    
    // 随机排序：使用加权随机（点赞多概率高，点踩多概率低）
    if (useRandom) {
      // 解析要排除的图片ID
      const excludeIdsParam = searchParams.get('excludeIds');
      const excludeIds = excludeIdsParam ? new Set(excludeIdsParam.split(',')) : new Set<string>();
      
      // 获取总数
      const { count } = await client
        .from('images')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true)
        .eq('status', 'completed')
        .not('image_url', 'is', null);
      
      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);
      
      // 获取图片及其点赞/点踩数
      // 为了性能，如果总数太大，只获取一个较大的子集
      const fetchLimit = Math.min(totalCount, 500);
      
      // 获取图片数据（包含点赞数和尺寸）
      // 先尝试查询包含 width/height 列的数据，如果列不存在则回退
      let allImages = null;
      let queryError = null;
      
      // 尝试查询包含尺寸信息
      const { data: dataWithDims, error: errorWithDims } = await client
        .from('images')
        .select('id, prompt, model, provider, image_url, thumbnail_url, is_public, created_at, config, view_count, like_count, create_count, dislike_count, width, height')
        .eq('is_public', true)
        .eq('status', 'completed')
        .not('image_url', 'is', null)
        .limit(fetchLimit);
      
      if (errorWithDims && errorWithDims.code === '42703') {
        // 列不存在，回退到不查询 width/height
        console.log('width/height columns not exist, falling back to basic query');
        const { data: dataBasic, error: errorBasic } = await client
          .from('images')
          .select('id, prompt, model, provider, image_url, thumbnail_url, is_public, created_at, config, view_count, like_count, create_count, dislike_count')
          .eq('is_public', true)
          .eq('status', 'completed')
          .not('image_url', 'is', null)
          .limit(fetchLimit);
        
        allImages = dataBasic;
        queryError = errorBasic;
      } else {
        allImages = dataWithDims;
        queryError = errorWithDims;
      }
      
      if (queryError) throw queryError;
      
      // 过滤掉已排除的图片
      const availableImages = (allImages || []).filter(img => !excludeIds.has(img.id));
      
      // 使用加权随机选择
      const selectedImages = weightedRandomSelect(availableImages, limit);
      
      // 处理图片数据
      const images = await processImageData(selectedImages, client, userToken);
      
      return NextResponse.json({
        success: true,
        images,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
        },
      });
    }
    
    // 非随机排序：正常查询
    // 先尝试查询包含 width/height 列的数据，如果列不存在则回退
    let data = null;
    let error = null;
    
    const { data: dataWithDims, error: errorWithDims } = await client
      .from('images')
      .select('id, prompt, model, provider, image_url, thumbnail_url, is_public, created_at, config, view_count, like_count, create_count, dislike_count, width, height')
      .eq('is_public', true)
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .order(orderBy, { ascending: orderAscending })
      .range(offset, offset + limit - 1);
    
    if (errorWithDims && errorWithDims.code === '42703') {
      // 列不存在，回退到不查询 width/height
      console.log('width/height columns not exist, falling back to basic query');
      const { data: dataBasic, error: errorBasic } = await client
        .from('images')
        .select('id, prompt, model, provider, image_url, thumbnail_url, is_public, created_at, config, view_count, like_count, create_count, dislike_count')
        .eq('is_public', true)
        .eq('status', 'completed')
        .not('image_url', 'is', null)
        .order(orderBy, { ascending: orderAscending })
        .range(offset, offset + limit - 1);
      
      data = dataBasic;
      error = errorBasic;
    } else {
      data = dataWithDims;
      error = errorWithDims;
    }
    
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

// 处理图片数据（返回完整响应）
async function processImages(
  data: Array<{
    id: string;
    prompt: string;
    model: string;
    provider: string;
    image_url: string | null;
    thumbnail_url: string | null;
    is_public: boolean;
    created_at: string;
    config: Record<string, unknown> | null;
    view_count: number | null;
    like_count: number | null;
    create_count: number | null;
    dislike_count: number | null;
    width?: number | null;
    height?: number | null;
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
  
  const images = await processImageData(data, client, userToken);
  
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

// 处理图片数据（仅处理数据，不返回响应）
async function processImageData(
  data: Array<{
    id: string;
    prompt: string;
    model: string;
    provider: string;
    image_url: string | null;
    thumbnail_url: string | null;
    is_public: boolean;
    created_at: string;
    config: Record<string, unknown> | null;
    view_count: number | null;
    like_count: number | null;
    create_count: number | null;
    dislike_count: number | null;
    width?: number | null;
    height?: number | null;
  }>,
  client: ReturnType<typeof getSupabaseClient>,
  userToken: string | null
) {
  
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
    let thumbnailUrl = img.thumbnail_url;
    
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
    
    // 获取缩略图签名 URL
    let thumbnailSignedUrl: string | undefined;
    if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
      try {
        thumbnailSignedUrl = await getImageUrl(thumbnailUrl);
      } catch (e) {
        console.error('Failed to generate thumbnail signed URL:', thumbnailUrl, e);
      }
    } else if (thumbnailUrl && thumbnailUrl.startsWith('http')) {
      thumbnailSignedUrl = thumbnailUrl;
    }
    
    // 使用稳定的图片 API URL（便于浏览器缓存）
    const stableUrl = `/api/images/${img.id}/file`;
    const stableThumbnailUrl = thumbnailUrl ? `/api/images/${img.id}/thumbnail` : stableUrl;
    
    return {
      ...img,
      image_url: stableUrl, // 稳定的 URL，浏览器可缓存
      thumbnail_url: stableThumbnailUrl, // 缩略图 URL
      original_url: signedUrl || imageUrl, // 原始签名 URL，用于下载
      original_thumbnail_url: thumbnailSignedUrl, // 缩略图原始签名 URL
      // 图片尺寸
      width: img.width,
      height: img.height,
      // 统计数据
      stats: {
        views: img.view_count || 0,
        likes: img.like_count || 0,
        creates: img.create_count || 0,
        dislikes: img.dislike_count || 0,
      },
      // 用户交互状态
      userInteraction: userInteractions[img.id] || {
        has_liked: false,
        has_disliked: false,
      },
    };
  }));
  
  return images;
}
