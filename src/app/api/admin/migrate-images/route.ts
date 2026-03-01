import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getImageUrl } from '@/lib/storage';
import sharp from 'sharp';

// 图片记录类型
interface ImageRecord {
  id: string;
  image_url: string;
  thumbnail_url?: string | null;
  width?: number | null;
  height?: number | null;
}

// 批量处理图片元数据（宽高、缩略图）
// 调用方式：POST /api/admin/migrate-images
// 可选参数：batch (批次大小，默认 10)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const batchSize = body.batch || 10;
    
    const client = getSupabaseClient();
    
    // 检查是否有 width/height 列
    let hasDimensionsColumns = true;
    const { error: testError } = await client
      .from('images')
      .select('width, height')
      .limit(1);
    
    if (testError && testError.code === '42703') {
      console.log('width/height columns not exist, skipping dimension processing');
      hasDimensionsColumns = false;
    }
    
    // 构建查询 - 使用 any 类型避免 Supabase 的复杂类型推断问题
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = client
      .from('images')
      .select(hasDimensionsColumns 
        ? 'id, image_url, thumbnail_url, width, height' 
        : 'id, image_url, thumbnail_url'
      )
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .limit(batchSize);
    
    // 如果有 dimensions 列，添加过滤条件
    if (hasDimensionsColumns) {
      query = query.or('width.is.null,thumbnail_url.is.null');
    } else {
      // 只查询缺少缩略图的
      query = query.is('thumbnail_url', null);
    }
    
    const { data: images, error: queryError } = await query;
    
    if (queryError) {
      throw queryError;
    }
    
    if (!images || images.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要处理的图片',
        processed: 0,
        remaining: 0,
      });
    }
    
    // 获取剩余数量
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let remainingQuery: any = client
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .not('image_url', 'is', null);
    
    if (hasDimensionsColumns) {
      remainingQuery = remainingQuery.or('width.is.null,thumbnail_url.is.null');
    } else {
      remainingQuery = remainingQuery.is('thumbnail_url', null);
    }
    
    const { count: remainingCount } = await remainingQuery;
    
    const results: Array<{
      id: string;
      success: boolean;
      width?: number;
      height?: number;
      thumbnail?: boolean;
      error?: string;
    }> = [];
    
    // 处理每张图片
    for (const image of images as ImageRecord[]) {
      try {
        let imageUrl = image.image_url;
        let width = image.width ?? undefined;
        let height = image.height ?? undefined;
        let thumbnailUrl = image.thumbnail_url;
        let imageBuffer: Buffer | null = null;
        
        // 如果是对象存储 key，获取签名 URL
        if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
          imageUrl = await getImageUrl(imageUrl);
        }
        
        // 下载图片
        if (imageUrl && imageUrl.startsWith('http')) {
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`下载图片失败: ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
        } else if (imageUrl && imageUrl.startsWith('data:')) {
          // base64 数据 URL
          const base64Data = imageUrl.split(',')[1];
          if (base64Data) {
            imageBuffer = Buffer.from(base64Data, 'base64');
          }
        }
        
        if (!imageBuffer) {
          throw new Error('无法获取图片内容');
        }
        
        // 获取图片尺寸（如果列存在且缺少尺寸）
        if (hasDimensionsColumns && (!width || !height)) {
          const metadata = await sharp(imageBuffer).metadata();
          width = metadata.width;
          height = metadata.height;
        }
        
        // 生成缩略图（如果没有）
        if (!thumbnailUrl && imageBuffer) {
          try {
            const thumbnailBuffer = await sharp(imageBuffer)
              .resize(400, 400, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({
                quality: 70,
                mozjpeg: true,
              })
              .toBuffer();
            
            // 上传缩略图
            const { S3Storage } = await import('coze-coding-dev-sdk');
            const storage = new S3Storage({
              endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
              accessKey: "",
              secretKey: "",
              bucketName: process.env.COZE_BUCKET_NAME,
              region: "cn-beijing",
            });
            
            thumbnailUrl = await storage.uploadFile({
              fileContent: thumbnailBuffer,
              fileName: `ai-thumbnails/${image.id}.jpg`,
              contentType: 'image/jpeg',
            });
          } catch (thumbError) {
            console.error('生成缩略图失败:', image.id, thumbError);
            // 缩略图失败不影响主流程
          }
        }
        
        // 更新数据库
        const updateData: Record<string, unknown> = {};
        if (hasDimensionsColumns) {
          if (width) updateData.width = width;
          if (height) updateData.height = height;
        }
        if (thumbnailUrl) updateData.thumbnail_url = thumbnailUrl;
        
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await client
            .from('images')
            .update(updateData)
            .eq('id', image.id);
          
          if (updateError) {
            throw updateError;
          }
        }
        
        results.push({
          id: image.id,
          success: true,
          width,
          height,
          thumbnail: !!thumbnailUrl,
        });
        
      } catch (error) {
        console.error('处理图片失败:', image.id, error);
        results.push({
          id: image.id,
          success: false,
          error: error instanceof Error ? error.message : '处理失败',
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    return NextResponse.json({
      success: true,
      hasDimensionsColumns,
      processed: results.length,
      successCount,
      failCount,
      remaining: Math.max(0, (remainingCount || 0) - successCount),
      results,
    });
    
  } catch (error) {
    console.error('Migrate images error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理失败' },
      { status: 500 }
    );
  }
}

// 获取迁移状态
export async function GET() {
  try {
    const client = getSupabaseClient();
    
    // 检查是否有 width/height 列
    let hasDimensionsColumns = true;
    const { error: testError } = await client
      .from('images')
      .select('width, height')
      .limit(1);
    
    if (testError && testError.code === '42703') {
      hasDimensionsColumns = false;
    }
    
    // 获取总数
    const { count: totalCount } = await client
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .not('image_url', 'is', null);
    
    // 获取缺少缩略图的数量
    const { count: missingThumbnails } = await client
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .is('thumbnail_url', null);
    
    let missingDimensions = 0;
    if (hasDimensionsColumns) {
      const { count } = await client
        .from('images')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .not('image_url', 'is', null)
        .is('width', null);
      missingDimensions = count || 0;
    }
    
    return NextResponse.json({
      success: true,
      hasDimensionsColumns,
      total: totalCount || 0,
      missingDimensions,
      missingThumbnails: missingThumbnails || 0,
      needMigration: (missingDimensions > 0) || ((missingThumbnails || 0) > 0),
    });
    
  } catch (error) {
    console.error('Get migration status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取状态失败' },
      { status: 500 }
    );
  }
}
