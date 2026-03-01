-- 添加 thumbnail_url 字段到 images 表
ALTER TABLE images ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 添加注释
COMMENT ON COLUMN images.thumbnail_url IS '缩略图的对象存储 key';
