-- ============================================
-- 数据库迁移脚本：扩展 users.id 字段长度
-- 
-- 执行方式：
-- docker exec -i ai-studio-postgres psql -U postgres -d ai_studio < docker/migrate-users.sql
-- ============================================

-- 检查并修改 users.id 字段长度
ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(128);

-- 检查并修改 image_interactions.user_token 字段长度
ALTER TABLE image_interactions ALTER COLUMN user_token TYPE VARCHAR(128);

-- 验证修改
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'id';
