#!/bin/sh
set -e

echo "🔧 Cooking-Plan 启动中..."

# 等待数据库就绪
echo "⏳ 等待数据库就绪..."
until nc -z "$DB_HOST" "${DB_PORT:-5432}" 2>/dev/null; do
  echo "  数据库未就绪，2 秒后重试..."
  sleep 2
done
echo "✅ 数据库已就绪"

# 额外等 2 秒确保 Postgres 完全可接受连接
sleep 2

# 同步数据库 schema
echo "📦 同步数据库 schema..."
cd /app
node ./node_modules/drizzle-kit/bin.cjs push || {
  echo "❌ schema 同步失败"
  exit 1
}
echo "✅ schema 同步完成"

# 初始化管理员（已存在则更新密码，幂等）
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "👤 初始化管理员账号..."
  node ./node_modules/tsx/dist/cli.mjs scripts/seed.ts || {
    echo "⚠️  管理员初始化失败（可能已存在）"
  }
fi

# 启动应用
echo "🚀 启动 Next.js 应用..."
exec node server.js
