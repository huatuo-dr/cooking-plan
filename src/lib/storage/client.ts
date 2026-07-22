'use client'

import {
  LocalRecipe,
  LocalCookingSession,
  getLocalRecipes,
  getLocalRecipe,
  saveLocalRecipe,
  deleteLocalRecipe,
  getLocalCookingSessions,
  getLocalCookingSession,
  saveLocalCookingSession,
  deleteLocalCookingSession,
} from './local'
import { normalizeRecipeTags } from '@/lib/recipe-tags'
import {
  exportRecipePackage,
  parseRecipePackageJson,
  resolveImportRecipeTitles,
  toRecipeInput,
  type RecipeExportPackage,
  type ImportImageWarning,
  getImportImageWarnings,
} from '@/lib/recipe-package'

// 云端 Cooking 会话列表接口
interface CloudCookingSession {
  id: number
  name: string
  createdAt: string
  steps?: any[]
}

// ============ 统一菜谱接口 ============

export interface UnifiedRecipe {
  id: string  // 统一用 string，格式: "local-1" 或 "cloud-5"
  title: string
  imageUrl?: string
  ingredients: { name: string; amount?: string }[]
  steps: { phase: 'prep' | 'cook'; text: string }[]
  tags: string[]
  createdAt: string
  source: 'local' | 'cloud'
  isOfficial?: boolean  // 是否是官方（管理员）菜谱
  isMine?: boolean      // 是否是当前用户创建的
}

export interface ImportRecipesResult {
  importedCount: number
  renamedCount: number
  recipes: { title: string; originalTitle: string }[]
}

function normalizeRecipeIngredients(ingredients: any[] = []): { name: string; amount?: string }[] {
  return ingredients.map(ingredient => ({
    name: ingredient.name,
    amount: ingredient.amount ?? undefined,
  }))
}

// 检查登录状态（异步，通过 API 验证）
export async function isLoggedIn(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/me')
    if (response.ok) {
      const data = await response.json()
      return !!data.user
    }
  } catch (e) {}
  return false
}

// ============ 菜谱操作 ============

// 获取当前用户 ID（从 JWT 中解析，简化处理）
async function getCurrentUserId(): Promise<number | null> {
  if (!(await isLoggedIn())) return null
  try {
    const response = await fetch('/api/auth/me')
    if (response.ok) {
      const data = await response.json()
      return data.user?.id || null
    }
  } catch (e) {}
  return null
}

async function getCurrentUser(): Promise<{ id: number; role: 'admin' | 'user' } | null> {
  try {
    const response = await fetch('/api/auth/me')
    if (response.ok) {
      const data = await response.json()
      return data.user || null
    }
  } catch (e) {}
  return null
}

// 获取所有菜谱（本地 + 云端）
export async function getAllRecipes(): Promise<UnifiedRecipe[]> {
  const recipes: UnifiedRecipe[] = []
  const loggedIn = await isLoggedIn()

  // #13 登录用户不读本地 IndexedDB（避免设备切换数据混淆）
  // 只有匿名用户才读取本地菜谱
  if (!loggedIn) {
    try {
      const localRecipes = await getLocalRecipes()
      recipes.push(...localRecipes.map(r => ({
        id: `local-${r.id}`,
        title: r.title,
        imageUrl: r.imageUrl,
        ingredients: r.ingredients,
        steps: r.steps,
        tags: r.tags || [],
        createdAt: r.createdAt,
        source: 'local' as const,
        isOfficial: false,
        isMine: true,
      })))
    } catch (e) {
      // IndexedDB 可能不可用
    }
  }

  // 获取云端菜谱
  try {
    const response = await fetch('/api/recipes')
    if (response.ok) {
      const cloudRecipes = await response.json()
      // 并行获取当前用户 ID
      const currentUserId = loggedIn ? await getCurrentUserId() : null
      recipes.push(...cloudRecipes.map((r: any) => ({
        id: `cloud-${r.id}`,
        title: r.title,
        imageUrl: r.imageUrl ?? undefined,
        ingredients: normalizeRecipeIngredients(r.ingredients || []),
        steps: r.steps || [],
        tags: r.tags || [],
        createdAt: r.createdAt,
        source: 'cloud' as const,
        isOfficial: r.isOfficial || r.authorRole === 'admin',
        isMine: currentUserId != null && r.userId === currentUserId,
      })))
    }
  } catch (e) {
    // 网络错误
  }

  return recipes
}

// 获取单个菜谱
export async function getRecipeById(id: string): Promise<UnifiedRecipe | null> {
  const [source, numericId] = id.split('-')

  if (source === 'local') {
    // #13 登录用户不访问本地菜谱（避免设备切换数据混淆）
    const loggedIn = await isLoggedIn()
    if (loggedIn) return null

    const recipe = await getLocalRecipe(Number(numericId))
    if (!recipe) return null
    return {
      id: `local-${recipe.id}`,
      title: recipe.title,
      imageUrl: recipe.imageUrl,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      tags: recipe.tags || [],
      createdAt: recipe.createdAt,
      source: 'local',
      isOfficial: false,
      isMine: true,
    }
  } else {
    const response = await fetch(`/api/recipes/${numericId}`)
    if (!response.ok) return null
    const recipe = await response.json()
    const currentUserId = (await isLoggedIn()) ? await getCurrentUserId() : null
    return {
      id: `cloud-${recipe.id}`,
      title: recipe.title,
      imageUrl: recipe.imageUrl ?? undefined,
      ingredients: normalizeRecipeIngredients(recipe.ingredients || []),
      steps: recipe.steps || [],
      tags: recipe.tags || [],
      createdAt: recipe.createdAt,
      source: 'cloud',
      isOfficial: recipe.isOfficial || recipe.authorRole === 'admin',
      isMine: currentUserId != null && recipe.userId === currentUserId,
    }
  }
}

// 创建/更新菜谱
export async function saveRecipe(recipe: Partial<UnifiedRecipe> & { title: string }): Promise<UnifiedRecipe> {
  const loggedIn = await isLoggedIn()

  if (loggedIn) {
    const tags = recipe.tags === undefined ? undefined : normalizeRecipeTags(recipe.tags).map(tag => tag.name)
    // 登录用户：保存到云端
    const basePayload = {
      title: recipe.title,
      imageUrl: recipe.imageUrl,
      ingredients: recipe.ingredients || [],
      steps: recipe.steps || [],
    }

    if (recipe.id?.startsWith('cloud-')) {
      // 更新
      const id = recipe.id.replace('cloud-', '')
      const payload = tags === undefined ? basePayload : { ...basePayload, tags }
      const response = await fetch(`/api/recipes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      // F 检查响应
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || '保存失败')
      }
      return { ...recipe, source: 'cloud' } as UnifiedRecipe
    } else {
      // 创建
      const payload = { ...basePayload, tags: tags || [] }
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      // F 检查响应
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || '创建失败')
      }
      const newRecipe = await response.json()
      return {
        ...newRecipe,
        id: `cloud-${newRecipe.id}`,
        source: 'cloud',
        // 后端只返回主记录，显式补充 ingredients/steps 字段
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || [],
        tags: tags || [],
      }
    }
  } else {
    const localId = recipe.id?.startsWith('local-') ? Number(recipe.id.replace('local-', '')) : undefined
    const existingLocalRecipe = localId ? await getLocalRecipe(localId) : undefined
    const tags = recipe.tags === undefined
      ? (existingLocalRecipe?.tags || [])
      : normalizeRecipeTags(recipe.tags).map(tag => tag.name)
    // 匿名用户：保存到本地
    const localRecipe: LocalRecipe = {
      id: localId,
      title: recipe.title,
      imageUrl: recipe.imageUrl,
      ingredients: recipe.ingredients || [],
      steps: recipe.steps || [],
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const saved = await saveLocalRecipe(localRecipe)
    return {
      id: `local-${saved.id}`,
      title: saved.title,
      imageUrl: saved.imageUrl,
      ingredients: saved.ingredients,
      steps: saved.steps,
      tags: saved.tags || [],
      createdAt: saved.createdAt,
      source: 'local',
    }
  }
}

export function createRecipeExportJson(recipes: UnifiedRecipe[]): string {
  return JSON.stringify(exportRecipePackage(recipes), null, 2)
}

export function previewRecipeImport(json: string): {
  recipePackage: RecipeExportPackage
  imageWarnings: ImportImageWarning[]
} {
  const recipePackage = parseRecipePackageJson(json)
  return {
    recipePackage,
    imageWarnings: getImportImageWarnings(recipePackage),
  }
}

export async function importRecipesFromJson(json: string): Promise<ImportRecipesResult> {
  const recipePackage = parseRecipePackageJson(json)
  const user = await getCurrentUser()

  if (!user) {
    const localRecipes = await getLocalRecipes()
    const titles = resolveImportRecipeTitles(
      recipePackage.recipes.map(recipe => recipe.title),
      localRecipes.map(recipe => recipe.title)
    )
    const imported: { title: string; originalTitle: string }[] = []

    try {
      for (const [index, packageRecipe] of recipePackage.recipes.entries()) {
        const recipeInput = toRecipeInput(packageRecipe)
        const saved = await saveLocalRecipe({
          title: titles[index],
          imageUrl: recipeInput.imageUrl,
          ingredients: recipeInput.ingredients,
          steps: recipeInput.steps,
          tags: recipeInput.tags,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        imported.push({ title: saved.title, originalTitle: packageRecipe.title })
      }
    } catch (error) {
      throw new Error(`导入失败，已导入 ${imported.length} 道菜谱`)
    }

    return {
      importedCount: imported.length,
      renamedCount: imported.filter(recipe => recipe.title !== recipe.originalTitle).length,
      recipes: imported,
    }
  }

  const endpoint = user.role === 'admin' ? '/api/admin/recipes/import' : '/api/recipes/import'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipePackage,
      conflictStrategy: 'rename',
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || '导入失败')
  }

  return await response.json()
}

// 删除菜谱
export async function deleteRecipe(id: string) {
  const [source, numericId] = id.split('-')

  if (source === 'local') {
    await deleteLocalRecipe(Number(numericId))
  } else {
    const response = await fetch(`/api/recipes/${numericId}`, { method: 'DELETE' })
    // F 检查响应
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || '删除失败')
    }
  }
}

// ============ Cooking 会话操作 ============

export interface UnifiedCookingSession {
  id: string
  name: string
  items: { recipeTitle: string; color: string }[]
  steps: { id?: number; phase: 'prep' | 'cook'; sourceRecipeTitle: string; color: string; text: string; sort: number; done: boolean }[]
  ingredients: { id?: number; sourceRecipeTitle: string; color: string; name: string; amount?: string; done: boolean }[]
  createdAt: string
  source: 'local' | 'cloud'
}

const COLORS = ['#e8590c', '#1971c2', '#2f9e44', '#9c36b5', '#f08c00', '#0ca678']

// 创建 Cooking 会话
export async function createCookingSession(name: string, recipes: UnifiedRecipe[]): Promise<UnifiedCookingSession> {
  const loggedIn = await isLoggedIn()

  const items: { recipeTitle: string; color: string }[] = []
  const steps: any[] = []
  const ingredients: any[] = []

  // 本地存储用唯一 id（云端由数据库生成，本地需要手动赋值）
  let localStepIdCounter = 1
  let localIngredientIdCounter = 1

  recipes.forEach((recipe, index) => {
    const color = COLORS[index % COLORS.length]
    items.push({ recipeTitle: recipe.title, color })

    recipe.steps.forEach(step => {
      steps.push({
        id: localStepIdCounter++,  // 修复：必须分配唯一 id
        phase: step.phase,
        sourceRecipeTitle: recipe.title,
        color,
        text: step.text,
        sort: steps.length,
        done: false,
      })
    })

    recipe.ingredients.forEach(ing => {
      ingredients.push({
        id: localIngredientIdCounter++,  // 修复：必须分配唯一 id
        sourceRecipeTitle: recipe.title,
        color,
        name: ing.name,
        amount: ing.amount,
        done: false,
      })
    })
  })

  if (loggedIn) {
    // 云端
    const response = await fetch('/api/cooking/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        recipeIds: recipes.filter(r => r.source === 'cloud').map(r => Number(r.id.replace('cloud-', ''))),
      }),
    })
    const session = await response.json()
    return {
      id: `cloud-${session.id}`,
      name: session.name,
      items: [],
      steps: [],
      ingredients: [],
      createdAt: session.createdAt,
      source: 'cloud',
    }
  } else {
    // 本地
    const localSession = await saveLocalCookingSession({
      name,
      items,
      steps,
      ingredients,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    return {
      id: `local-${localSession.id}`,
      name: localSession.name,
      items: localSession.items,
      steps: localSession.steps,
      ingredients: localSession.ingredients,
      createdAt: localSession.createdAt,
      source: 'local',
    }
  }
}

// 获取 Cooking 会话
export async function getCookingSession(id: string): Promise<UnifiedCookingSession | null> {
  const [source, numericId] = id.split('-')

  if (source === 'local') {
    const session = await getLocalCookingSession(Number(numericId))
    if (!session) return null
    return {
      id: `local-${session.id}`,
      name: session.name,
      items: session.items,
      steps: session.steps,
      ingredients: session.ingredients,
      createdAt: session.createdAt,
      source: 'local',
    }
  } else {
    const response = await fetch(`/api/cooking/${numericId}`)
    if (!response.ok) return null
    const session = await response.json()
    return {
      id: `cloud-${session.id}`,
      name: session.name,
      items: [],
      steps: session.steps || [],
      ingredients: session.ingredients || [],
      createdAt: session.createdAt,
      source: 'cloud',
    }
  }
}

// #14 更新 Cooking 步骤顺序（云端真实实现）
export async function updateStepOrder(sessionId: string, stepIds: number[]) {
  const [source, numericId] = sessionId.split('-')

  if (source === 'local') {
    const session = await getLocalCookingSession(Number(numericId))
    if (!session) return

    // stepIds 是本地步骤的 id 数组，按新顺序排列
    const newSteps: any[] = []
    for (let newSort = 0; newSort < stepIds.length; newSort++) {
      const found = session.steps.find(s => s.id === stepIds[newSort])
      if (found) {
        newSteps.push({ ...found, sort: newSort })
      }
    }
    session.steps = newSteps
    await saveLocalCookingSession(session)
  } else {
    // 云端：调用 reorder API
    const response = await fetch(`/api/cooking/${numericId}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepIds }),
    })
    if (!response.ok) {
      throw new Error('保存顺序失败')
    }
  }
}

// #14 切换步骤完成状态（云端真实实现）
export async function toggleStepDone(sessionId: string, stepId: number, done: boolean) {
  const [source, numericId] = sessionId.split('-')

  if (source === 'local') {
    const session = await getLocalCookingSession(Number(numericId))
    if (!session) return
    const step = session.steps.find(s => s.id === stepId)
    if (step) {
      step.done = done
      await saveLocalCookingSession(session)
    }
  } else {
    // 云端：调用 toggle-step API
    const response = await fetch(`/api/cooking/${numericId}/toggle-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stepId, done }),
    })
    if (!response.ok) {
      throw new Error('保存失败')
    }
  }
}

// #14 切换食材完成状态（云端真实实现）
export async function toggleIngredientDone(sessionId: string, ingredientId: number, done: boolean) {
  const [source, numericId] = sessionId.split('-')

  if (source === 'local') {
    const session = await getLocalCookingSession(Number(numericId))
    if (!session) return
    const ing = session.ingredients.find(i => i.id === ingredientId)
    if (ing) {
      ing.done = done
      await saveLocalCookingSession(session)
    }
  } else {
    // 云端：调用 toggle-ingredient API
    const response = await fetch(`/api/cooking/${numericId}/toggle-ingredient`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ingredientId, done }),
    })
    if (!response.ok) {
      throw new Error('保存失败')
    }
  }
}

// ============ Cooking 会话列表 ============

export interface CookingSessionSummary {
  id: string
  name: string
  createdAt: string
  stepCount: number
  doneCount: number
  recipeCount: number
  source: 'local' | 'cloud'
}

// 获取所有 Cooking 会话列表
export async function getAllCookingSessions(): Promise<CookingSessionSummary[]> {
  const sessions: CookingSessionSummary[] = []

  // 获取本地会话
  try {
    const localSessions = await getLocalCookingSessions()
    sessions.push(...localSessions.map(s => ({
      id: `local-${s.id}`,
      name: s.name,
      createdAt: s.createdAt,
      stepCount: s.steps.length,
      doneCount: s.steps.filter(step => step.done).length,
      recipeCount: new Set(s.items.map(i => i.recipeTitle)).size,
      source: 'local' as const,
    })))
  } catch (e) {
    // IndexedDB 可能不可用
  }

  // 获取云端会话
  try {
    if (await isLoggedIn()) {
      const response = await fetch('/api/cooking')
      if (response.ok) {
        const cloudSessions = await response.json()
        sessions.push(...cloudSessions.map((s: CloudCookingSession) => ({
          id: `cloud-${s.id}`,
          name: s.name,
          createdAt: s.createdAt,
          stepCount: s.steps?.length || 0,
          doneCount: s.steps?.filter((step: any) => step.done).length || 0,
          recipeCount: 0,
          source: 'cloud' as const,
        })))
      }
    }
  } catch (e) {
    // 网络错误
  }

  return sessions.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

// 删除 Cooking 会话
export async function deleteCookingSession(id: string) {
  const [source, numericId] = id.split('-')

  if (source === 'local') {
    await deleteLocalCookingSession(Number(numericId))
  } else {
    await fetch(`/api/cooking/${numericId}`, { method: 'DELETE' })
  }
}
