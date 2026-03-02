import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 初始化用户
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;
    
    if (!token) {
      return NextResponse.json({ error: '缺少 token' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    // token 就是用户标识，直接查询是否存在
    // 注意：数据库字段名是 token，不是 id
    const { data: existingUser, error: queryError } = await client
      .from('users')
      .select('token')
      .eq('token', token)
      .maybeSingle();
    
    if (queryError) {
      console.error('Query user error:', queryError);
    }
    
    if (existingUser) {
      return NextResponse.json({ success: true, userId: existingUser.token, isNew: false });
    }
    
    // 不存在则创建（token 字段存储用户标识）
    const { data: newUser, error: insertError } = await client
      .from('users')
      .insert({ token })
      .select('token')
      .single();
    
    if (insertError) {
      // 可能是并发插入导致的唯一键冲突，再次查询
      const { data: retryUser } = await client
        .from('users')
        .select('token')
        .eq('token', token)
        .maybeSingle();
      
      if (retryUser) {
        return NextResponse.json({ success: true, userId: retryUser.token, isNew: false });
      }
      
      throw insertError;
    }
    
    return NextResponse.json({ success: true, userId: newUser?.token, isNew: true });
  } catch (error) {
    console.error('Init user error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '初始化失败' },
      { status: 500 }
    );
  }
}
