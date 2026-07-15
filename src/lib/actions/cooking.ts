'use server'

import { db, recipes, cookingSessions, cookingSessionItems, cookingSessionSteps, cookingSessionIngredients, steps, ingredients, users } from '@/db'
import { eq, and, inArray, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'

// 颜色列表（用于区分不同菜谱）
const COLORS = [
  '#e8590c', '#1971c2', '#2f9e44', '#9c36b5', '#f08c00', '#0ca678',
]

export async function createCookingSession(data: { name: string; recipeIds: number[] }) {
  const user = await getSession()
  if (!user) {
    throw new Error('请先登录')
  }

  // P0 修复：获取选中的菜谱时必须加权限过滤
  // 只允许选 admin 菜谱 或 自己的菜谱，防止 IDOR 窃取他人私人菜谱
  const selectedRecipes = await db
    .select({
      id: recipes.id,
      userId: recipes.userId,
      title: recipes.title,
      imageUrl: recipes.imageUrl,
      authorRole: users.role,
    })
    .from(recipes)
    .leftJoin(users, eq(recipes.userId, users.id))
    .where(and(
      inArray(recipes.id, data.recipeIds),
      or(eq(users.role, 'admin'), eq(recipes.userId, user.id))
    ))

  // 严格校验：如果查到的数量与传入不一致，说明有越权 ID
  if (selectedRecipes.length !== data.recipeIds.length) {
    throw new Error('部分菜谱不存在或无权访问')
  }

  if (selectedRecipes.length === 0) {
    throw new Error('请选择至少一道菜')
  }

  // 预加载所有食材和步骤（避免循环内多次查询）
  const recipeIds = selectedRecipes.map(r => r.id)
  const allIngredients = await db.select().from(ingredients)
    .where(inArray(ingredients.recipeId, recipeIds))
  const allSteps = await db.select().from(steps)
    .where(inArray(steps.recipeId, recipeIds))

  // A 使用事务确保原子性（会话+快照同生共死）
  const result = await db.transaction(async (tx) => {
    const [session] = await tx.insert(cookingSessions).values({
      userId: user.id,
      name: data.name,
    }).returning()

    // 分配颜色并创建快照（顺序 await 确保执行）
    for (let i = 0; i < selectedRecipes.length; i++) {
      const recipe = selectedRecipes[i]
      const color = COLORS[i % COLORS.length]

      await tx.insert(cookingSessionItems).values({
        sessionId: session.id,
        recipeId: recipe.id,
        color,
      })

      // 食材快照
      const recipeIngredients = allIngredients.filter(ing => ing.recipeId === recipe.id)
      if (recipeIngredients.length > 0) {
        await tx.insert(cookingSessionIngredients).values(
          recipeIngredients.map(ing => ({
            sessionId: session.id,
            sourceRecipeTitle: recipe.title,
            color,
            name: ing.name,
            amount: ing.amount,
            done: false,
          }))
        )
      }

      // 步骤快照
      const recipeSteps = allSteps.filter(s => s.recipeId === recipe.id)
      if (recipeSteps.length > 0) {
        await tx.insert(cookingSessionSteps).values(
          recipeSteps.map(step => ({
            sessionId: session.id,
            phase: step.phase,
            sourceRecipeTitle: recipe.title,
            color,
            text: step.text,
            sort: step.sort,
            done: false,
          }))
        )
      }
    }

    return session
  })

  revalidatePath('/cooking')
  return result
}

// #2 获取 Cooking 会话列表（带归属校验）
export async function getCookingSessions() {
  const user = await getSession()
  if (!user) return []

  const sessions = await db.select().from(cookingSessions)
    .where(eq(cookingSessions.userId, user.id))
    .orderBy(cookingSessions.createdAt)

  // 批量获取所有会话的步骤（避免 N+1）
  if (sessions.length === 0) return []

  const sessionIds = sessions.map(s => s.id)
  const allSteps = await db.select()
    .from(cookingSessionSteps)
    .where(inArray(cookingSessionSteps.sessionId, sessionIds))

  const allItems = await db.select()
    .from(cookingSessionItems)
    .where(inArray(cookingSessionItems.sessionId, sessionIds))

  return sessions.map(session => {
    const sessionSteps = allSteps.filter(s => s.sessionId === session.id)
    const sessionItems = allItems.filter(i => i.sessionId === session.id)
    return {
      ...session,
      steps: sessionSteps,
      stepCount: sessionSteps.length,
      doneCount: sessionSteps.filter(s => s.done).length,
      recipeCount: sessionItems.length,
    }
  })
}

// #2 获取单个 Cooking 会话（带归属校验）
export async function getCookingSession(id: number) {
  const user = await getSession()
  if (!user) return null

  const session = await db.select().from(cookingSessions)
    .where(eq(cookingSessions.id, id))
    .limit(1)

  if (!session[0]) return null

  // 归属校验：只能看自己的会话
  if (session[0].userId !== user.id) {
    return null
  }

  const ingredients = await db.select()
    .from(cookingSessionIngredients)
    .where(eq(cookingSessionIngredients.sessionId, id))
    .orderBy(cookingSessionIngredients.sourceRecipeTitle)

  const steps = await db.select()
    .from(cookingSessionSteps)
    .where(eq(cookingSessionSteps.sessionId, id))
    .orderBy(cookingSessionSteps.sort)

  return {
    ...session[0],
    ingredients,
    steps,
  }
}

// #2 更新步骤顺序（带归属校验 + 事务化）
export async function updateStepOrder(sessionId: number, stepIds: number[]) {
  const user = await getSession()
  if (!user) throw new Error('请先登录')

  // 事务内校验 + 更新（避免 TOCTOU 和半截顺序）
  await db.transaction(async (tx) => {
    // 校验会话归属
    const session = await tx.select().from(cookingSessions)
      .where(eq(cookingSessions.id, sessionId))
      .limit(1)
    if (!session[0] || session[0].userId !== user.id) {
      throw new Error('无权操作此会话')
    }

    // 校验所有步骤都属于该会话
    const validSteps = await tx.select().from(cookingSessionSteps)
      .where(eq(cookingSessionSteps.sessionId, sessionId))
    const validStepIds = new Set(validSteps.map(s => s.id))
    for (const stepId of stepIds) {
      if (!validStepIds.has(stepId)) {
        throw new Error('步骤不属于此会话')
      }
    }

    // 批量更新顺序
    for (let i = 0; i < stepIds.length; i++) {
      await tx.update(cookingSessionSteps)
        .set({ sort: i })
        .where(and(
          eq(cookingSessionSteps.sessionId, sessionId),
          eq(cookingSessionSteps.id, stepIds[i])
        ))
    }
  })

  revalidatePath(`/cooking/${sessionId}`)
}

// #2 切换食材完成状态（带归属校验 + 事务化）
export async function toggleIngredientDone(id: number, done: boolean) {
  const user = await getSession()
  if (!user) throw new Error('请先登录')

  let sessionId: number | null = null

  await db.transaction(async (tx) => {
    // 校验食材归属（食材 → 会话 → 用户）
    const ingredient = await tx.select().from(cookingSessionIngredients)
      .where(eq(cookingSessionIngredients.id, id))
      .limit(1)
    if (!ingredient[0]) throw new Error('食材不存在')

    sessionId = ingredient[0].sessionId

    const session = await tx.select().from(cookingSessions)
      .where(eq(cookingSessions.id, ingredient[0].sessionId))
      .limit(1)
    if (!session[0] || session[0].userId !== user.id) {
      throw new Error('无权操作')
    }

    await tx.update(cookingSessionIngredients)
      .set({ done })
      .where(eq(cookingSessionIngredients.id, id))
  })

  if (sessionId) revalidatePath(`/cooking/${sessionId}`)
}

// #2 切换步骤完成状态（带归属校验 + 事务化）
export async function toggleStepDone(id: number, done: boolean) {
  const user = await getSession()
  if (!user) throw new Error('请先登录')

  let sessionId: number | null = null

  await db.transaction(async (tx) => {
    // 校验步骤归属
    const step = await tx.select().from(cookingSessionSteps)
      .where(eq(cookingSessionSteps.id, id))
      .limit(1)
    if (!step[0]) throw new Error('步骤不存在')

    sessionId = step[0].sessionId

    const session = await tx.select().from(cookingSessions)
      .where(eq(cookingSessions.id, step[0].sessionId))
      .limit(1)
    if (!session[0] || session[0].userId !== user.id) {
      throw new Error('无权操作')
    }

    await tx.update(cookingSessionSteps)
      .set({ done })
      .where(eq(cookingSessionSteps.id, id))
  })

  if (sessionId) revalidatePath(`/cooking/${sessionId}`)
}

// #2 删除 Cooking 会话（带归属校验 + 事务化）
export async function deleteCookingSession(id: number) {
  const user = await getSession()
  if (!user) throw new Error('请先登录')

  await db.transaction(async (tx) => {
    // 校验会话归属
    const session = await tx.select().from(cookingSessions)
      .where(eq(cookingSessions.id, id))
      .limit(1)
    if (!session[0]) throw new Error('会话不存在')
    if (session[0].userId !== user.id) {
      throw new Error('无权删除此会话')
    }
    // 级联删除会自动处理快照表
    await tx.delete(cookingSessions).where(eq(cookingSessions.id, id))
  })

  revalidatePath('/cooking')
}
