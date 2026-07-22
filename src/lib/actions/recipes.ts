'use server'

import { db } from '@/db'
import { recipes, ingredients, steps, users, recipeTags, recipeTagRelations } from '@/db/schema'
import { eq, or, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { writeFile } from 'fs/promises'
import path from 'path'
import { getSession } from '@/lib/auth'
import { normalizeRecipeTags } from '@/lib/recipe-tags'

type RecipeInput = {
  title: string
  imageUrl?: string
  ingredients: { name: string; amount?: string }[]
  steps: { phase: 'prep' | 'cook'; text: string }[]
  tags?: string[]
}

// #1 权限隔离：根据登录状态返回可见的菜谱
// - 匿名用户：只看 admin 菜谱
// - 登录用户：看 admin 菜谱 + 自己的菜谱
export async function getRecipes() {
  const session = await getSession()

  const whereCondition = session
    ? or(eq(recipes.userId, session.id), eq(users.role, 'admin'))
    : eq(users.role, 'admin')

  const allRecipes = await db
    .select({
      id: recipes.id,
      userId: recipes.userId,
      title: recipes.title,
      imageUrl: recipes.imageUrl,
      createdAt: recipes.createdAt,
      updatedAt: recipes.updatedAt,
      authorRole: users.role,
      authorEmail: users.email,
    })
    .from(recipes)
    .leftJoin(users, eq(recipes.userId, users.id))
    .where(whereCondition)
    .orderBy(recipes.createdAt)

  // 批量获取所有食材、步骤和标签（避免 N+1）
  const recipeIds = allRecipes.map(r => r.id)
  if (recipeIds.length === 0) return []

  const allIngredients = await db.select()
    .from(ingredients)
    .where(inArray(ingredients.recipeId, recipeIds))
    .orderBy(ingredients.sort)

  const allSteps = await db.select()
    .from(steps)
    .where(inArray(steps.recipeId, recipeIds))
    .orderBy(steps.sort)

  const allTags = await db
    .select({
      recipeId: recipeTagRelations.recipeId,
      name: recipeTags.name,
    })
    .from(recipeTagRelations)
    .innerJoin(recipeTags, eq(recipeTagRelations.tagId, recipeTags.id))
    .where(inArray(recipeTagRelations.recipeId, recipeIds))
    .orderBy(recipeTags.name)

  // 按菜谱 ID 分组
  const ingredientsByRecipe = new Map<number, typeof allIngredients>()
  for (const ing of allIngredients) {
    if (!ingredientsByRecipe.has(ing.recipeId)) {
      ingredientsByRecipe.set(ing.recipeId, [])
    }
    ingredientsByRecipe.get(ing.recipeId)!.push(ing)
  }

  const stepsByRecipe = new Map<number, typeof allSteps>()
  for (const step of allSteps) {
    if (!stepsByRecipe.has(step.recipeId)) {
      stepsByRecipe.set(step.recipeId, [])
    }
    stepsByRecipe.get(step.recipeId)!.push(step)
  }

  const tagsByRecipe = new Map<number, string[]>()
  for (const tag of allTags) {
    if (!tagsByRecipe.has(tag.recipeId)) {
      tagsByRecipe.set(tag.recipeId, [])
    }
    tagsByRecipe.get(tag.recipeId)!.push(tag.name)
  }

  return allRecipes.map(recipe => ({
    ...recipe,
    isOfficial: recipe.authorRole === 'admin',
    ingredients: ingredientsByRecipe.get(recipe.id) || [],
    steps: stepsByRecipe.get(recipe.id) || [],
    tags: tagsByRecipe.get(recipe.id) || [],
  }))
}

// 获取单个菜谱（带权限校验）
export async function getRecipe(id: number) {
  const session = await getSession()

  const recipeRows = await db
    .select({
      id: recipes.id,
      userId: recipes.userId,
      title: recipes.title,
      imageUrl: recipes.imageUrl,
      createdAt: recipes.createdAt,
      updatedAt: recipes.updatedAt,
      authorRole: users.role,
      authorEmail: users.email,
    })
    .from(recipes)
    .leftJoin(users, eq(recipes.userId, users.id))
    .where(eq(recipes.id, id))
    .limit(1)

  if (!recipeRows[0]) return null

  const recipe = recipeRows[0]

  // 权限校验：匿名只能看 admin 菜谱；登录可看 admin 或自己的
  const isOfficial = recipe.authorRole === 'admin'
  const isMine = session?.id === recipe.userId
  if (!isOfficial && !isMine) {
    return null
  }

  const recipeIngredients = await db.select()
    .from(ingredients)
    .where(eq(ingredients.recipeId, id))
    .orderBy(ingredients.sort)

  const recipeSteps = await db.select()
    .from(steps)
    .where(eq(steps.recipeId, id))
    .orderBy(steps.sort)

  const recipeTagRows = await db
    .select({ name: recipeTags.name })
    .from(recipeTagRelations)
    .innerJoin(recipeTags, eq(recipeTagRelations.tagId, recipeTags.id))
    .where(eq(recipeTagRelations.recipeId, id))
    .orderBy(recipeTags.name)

  return {
    ...recipe,
    isOfficial,
    ingredients: recipeIngredients,
    steps: recipeSteps,
    tags: recipeTagRows.map(tag => tag.name),
  }
}

export async function createRecipe(data: RecipeInput) {
  // 获取当前登录用户
  const session = await getSession()
  if (!session) {
    throw new Error('请先登录')
  }

  // A 使用事务确保原子性（菜谱+食材+步骤同生共死）
  const result = await db.transaction(async (tx) => {
    const [recipe] = await tx.insert(recipes).values({
      title: data.title,
      imageUrl: data.imageUrl,
      userId: session.id,
    }).returning()

    // 插入食材
    if (data.ingredients.length > 0) {
      await tx.insert(ingredients).values(
        data.ingredients.map((ing, index) => ({
          recipeId: recipe.id,
          name: ing.name,
          amount: ing.amount,
          sort: index,
        }))
      )
    }

    // 插入步骤
    if (data.steps.length > 0) {
      await tx.insert(steps).values(
        data.steps.map((step, index) => ({
          recipeId: recipe.id,
          phase: step.phase,
          text: step.text,
          sort: index,
        }))
      )
    }

    await syncRecipeTags(tx, recipe.id, data.tags || [])

    return recipe
  })

  revalidatePath('/')
  return result
}

export async function updateRecipe(id: number, data: RecipeInput) {
  // 权限验证：需要登录
  const session = await getSession()
  if (!session) {
    throw new Error('请先登录')
  }

  // C + A 使用事务：在事务中查询并校验权限，确保原子性
  await db.transaction(async (tx) => {
    const recipeInfo = await tx
      .select({ userId: recipes.userId, authorRole: users.role })
      .from(recipes)
      .leftJoin(users, eq(recipes.userId, users.id))
      .where(eq(recipes.id, id))
      .limit(1)

    if (recipeInfo.length === 0) {
      throw new Error('菜谱不存在')
    }

    const isAuthor = recipeInfo[0].userId === session.id
    const isAdmin = session.role === 'admin'
    const isOfficial = recipeInfo[0].authorRole === 'admin'

    // C 权限收窄：作者本人 或 管理员只能改官方菜谱
    const canEdit = isAuthor || (isAdmin && isOfficial)
    if (!canEdit) {
      throw new Error('没有编辑权限')
    }

    // 更新菜谱基本信息
    await tx.update(recipes)
      .set({ title: data.title, imageUrl: data.imageUrl, updatedAt: new Date() })
      .where(eq(recipes.id, id))

    // 删除旧的食材和步骤
    await tx.delete(ingredients).where(eq(ingredients.recipeId, id))
    await tx.delete(steps).where(eq(steps.recipeId, id))

    // 重新插入食材
    if (data.ingredients.length > 0) {
      await tx.insert(ingredients).values(
        data.ingredients.map((ing, index) => ({
          recipeId: id,
          name: ing.name,
          amount: ing.amount,
          sort: index,
        }))
      )
    }

    // 重新插入步骤
    if (data.steps.length > 0) {
      await tx.insert(steps).values(
        data.steps.map((step, index) => ({
          recipeId: id,
          phase: step.phase,
          text: step.text,
          sort: index,
        }))
      )
    }

    if (data.tags !== undefined) {
      await syncRecipeTags(tx, id, data.tags)
    }

    // revalidatePath 移到事务外（事务内调用无意义）
  })

  revalidatePath('/')
  revalidatePath(`/recipes/${id}`)
  revalidatePath(`/recipes/${id}/edit`)
}

export async function deleteRecipe(id: number) {
  // 权限验证
  const session = await getSession()
  if (!session) {
    throw new Error('请先登录')
  }

  const recipeInfo = await db
    .select({ userId: recipes.userId, authorRole: users.role })
    .from(recipes)
    .leftJoin(users, eq(recipes.userId, users.id))
    .where(eq(recipes.id, id))
    .limit(1)

  if (recipeInfo.length === 0) {
    throw new Error('菜谱不存在')
  }

  const isAuthor = recipeInfo[0].userId === session.id
  const isAdmin = session.role === 'admin'
  const isOfficial = recipeInfo[0].authorRole === 'admin'

  // C 权限收窄：作者本人 或 管理员只能删官方菜谱
  const canDelete = isAuthor || (isAdmin && isOfficial)
  if (!canDelete) {
    throw new Error('没有删除权限')
  }

  await db.delete(recipes).where(eq(recipes.id, id))
  revalidatePath('/')
}

export async function uploadImage(file: File): Promise<string> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // 生成文件名
  const timestamp = Date.now()
  const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filename = `${timestamp}_${originalName}`

  // 确保上传目录存在
  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  const filepath = path.join(uploadDir, filename)

  await writeFile(filepath, buffer)

  return `/uploads/${filename}`
}

async function syncRecipeTags(tx: any, recipeId: number, tags: string[]) {
  const normalizedTags = normalizeRecipeTags(tags)

  await tx.delete(recipeTagRelations).where(eq(recipeTagRelations.recipeId, recipeId))

  if (normalizedTags.length === 0) return

  await tx.insert(recipeTags)
    .values(normalizedTags.map(tag => ({
      name: tag.name,
      normalizedName: tag.normalizedName,
    })))
    .onConflictDoNothing({ target: recipeTags.normalizedName })

  const tagRows = await tx
    .select({
      id: recipeTags.id,
      normalizedName: recipeTags.normalizedName,
    })
    .from(recipeTags)
    .where(inArray(recipeTags.normalizedName, normalizedTags.map(tag => tag.normalizedName)))

  const tagIdByNormalizedName = new Map(tagRows.map((tag: { id: number; normalizedName: string }) => [tag.normalizedName, tag.id]))
  const relations = normalizedTags
    .map(tag => {
      const tagId = tagIdByNormalizedName.get(tag.normalizedName)
      return tagId ? { recipeId, tagId } : null
    })
    .filter((relation): relation is { recipeId: number; tagId: number } => relation !== null)

  if (relations.length > 0) {
    await tx.insert(recipeTagRelations)
      .values(relations)
      .onConflictDoNothing()
  }
}
