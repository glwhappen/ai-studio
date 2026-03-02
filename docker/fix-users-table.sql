-- ============================================
-- 修复用户表结构（Docker 部署使用）
-- 
-- 问题：旧版本数据库 users 表字段名是 token，长度是 36
-- 解决：重命名字段并扩展长度
-- 
-- 执行方式：
-- docker exec -i ai-studio-postgres psql -U postgres -d ai_studio < docker/fix-users-table.sql
-- ============================================

-- 1. 检查是否存在 token 字段（旧版本）
DO $$
BEGIN
  -- 如果存在 token 字段，重命名为 id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'token'
  ) THEN
    ALTER TABLE users RENAME COLUMN token TO id;
    RAISE NOTICE 'Renamed column token to id';
  END IF;
END $$;

-- 2. 扩展 id 字段长度
ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(128);

-- 3. 扩展 image_interactions.user_token 字段长度
ALTER TABLE image_interactions ALTER COLUMN user_token TYPE VARCHAR(128);

-- 4. 验证修改
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'id';
