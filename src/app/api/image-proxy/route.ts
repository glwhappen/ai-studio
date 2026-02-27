import { NextRequest, NextResponse } from 'next/server';

// 图片代理接口 - 解决跨域问题
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
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // 返回图片，添加 CORS 头
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 缓存 1 天
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
