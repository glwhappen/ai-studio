import '@supabase/supabase-js';

// 扩展 Error 类型以支持 Supabase 的 code 属性
interface DatabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
}

// 声明全局类型扩展
declare global {
  interface Error {
    code?: string;
    details?: string;
    hint?: string;
  }
}

// 图片记录类型
export interface ImageRecord {
  id: string;
  user_id: string;
  prompt: string;
  model: string | null;
  provider: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  image_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  error_message: string | null;
  is_public: boolean;
  config: Record<string, unknown> | null;
  view_count: number;
  like_count: number;
  dislike_count: number;
  create_count: number;
  created_at: string;
  updated_at: string;
}

// 用户记录类型
export interface UserRecord {
  id: string;
  created_at: string;
  updated_at: string;
}

// 交互记录类型
export interface InteractionRecord {
  id: string;
  image_id: string;
  user_token: string;
  has_viewed: boolean;
  has_liked: boolean;
  has_disliked: boolean;
  created_at: string;
  updated_at: string;
}

export {};
