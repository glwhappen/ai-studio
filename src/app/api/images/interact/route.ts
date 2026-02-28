import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 记录交互（浏览、点赞、点踩、创作）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageId, userToken, action } = body;
    
    if (!imageId || !userToken || !action) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }
    
    const validActions = ['view', 'like', 'unlike', 'dislike', 'undislike', 'create'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: '无效操作' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    // 使用 RPC 函数处理交互
    const { data, error } = await client.rpc('record_interaction', {
      p_image_id: imageId,
      p_user_token: userToken,
      p_action: action,
    });
    
    if (error) {
      console.error('RPC error:', error);
      throw error;
    }
    
    return NextResponse.json(data || { success: true });
  } catch (error) {
    console.error('Interaction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}

// 获取用户对图片的交互状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');
    const userToken = searchParams.get('userToken');
    
    if (!imageId || !userToken) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    const { data: interaction } = await client
      .from('image_interactions')
      .select('has_viewed, has_liked, has_disliked')
      .eq('image_id', imageId)
      .eq('user_token', userToken)
      .maybeSingle();
    
    return NextResponse.json({
      success: true,
      interaction: interaction || {
        has_viewed: false,
        has_liked: false,
        has_disliked: false,
      },
    });
  } catch (error) {
    console.error('Get interaction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}
