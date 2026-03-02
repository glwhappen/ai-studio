# ============================================
# AI 创作室 - Dockerfile
# 优化版：精简依赖、中国镜像加速
# ============================================

# 阶段 1: 构建
FROM node:20-slim AS builder
WORKDIR /app

# 使用阿里云镜像加速（兼容 Debian 12 新格式）
RUN set -ex && \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
        sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list; \
    fi

# 安装 pnpm 并配置淘宝镜像
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm config set registry https://registry.npmmirror.com

# 复制依赖配置文件并安装依赖
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 构建应用
RUN npx next build

# ============================================
# 阶段 2: 运行
FROM node:20-slim AS runner
WORKDIR /app

# 使用阿里云镜像加速（兼容 Debian 12 新格式）
RUN set -ex && \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
        sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list; \
    fi

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
# standalone 已包含精简的运行时依赖（包括 sharp 的原生模块）
# 无需复制完整的 node_modules，大幅减小镜像体积
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# ============================================
# 如果 sharp 等原生模块不工作，取消注释以下代码：
# 
# RUN corepack enable && corepack prepare pnpm@latest --activate
# RUN pnpm config set registry https://registry.npmmirror.com
# COPY package.json pnpm-lock.yaml ./
# RUN pnpm install --prod --frozen-lockfile && pnpm store prune
# ============================================

# 设置权限
RUN chown -R nextjs:nodejs /app

# 切换用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "server.js"]
