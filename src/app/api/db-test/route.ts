import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 数据库连接测试 API
export async function GET() {
  const startTime = Date.now();
  
  try {
    const client = getSupabaseClient();
    
    // 尝试执行一个简单的查询
    const { data, error } = await client
      .from('users')
      .select('id')
      .limit(1);
    
    const duration = Date.now() - startTime;
    
    if (error) {
      // 检查是否是表不存在的错误
      const isTableNotExist = error.message?.includes('does not exist') || 
                              error.code === '42P01';
      
      if (isTableNotExist) {
        return NextResponse.json({
          status: 'connected',
          message: '数据库连接成功，但表尚未初始化',
          hint: '请执行数据库初始化脚本',
          duration,
        });
      }
      
      return NextResponse.json({
        status: 'error',
        message: '数据库查询失败',
        error: error.message,
        code: error.code,
        duration,
      }, { status: 500 });
    }
    
    return NextResponse.json({
      status: 'ok',
      message: '数据库连接正常',
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : '数据库连接失败',
      hint: '请检查数据库配置是否正确',
      duration,
    }, { status: 500 });
  }
}
