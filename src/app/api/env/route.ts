import { NextRequest, NextResponse } from 'next/server';

// 获取环境变量配置（用于部署时查看）
// 使用方式：
//   GET /api/env          - 脱敏显示
//   GET /api/env?full=1   - 显示完整信息（用于复制配置）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const showFull = searchParams.get('full') === '1';
  
  // 脱敏函数：只显示前后几位
  const mask = (value: string | undefined, showChars = 4): string => {
    if (!value) return '(未设置)';
    if (showFull) return value;
    if (value.length <= showChars * 2) return '****';
    return `${value.slice(0, showChars)}...${value.slice(-showChars)}`;
  };

  const config = {
    // 数据库配置
    COZE_SUPABASE_URL: process.env.COZE_SUPABASE_URL || '(未设置)',
    COZE_SUPABASE_ANON_KEY: mask(process.env.COZE_SUPABASE_ANON_KEY),
    
    // 对象存储配置  
    COZE_BUCKET_ENDPOINT_URL: process.env.COZE_BUCKET_ENDPOINT_URL || '(未设置)',
    COZE_BUCKET_NAME: process.env.COZE_BUCKET_NAME || '(未设置)',
    COZE_BUCKET_ACCESS_KEY: mask(process.env.COZE_BUCKET_ACCESS_KEY),
    COZE_BUCKET_SECRET_KEY: mask(process.env.COZE_BUCKET_SECRET_KEY),
    COZE_BUCKET_REGION: process.env.COZE_BUCKET_REGION || '(未设置)',
    
    // Coze 身份认证（独立部署需要此变量才能使用 Coze 托管存储）
    COZE_WORKLOAD_IDENTITY_API_KEY: mask(process.env.COZE_WORKLOAD_IDENTITY_API_KEY),
  };

  // 如果是完整模式，输出可直接复制的格式
  if (showFull) {
    const envContent = `# 环境变量配置（从 Coze 环境导出）
# ⚠️ 警告：COZE_WORKLOAD_IDENTITY_API_KEY 是敏感密钥，请妥善保管！

COZE_SUPABASE_URL=${config.COZE_SUPABASE_URL}
COZE_SUPABASE_ANON_KEY=${config.COZE_SUPABASE_ANON_KEY}
COZE_BUCKET_ENDPOINT_URL=${config.COZE_BUCKET_ENDPOINT_URL}
COZE_BUCKET_NAME=${config.COZE_BUCKET_NAME}
COZE_BUCKET_ACCESS_KEY=${config.COZE_BUCKET_ACCESS_KEY}
COZE_BUCKET_SECRET_KEY=${config.COZE_BUCKET_SECRET_KEY}
COZE_BUCKET_REGION=${config.COZE_BUCKET_REGION}
COZE_WORKLOAD_IDENTITY_API_KEY=${config.COZE_WORKLOAD_IDENTITY_API_KEY}`;
    
    return new NextResponse(envContent, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  return NextResponse.json(config, { 
    headers: { 'Content-Type': 'application/json; charset=utf-8' } 
  });
}
