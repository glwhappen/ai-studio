import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取公开作品集
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    const client = getSupabaseClient();
    
    // 获取公开且已完成的图片
    const { data, error } = await client
      .from('images')
      .select('id, prompt, model, provider, image_url, is_public, created_at')
      .eq('is_public', true)
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw error;
    }
    
    // 获取总数
    const { count, error: countError } = await client
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true)
      .eq('status', 'completed')
      .not('image_url', 'is', null);
    
    if (countError) {
      throw countError;
    }
    
    return NextResponse.json({
      success: true,
      images: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Get gallery error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取作品集失败' },
      { status: 500 }
    );
  }
}
