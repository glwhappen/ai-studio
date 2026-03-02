#!/bin/bash
# ============================================
# 低配服务器构建脚本
# 适用于 2 核 CPU / 2GB 内存的服务器
# ============================================

set -e

echo "=========================================="
echo "低配服务器构建模式"
echo "- 限制 CPU 并行度"
echo "- 限制内存使用"
echo "- 构建时间会较长，请耐心等待"
echo "=========================================="

# 检查是否有足够的交换空间
SWAP_TOTAL=$(free -m | awk '/Swap:/ {print $2}')
if [ "$SWAP_TOTAL" -lt 1024 ]; then
  echo "警告：交换空间不足 (${SWAP_TOTAL}MB)"
  echo "建议添加交换空间以提高构建成功率："
  echo ""
  echo "  sudo fallocate -l 2G /swapfile"
  echo "  sudo chmod 600 /swapfile"
  echo "  sudo mkswap /swapfile"
  echo "  sudo swapon /swapfile"
  echo ""
  read -p "是否继续构建？(y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 构建镜像
# Dockerfile 中已设置：
# - NEXT_BUILD_JOBS=1（限制 Next.js 构建并行度）
# - NODE_OPTIONS=--max-old-space-size=1024（限制 Node 内存）
# - pnpm --network-concurrency=1（限制网络并发）

docker compose build --no-cache --progress=plain

echo "=========================================="
echo "构建完成！"
echo "启动服务：docker compose up -d"
echo "=========================================="
