import { pgTable, serial, text, timestamp, integer, boolean, varchar, pgEnum, primaryKey, index } from 'drizzle-orm/pg-core'

// 用户角色枚举（带 CHECK 约束）
export const userRoleEnum = pgEnum('user_role', ['admin', 'user'])

// 步骤阶段枚举
export const stepPhaseEnum = pgEnum('step_phase', ['prep', 'cook'])

// 用户表
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  // 用于改密失效旧 session
  passwordChangedAt: timestamp('password_changed_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// 邀请码表
export const invitationCodes = pgTable('invitation_codes', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  maxUses: integer('max_uses').notNull().default(1),
  usedCount: integer('used_count').notNull().default(0),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// 菜谱表
export const recipes = pgTable('recipes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// 菜谱标签表（全局复用，按规范化名称去重）
export const recipeTags = pgTable('recipe_tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 20 }).notNull(),
  normalizedName: varchar('normalized_name', { length: 20 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// 菜谱与标签关联表
export const recipeTagRelations = pgTable('recipe_tag_relations', {
  recipeId: integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => recipeTags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.recipeId, table.tagId] }),
  recipeIdIdx: index('recipe_tag_relations_recipe_id_idx').on(table.recipeId),
  tagIdIdx: index('recipe_tag_relations_tag_id_idx').on(table.tagId),
}))

// 食材表
export const ingredients = pgTable('ingredients', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  amount: varchar('amount', { length: 50 }),
  sort: integer('sort').notNull().default(0),
})

// 步骤表（准备 + 制作合并）
export const steps = pgTable('steps', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  phase: stepPhaseEnum('phase').notNull(),
  text: varchar('text', { length: 1000 }).notNull(),
  sort: integer('sort').notNull().default(0),
})

// Cooking 会话表
export const cookingSessions = pgTable('cooking_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Cooking 会话项（选了哪些菜 + 颜色）
export const cookingSessionItems = pgTable('cooking_session_items', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => cookingSessions.id, { onDelete: 'cascade' }),
  recipeId: integer('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
  color: varchar('color', { length: 20 }).notNull(),
})

// Cooking 会话步骤快照
export const cookingSessionSteps = pgTable('cooking_session_steps', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => cookingSessions.id, { onDelete: 'cascade' }),
  phase: stepPhaseEnum('phase').notNull(),
  sourceRecipeTitle: varchar('source_recipe_title', { length: 200 }).notNull(),
  color: varchar('color', { length: 20 }).notNull(),
  text: varchar('text', { length: 1000 }).notNull(),
  sort: integer('sort').notNull().default(0),
  done: boolean('done').notNull().default(false),
})

// Cooking 会话食材快照
export const cookingSessionIngredients = pgTable('cooking_session_ingredients', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => cookingSessions.id, { onDelete: 'cascade' }),
  sourceRecipeTitle: varchar('source_recipe_title', { length: 200 }).notNull(),
  color: varchar('color', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  amount: varchar('amount', { length: 50 }),
  done: boolean('done').notNull().default(false),
})

// 类型导出
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type UserRole = 'admin' | 'user'
export type InvitationCode = typeof invitationCodes.$inferSelect
export type NewInvitationCode = typeof invitationCodes.$inferInsert
export type Recipe = typeof recipes.$inferSelect
export type NewRecipe = typeof recipes.$inferInsert
export type RecipeTag = typeof recipeTags.$inferSelect
export type NewRecipeTag = typeof recipeTags.$inferInsert
export type RecipeTagRelation = typeof recipeTagRelations.$inferSelect
export type NewRecipeTagRelation = typeof recipeTagRelations.$inferInsert
export type Ingredient = typeof ingredients.$inferSelect
export type NewIngredient = typeof ingredients.$inferInsert
export type Step = typeof steps.$inferSelect
export type NewStep = typeof steps.$inferInsert
export type CookingSession = typeof cookingSessions.$inferSelect
export type NewCookingSession = typeof cookingSessions.$inferInsert
export type CookingSessionItem = typeof cookingSessionItems.$inferSelect
export type NewCookingSessionItem = typeof cookingSessionItems.$inferInsert
export type CookingSessionStep = typeof cookingSessionSteps.$inferSelect
export type NewCookingSessionStep = typeof cookingSessionSteps.$inferInsert
export type CookingSessionIngredient = typeof cookingSessionIngredients.$inferSelect
export type NewCookingSessionIngredient = typeof cookingSessionIngredients.$inferInsert
