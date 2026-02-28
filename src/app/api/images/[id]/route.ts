import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 删除图片
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: '缺少 userId' }, { status: 400 });
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
    
    // 删除图片记录
    const { error: deleteError } = await client
      .from('images')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      throw deleteError;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
