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
    
    // 先查询是否存在
    const { data: existingUser, error: queryError } = await client
      .from('users')
      .select('id')
      .eq('token', token)
      .single();
    
    if (existingUser) {
      return NextResponse.json({ success: true, userId: existingUser.id });
    }
    
    // 不存在则创建
    const { data: newUser, error: insertError } = await client
      .from('users')
      .insert({ token })
      .select('id')
      .single();
    
    if (insertError) {
      throw insertError;
    }
    
    return NextResponse.json({ success: true, userId: newUser?.id });
  } catch (error) {
    console.error('Init user error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '初始化失败' },
      { status: 500 }
    );
  }
}
