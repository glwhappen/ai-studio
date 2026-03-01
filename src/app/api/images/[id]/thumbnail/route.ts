import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getImageUrl } from '@/lib/storage';
import crypto from 'crypto';

// 通过图片 ID 获取缩略图文件（带缓存）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ error: '缺少图片 ID' }, { status: 400 });
  }
  
  try {
    const client = getSupabaseClient();
    
    // 查询图片
    const { data: image, error } = await client
      .from('images')
      .select('id, image_url, thumbnail_url, status')
      .eq('id', id)
      .single();
    
    if (error || !image) {
      return NextResponse.json({ error: '图片不存在' }, { status: 404 });
    }
    
    if (image.status !== 'completed' || !image.image_url) {
      return NextResponse.json({ error: '图片未完成生成' }, { status: 400 });
    }
    
    // 生成 ETag（基于图片 ID + thumbnail 后缀，保证稳定性）
    const etag = `"${crypto.createHash('md5').update(id + '-thumbnail').digest('hex')}"`;
    
    // 检查客户端缓存
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
    
    // 优先使用缩略图，如果没有则使用原图
    let imageUrl = image.thumbnail_url || image.image_url;
    
    // 如果是对象存储 key，获取签名 URL
    if (!imageUrl.startsWith('http')) {
      try {
        imageUrl = await getImageUrl(imageUrl);
      } catch (e) {
        return NextResponse.json({ error: '获取图片 URL 失败' }, { status: 500 });
      }
    }
    
    // 代理请求图片
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Image-Generator/1.0)',
      },
    });
    
    if (!response.ok) {
      return NextResponse.json({ error: '图片获取失败' }, { status: response.status });
    }
    
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // 缩略图统一使用 jpg 格式
    const filename = `ai-image-${id.slice(0, 8)}-thumbnail.jpg`;
    
    // 返回图片，强缓存 1 年
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error) {
    console.error('Get thumbnail error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取缩略图失败' },
      { status: 500 }
    );
  }
}
