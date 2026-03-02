import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 初始化用户
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;
    
    if (!token) {
      return NextResponse.json({ error: '缺少用户 ID' }, { status: 400 });
    }
    
    // 检查 token 长度
    if (token.length > 128) {
      return NextResponse.json({ 
        error: '用户 ID 过长，请清除浏览器缓存后重试' 
      }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    // token 就是用户 ID，直接查询是否存在
    const { data: existingUser, error: queryError } = await client
      .from('users')
      .select('id')
      .eq('id', token)
      .maybeSingle();
    
    if (queryError) {
      console.error('Query user error:', queryError);
    }
    
    if (existingUser) {
      return NextResponse.json({ success: true, userId: existingUser.id, isNew: false });
    }
    
    // 不存在则创建
    const { data: newUser, error: insertError } = await client
      .from('users')
      .insert({ id: token })
      .select('id')
      .single();
    
    if (insertError) {
      // 检查是否是字段长度错误
      if (insertError.code === '22001') {
        console.error('User ID too long for database field. Please run migration: supabase/migrations/fix_user_id_length.sql');
        return NextResponse.json({ 
          error: '数据库字段长度不足，请联系管理员执行迁移脚本',
          details: 'Please run: supabase/migrations/fix_user_id_length.sql'
        }, { status: 500 });
      }
      
      // 可能是并发插入导致的唯一键冲突，再次查询
      const { data: retryUser } = await client
        .from('users')
        .select('id')
        .eq('id', token)
        .maybeSingle();
      
      if (retryUser) {
        return NextResponse.json({ success: true, userId: retryUser.id, isNew: false });
      }
      
      throw insertError;
    }
    
    return NextResponse.json({ success: true, userId: newUser?.id, isNew: true });
  } catch (error) {
    console.error('Init user error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '初始化失败' },
      { status: 500 }
    );
  }
}
