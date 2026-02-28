-- 图片统计表：存储浏览量、点赞数、点踩数、创作数
ALTER TABLE images ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE images ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE images ADD COLUMN IF NOT EXISTS dislike_count INTEGER DEFAULT 0;
ALTER TABLE images ADD COLUMN IF NOT EXISTS create_count INTEGER DEFAULT 0;

-- 用户交互记录表：记录用户对图片的操作，防止重复
CREATE TABLE IF NOT EXISTS image_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  user_token VARCHAR(64) NOT NULL, -- 用户标识（localStorage token）
  has_viewed BOOLEAN DEFAULT FALSE, -- 是否已浏览
  has_liked BOOLEAN DEFAULT FALSE, -- 是否已点赞
  has_disliked BOOLEAN DEFAULT FALSE, -- 是否已点踩
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 唯一约束：一个用户对一张图片只有一条记录
  UNIQUE(image_id, user_token)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_image_interactions_image_id ON image_interactions(image_id);
CREATE INDEX IF NOT EXISTS idx_image_interactions_user_token ON image_interactions(user_token);
