import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// 数据库密码从环境变量读取（不在代码中硬编码）
const dbPassword = process.env.DB_PASSWORD
if (!dbPassword) {
  throw new Error('DB_PASSWORD 环境变量未配置')
}

const client = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'cooking_plan',
  username: process.env.DB_USER || 'cooking_user',
  password: dbPassword,
})

export const db = drizzle(client, { schema })

export * from './schema'
