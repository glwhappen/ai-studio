-- ============================================
-- 修复用户 ID 字段长度
-- 
-- 问题：旧版本 users.id 字段长度只有 36 字符
-- 解决：扩展到 128 字符，支持更长的用户 ID
-- ============================================

-- 1. 扩展 users.id 字段长度
ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(128);

-- 2. 扩展 image_interactions.user_token 字段长度
ALTER TABLE image_interactions ALTER COLUMN user_token TYPE VARCHAR(128);

-- 3. 扩展 images.user_id 字段长度（如果需要）
ALTER TABLE images ALTER COLUMN user_id TYPE VARCHAR(128);
