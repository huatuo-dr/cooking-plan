import { z } from 'zod'

// 菜谱创建/更新校验
export const recipeSchema = z.object({
  title: z.string().min(1, '菜谱名称不能为空').max(200, '菜谱名称不能超过 200 字符'),
  imageUrl: z.string().max(500).optional(),
  ingredients: z.array(z.object({
    name: z.string().min(1, '食材名称不能为空').max(100),
    amount: z.string().max(50).optional(),
  })).min(1, '至少需要一种食材'),
  steps: z.array(z.object({
    phase: z.enum(['prep', 'cook']),
    text: z.string().min(1, '步骤内容不能为空').max(1000),
  })).min(1, '至少需要一个步骤'),
})

export type RecipeInput = z.infer<typeof recipeSchema>

// Cooking 计划创建校验
export const cookingCreateSchema = z.object({
  name: z.string().min(1, '计划名称不能为空').max(200),
  recipeIds: z.array(z.number().int().positive()).min(1, '至少选择一道菜'),
})

export type CookingCreateInput = z.infer<typeof cookingCreateSchema>

// 登录校验
export const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
})

// 注册校验
export const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码长度至少 6 位'),
  inviteCode: z.string().min(1, '邀请码不能为空'),
})

// 改密校验
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, '原密码不能为空'),
  newPassword: z.string().min(6, '新密码长度至少 6 位'),
})

// 注销账户校验
export const deleteAccountSchema = z.object({
  password: z.string().min(1, '密码不能为空'),
})

// 邀请码生成校验
export const generateInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(100),
})

// D Cooking toggle 校验
export const toggleSchema = z.object({
  id: z.number().int().positive(),
  done: z.boolean(),
})

// D Cooking reorder 校验（stepIds 最多 200 个）
export const reorderSchema = z.object({
  stepIds: z.array(z.number().int().positive()).min(1).max(200),
})

// D 复制菜谱校验
export const copyRecipeSchema = z.object({
  fromId: z.number().int().positive(),
})
