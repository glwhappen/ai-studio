-- ============================================
-- 生产环境数据库迁移脚本
-- 请在 Supabase 控制台的 SQL Editor 中执行
-- ============================================

-- 1. 添加统计字段到 images 表（如果不存在）
ALTER TABLE images ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE images ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE images ADD COLUMN IF NOT EXISTS dislike_count INTEGER DEFAULT 0;
ALTER TABLE images ADD COLUMN IF NOT EXISTS create_count INTEGER DEFAULT 0;

-- 2. 创建交互记录表（如果不存在）
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

-- 3. 创建唯一索引（防止重复交互）
CREATE UNIQUE INDEX IF NOT EXISTS idx_image_interactions_unique ON image_interactions(image_id, user_token);

-- 4. 创建查询索引
CREATE INDEX IF NOT EXISTS idx_image_interactions_image_id ON image_interactions(image_id);
CREATE INDEX IF NOT EXISTS idx_image_interactions_user_token ON image_interactions(user_token);

-- 5. 创建交互记录函数（删除旧版本后重建）
DROP FUNCTION IF EXISTS record_interaction(UUID, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS record_interaction(VARCHAR, VARCHAR, VARCHAR);

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

-- 6. 刷新 PostgREST schema 缓存（可选，在某些情况下需要）
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 验证脚本（执行后检查结果）
-- ============================================
-- SELECT * FROM image_interactions LIMIT 1;
-- SELECT id, view_count, like_count FROM images LIMIT 3;
