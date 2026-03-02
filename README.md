# AI 创作室 - 图片生成工具

一个基于 Next.js 的 AI 图片生成应用，支持多种 AI 模型（Gemini、OpenAI 兼容），提供异步生成、作品展示、社区互动等功能。

## 功能特性

- 🎨 **多模型支持**：支持 Gemini、OpenAI 及兼容 API
- 🚀 **异步生成**：提交任务后立即返回，后台执行生成
- 🖼️ **图生图**：支持参考图片生成新图片
- 💡 **提示词优化**：AI 辅助优化和改写提示词
- 👤 **身份识别**：本地生成用户标识，支持跨设备同步
- 🌍 **社区展示**：公开作品瀑布流展示
- 📊 **互动统计**：点赞、点踩、浏览统计
- 📱 **响应式设计**：完美适配桌面和移动端

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose（用于一键部署）

### 方式一：Docker Compose 一键部署（推荐）

1. **克隆项目**

```bash
git clone <your-repo-url>
cd <project-name>
```

2. **配置环境变量**

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填写必要的配置
nano .env
```

3. **启动所有服务**

```bash
docker-compose up -d
```

4. **访问应用**

- 应用地址：http://localhost:3000
- MinIO 控制台：http://localhost:9001（admin/minioadmin123）

### 方式二：本地开发

1. **安装依赖**

```bash
pnpm install
```

2. **配置环境变量**

```bash
cp .env.example .env
# 编辑 .env 文件
```

3. **启动开发服务器**

```bash
pnpm dev
```

4. **访问应用**

打开 http://localhost:5000

## 环境变量配置

创建 `.env` 文件，配置以下变量：

### 必需配置

```bash
# Supabase 数据库（自建 PostgreSQL 或 Supabase Cloud）
COZE_SUPABASE_URL=https://your-project.supabase.co
COZE_SUPABASE_ANON_KEY=your-anon-key

# 对象存储（MinIO 或其他 S3 兼容服务）
COZE_BUCKET_ENDPOINT_URL=http://minio:9000
COZE_BUCKET_NAME=ai-images
COZE_BUCKET_ACCESS_KEY=minioadmin
COZE_BUCKET_SECRET_KEY=minioadmin123
COZE_BUCKET_REGION=us-east-1
```

### AI 模型配置

在前端页面的设置面板中配置：

- **Base URL**：AI API 地址（如 https://api.openai.com）
- **API Key**：API 密钥
- **模型**：支持的图片生成模型

支持的模型：
- Gemini：`imagen-3.0-generate-002` 等
- OpenAI：`gpt-image-1`、`dall-e-3` 等

## Docker Compose 配置

`docker-compose.yml` 包含以下服务：

| 服务 | 端口 | 说明 |
|------|------|------|
| app | 3000 | Next.js 应用 |
| minio | 9000/9001 | 对象存储服务 |
| postgres | 5432 | PostgreSQL 数据库 |

### 服务说明

#### MinIO（对象存储）

- 访问地址：http://localhost:9000
- 控制台：http://localhost:9001
- 默认账号：admin / minioadmin123

#### PostgreSQL（数据库）

- 端口：5432
- 默认用户：postgres
- 默认密码：postgres123
- 数据库名：ai_studio

## 数据库初始化

首次启动后，需要初始化数据库表结构：

```bash
# 连接到 PostgreSQL
docker-compose exec postgres psql -U postgres -d ai_studio

# 执行初始化 SQL（见下方）
```

或使用数据库初始化脚本（已包含在 docker-compose.yml 中自动执行）。

### 数据库表结构

```sql
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 图片表
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
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  dislike_count INTEGER DEFAULT 0,
  create_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 交互记录表
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

-- 索引
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);
CREATE INDEX IF NOT EXISTS idx_images_is_public ON images(is_public);
CREATE UNIQUE INDEX IF NOT EXISTS idx_image_interactions_unique ON image_interactions(image_id, user_token);
```

## 项目结构

```
.
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API 路由
│   │   ├── gallery/           # 作品展示页
│   │   ├── layout.tsx         # 根布局
│   │   └── page.tsx           # 首页（创作工作台）
│   ├── components/            # React 组件
│   │   ├── ui/               # shadcn/ui 组件
│   │   └── ...               # 业务组件
│   ├── lib/                   # 工具库
│   │   └── storage.ts        # 对象存储封装
│   └── storage/              # 数据库相关
│       └── database/         # Supabase 客户端
├── supabase/
│   └── migrations/           # 数据库迁移脚本
├── docker-compose.yml        # Docker Compose 配置
├── Dockerfile               # Docker 镜像构建
└── .env.example             # 环境变量模板
```

## 常见问题

### 1. 图片上传失败

检查对象存储配置：
- 确保 MinIO 服务正常运行
- 检查 `COZE_BUCKET_*` 环境变量是否正确
- 查看 MinIO 控制台确认 bucket 已创建

### 2. 数据库连接失败

检查数据库配置：
- 确保 PostgreSQL 服务正常运行
- 检查 `COZE_SUPABASE_*` 环境变量是否正确
- 如果使用自建 PostgreSQL，确保已创建数据库

### 3. AI 模型调用失败

- 检查 Base URL 是否正确（需包含 `/v1` 或根据 API 文档调整）
- 检查 API Key 是否有效
- 查看浏览器控制台和服务器日志获取详细错误

## 技术栈

- **框架**：Next.js 16 (App Router)
- **UI**：React 19 + Tailwind CSS 4 + shadcn/ui
- **数据库**：Supabase (PostgreSQL)
- **存储**：MinIO (S3 兼容)
- **图片处理**：Sharp

## License

MIT
