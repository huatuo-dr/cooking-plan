import { defineConfig } from 'drizzle-kit'
import 'dotenv/config'

// 本地开发：localhost  生产部署：db（docker compose 服务名）
const dbHost = process.env.DB_HOST || 'localhost'
const dbPassword = process.env.DB_PASSWORD
if (!dbPassword) {
  throw new Error('DB_PASSWORD 环境变量未配置')
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    host: dbHost,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'cooking_plan',
    user: process.env.DB_USER || 'cooking_user',
    password: dbPassword,
    ssl: false,
  },
})
