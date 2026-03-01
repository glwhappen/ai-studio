-- 随机获取公开图片的函数
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
  is_public BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  config JSONB,
  view_count INTEGER,
  like_count INTEGER,
  create_count INTEGER
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
    images.is_public,
    images.created_at,
    images.config,
    images.view_count,
    images.like_count,
    images.create_count
  FROM images
  WHERE images.is_public = true
    AND images.status = 'completed'
    AND images.image_url IS NOT NULL
  ORDER BY RANDOM()
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
