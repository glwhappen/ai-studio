import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// 图片代理接口 - 解决跨域问题并添加缓存
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  
  if (!imageUrl) {
    return NextResponse.json({ error: '缺少图片 URL' }, { status: 400 });
  }
  
  try {
    // 验证 URL 是否来自允许的域名
    const url = new URL(imageUrl);
    const allowedDomains = [
      'coze-coding-project.tos.coze.site',
      'tos.coze.site',
    ];
    
    if (!allowedDomains.some(domain => url.hostname.endsWith(domain))) {
      return NextResponse.json({ error: '不允许的域名' }, { status: 403 });
    }
    
    // 从 URL 中提取图片路径（去除签名参数）用于生成 ETag
    const imagePath = url.pathname;
    const etag = `"${crypto.createHash('md5').update(imagePath).digest('hex')}"`;
    
    // 检查客户端缓存
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=31536000, immutable', // 1 年，immutable 表示永不改变
        },
      });
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
    
    // 获取图片数据
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    
    // 返回图片，添加 CORS 头和强缓存
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // 1 年缓存，immutable
        'ETag': etag,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '代理失败' },
      { status: 500 }
    );
  }
}
