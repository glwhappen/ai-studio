-- ============================================
-- 添加图片尺寸字段
-- 在 Supabase 控制台的 SQL Editor 中执行
-- ============================================

-- 添加图片宽度和高度字段
ALTER TABLE images ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE images ADD COLUMN IF NOT EXISTS height INTEGER;

-- 创建索引（可选，用于按尺寸筛选）
CREATE INDEX IF NOT EXISTS idx_images_width ON images(width);
CREATE INDEX IF NOT EXISTS idx_images_height ON images(height);
