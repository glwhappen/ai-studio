-- ============================================
-- AI 创作室 - 数据库初始化脚本
-- 此脚本在 PostgreSQL 容器启动时自动执行
-- ============================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 用户表
-- ============================================
-- 注意：如果表已存在且字段长度不足，执行以下迁移：
-- ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(128);
-- ALTER TABLE image_interactions ALTER COLUMN user_token TYPE VARCHAR(128);
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 如果表已存在，确保字段长度正确
DO $$
BEGIN
  -- 检查并修改 users.id 字段长度
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'id' 
    AND character_maximum_length < 128
  ) THEN
    ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(128);
  END IF;
  
  -- 检查并修改 image_interactions.user_token 字段长度
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'image_interactions' 
    AND column_name = 'user_token' 
    AND character_maximum_length < 128
  ) THEN
    ALTER TABLE image_interactions ALTER COLUMN user_token TYPE VARCHAR(128);
  END IF;
END $$;

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ============================================
-- 图片表
-- ============================================
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  model VARCHAR(100),
  provider VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  image_url TEXT,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  error_message TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  config JSONB,
  -- 统计字段
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  dislike_count INTEGER DEFAULT 0,
  create_count INTEGER DEFAULT 0,
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 图片表索引
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);
CREATE INDEX IF NOT EXISTS idx_images_is_public ON images(is_public);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_width ON images(width);
CREATE INDEX IF NOT EXISTS idx_images_height ON images(height);

-- ============================================
-- 交互记录表
-- ============================================
CREATE TABLE IF NOT EXISTS image_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id VARCHAR(255) NOT NULL,
  user_token VARCHAR(128) NOT NULL,
  has_viewed BOOLEAN DEFAULT FALSE,
  has_liked BOOLEAN DEFAULT FALSE,
  has_disliked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 交互记录索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_image_interactions_unique ON image_interactions(image_id, user_token);
CREATE INDEX IF NOT EXISTS idx_image_interactions_image_id ON image_interactions(image_id);
CREATE INDEX IF NOT EXISTS idx_image_interactions_user_token ON image_interactions(user_token);

-- ============================================
-- 交互记录函数
-- ============================================
CREATE OR REPLACE FUNCTION record_interaction(
  p_image_id VARCHAR(255),
  p_user_token VARCHAR(128),
  p_action VARCHAR(20)
) RETURNS JSON AS $$
DECLARE
  v_interaction RECORD;
  v_delta INTEGER := 0;
  v_count_field VARCHAR(20);
  v_result JSON;
BEGIN
  -- 获取或创建交互记录
  SELECT * INTO v_interaction 
  FROM image_interactions 
  WHERE image_id = p_image_id AND user_token = p_user_token;
  
  IF NOT FOUND THEN
    INSERT INTO image_interactions (image_id, user_token, has_viewed, has_liked, has_disliked)
    VALUES (
      p_image_id, 
      p_user_token, 
      p_action = 'view', 
      p_action = 'like', 
      p_action = 'dislike'
    )
    RETURNING * INTO v_interaction;
    
    -- 新记录时，直接增加计数
    IF p_action = 'view' THEN
      UPDATE images SET view_count = view_count + 1 WHERE id = p_image_id;
    ELSIF p_action = 'like' THEN
      UPDATE images SET like_count = like_count + 1 WHERE id = p_image_id;
    ELSIF p_action = 'dislike' THEN
      UPDATE images SET dislike_count = dislike_count + 1 WHERE id = p_image_id;
    ELSIF p_action = 'create' THEN
      UPDATE images SET create_count = create_count + 1 WHERE id = p_image_id;
    END IF;
  ELSE
    -- 已存在记录，检查是否需要更新
    CASE p_action
      WHEN 'view' THEN
        IF NOT v_interaction.has_viewed THEN
          UPDATE image_interactions SET has_viewed = TRUE, updated_at = NOW() WHERE id = v_interaction.id;
          UPDATE images SET view_count = view_count + 1 WHERE id = p_image_id;
        END IF;
        
      WHEN 'like' THEN
        IF NOT v_interaction.has_liked THEN
          UPDATE image_interactions SET has_liked = TRUE, has_disliked = FALSE, updated_at = NOW() WHERE id = v_interaction.id;
          UPDATE images SET like_count = like_count + 1 WHERE id = p_image_id;
          IF v_interaction.has_disliked THEN
            UPDATE images SET dislike_count = GREATEST(0, dislike_count - 1) WHERE id = p_image_id;
          END IF;
        END IF;
        
      WHEN 'unlike' THEN
        IF v_interaction.has_liked THEN
          UPDATE image_interactions SET has_liked = FALSE, updated_at = NOW() WHERE id = v_interaction.id;
          UPDATE images SET like_count = GREATEST(0, like_count - 1) WHERE id = p_image_id;
        END IF;
        
      WHEN 'dislike' THEN
        IF NOT v_interaction.has_disliked THEN
          UPDATE image_interactions SET has_disliked = TRUE, has_liked = FALSE, updated_at = NOW() WHERE id = v_interaction.id;
          UPDATE images SET dislike_count = dislike_count + 1 WHERE id = p_image_id;
          IF v_interaction.has_liked THEN
            UPDATE images SET like_count = GREATEST(0, like_count - 1) WHERE id = p_image_id;
          END IF;
        END IF;
        
      WHEN 'undislike' THEN
        IF v_interaction.has_disliked THEN
          UPDATE image_interactions SET has_disliked = FALSE, updated_at = NOW() WHERE id = v_interaction.id;
          UPDATE images SET dislike_count = GREATEST(0, dislike_count - 1) WHERE id = p_image_id;
        END IF;
        
      WHEN 'create' THEN
        UPDATE images SET create_count = create_count + 1 WHERE id = p_image_id;
    END CASE;
  END IF;
  
  -- 返回结果
  SELECT json_build_object(
    'success', TRUE,
    'stats', json_build_object(
      'view_count', i.view_count,
      'like_count', i.like_count,
      'dislike_count', i.dislike_count,
      'create_count', i.create_count
    ),
    'userInteraction', json_build_object(
      'hasViewed', COALESCE(ii.has_viewed, FALSE),
      'hasLiked', COALESCE(ii.has_liked, FALSE),
      'hasDisliked', COALESCE(ii.has_disliked, FALSE)
    )
  ) INTO v_result
  FROM images i
  LEFT JOIN image_interactions ii ON ii.image_id = i.id AND ii.user_token = p_user_token
  WHERE i.id = p_image_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 随机获取图片函数
-- ============================================
CREATE OR REPLACE FUNCTION get_random_images(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  prompt TEXT,
  model TEXT,
  provider TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  is_public BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  config JSONB,
  view_count INTEGER,
  like_count INTEGER,
  dislike_count INTEGER,
  create_count INTEGER,
  width INTEGER,
  height INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    images.id,
    images.prompt,
    images.model,
    images.provider,
    images.image_url,
    images.thumbnail_url,
    images.is_public,
    images.created_at,
    images.config,
    images.view_count,
    images.like_count,
    images.dislike_count,
    images.create_count,
    images.width,
    images.height
  FROM images
  WHERE images.is_public = true
    AND images.status = 'completed'
    AND images.image_url IS NOT NULL
  ORDER BY RANDOM()
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================
-- 更新时间戳触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 users 表创建触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为 images 表创建触发器
DROP TRIGGER IF EXISTS update_images_updated_at ON images;
CREATE TRIGGER update_images_updated_at
  BEFORE UPDATE ON images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AI 创作室数据库初始化完成';
  RAISE NOTICE '========================================';
END $$;
