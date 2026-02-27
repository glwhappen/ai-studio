import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 切换图片公开状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isPublic, userId } = body;
    
    if (typeof isPublic !== 'boolean' || !userId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    // 验证图片属于该用户
    const { data: image, error: queryError } = await client
      .from('images')
      .select('user_id')
      .eq('id', id)
      .single();
    
    if (queryError || !image) {
      return NextResponse.json({ error: '图片不存在' }, { status: 404 });
    }
    
    if (image.user_id !== userId) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
    
    // 更新公开状态
    const { error: updateError } = await client
      .from('images')
      .update({ is_public: isPublic, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (updateError) {
      throw updateError;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Toggle public error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}
