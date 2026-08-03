#!/usr/bin/env bash
# ── CollabTree 一键部署脚本 ──
# 部署到任何有 Docker 的 Linux 服务器
# 用法: ./deploy.sh [user@host]

set -euo pipefail

REMOTE="${1:-}"

echo "🌲 CollabTree 部署"
echo "===================="

if [ -z "$REMOTE" ]; then
  echo ""
  echo "📋 部署方式："
  echo ""
  echo "  方式一：本地 Docker 运行"
  echo "    docker build -t collab-tree ."
  echo "    docker run -d -p 1234:1234 -v \$(pwd)/server/data:/app/server/data --name collab-tree --restart always collab-tree"
  echo ""
  echo "  方式二：部署到远程服务器"
  echo "    ./deploy.sh root@your-server-ip"
  echo ""
  echo "  方式三：服务器上直接运行（需要 Node.js 22+）"
  echo "    npm run deploy"
  echo ""
  exit 0
fi

echo "🚀 部署到 $REMOTE"

# 1. 构建前端
echo "📦 构建前端..."
cd client
npm install --silent 2>/dev/null
npx vite build
cd ..

# 2. 打包项目（排除 node_modules）
echo "📦 打包项目..."
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='client/node_modules' \
    --exclude='server/node_modules' \
    --exclude='tests' \
    -czf /tmp/collab-tree.tar.gz \
    server/ client/dist/ package.json Dockerfile

# 3. 上传到服务器
echo "📤 上传到服务器..."
scp /tmp/collab-tree.tar.gz "$REMOTE:/tmp/"

# 4. 在服务器上部署
echo "🔧 服务器端部署..."
ssh "$REMOTE" << 'DEPLOY'
  set -e
  mkdir -p /opt/collab-tree
  cd /opt/collab-tree
  tar xzf /tmp/collab-tree.tar.gz
  rm /tmp/collab-tree.tar.gz

  # 安装依赖（生产模式，跳过可选依赖如 localtunnel）
  cd server && npm install --omit=dev --omit=optional && cd ..

  # 停止旧容器
  docker stop collab-tree 2>/dev/null || true
  docker rm collab-tree 2>/dev/null || true

  # 构建并启动
  docker build -t collab-tree .
  docker run -d \
    -p 1234:1234 \
    -v /opt/collab-tree/server/data:/app/server/data \
    --name collab-tree \
    --restart always \
    collab-tree

  echo "✅ 部署完成"
  echo "📍 服务地址: http://$(curl -s ifconfig.me):1234"
DEPLOY

echo ""
echo "✅ 部署完成！"
echo "📍 服务地址: http://$REMOTE:1234 (将你的 IP 或域名替换上来)"