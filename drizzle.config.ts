import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL ||
      `postgresql://cooking_user:olT2dENgw54ggi%2FDUaxPRed06LKrNh7lPoJpkEN8HKQ%3D@localhost:5432/cooking_plan`,
  },
})
