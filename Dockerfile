# ============ 阶段 1：安装依赖 ============
FROM node:20-alpine AS deps
WORKDIR /app

# 安装必要系统依赖（sharp + Next.js SWC 需要的 native 库）
RUN apk add --no-cache libc6-compat

COPY package*.json ./
# 安装依赖（alpine 需要显式指定 musl 版本的 native 二进制）
RUN npm ci --omit=optional && \
    npm rebuild sharp && \
    rm -rf /app/node_modules/@next/swc-* && \
    npm install @next/swc-linux-x64-musl@15.0.0 --no-save

# ============ 阶段 2：构建 ============
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生产构建时环境变量占位（避免 build 阶段读取 .env）
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ============ 阶段 3：运行时 ============
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# 安装运行时依赖：nc（netcat，用于 entrypoint 等 DB）、sharp 运行时库
RUN apk add --no-cache netcat-openbsd libc6-compat && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制 Next.js standalone 构建产物
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 复制迁移/seed 所需的文件
COPY --from=builder --chown=nextjs:nodejs /app/src/db ./src/db
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# drizzle-kit + tsx + dotenv 用于 entrypoint 运行迁移和 seed
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/tsx ./node_modules/tsx
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/bcrypt ./node_modules/bcrypt
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/nanoid ./node_modules/nanoid
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/jose ./node_modules/jose

# 入口脚本
COPY --chown=nextjs:nodejs scripts/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && mkdir -p public/uploads && chown -R nextjs:nodejs public

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
