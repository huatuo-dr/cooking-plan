import Dexie, { Table } from 'dexie'

export interface LocalRecipe {
  id?: number
  title: string
  imageUrl?: string
  ingredients: { name: string; amount?: string }[]
  steps: { phase: 'prep' | 'cook'; text: string }[]
  createdAt: string
  updatedAt: string
}

export interface LocalCookingSession {
  id?: number
  name: string
  items: LocalCookingItem[]
  steps: LocalCookingStep[]
  ingredients: LocalCookingIngredient[]
  createdAt: string
  updatedAt: string
}

export interface LocalCookingItem {
  id?: number
  recipeId?: number
  recipeTitle: string
  color: string
}

export interface LocalCookingStep {
  id?: number
  phase: 'prep' | 'cook'
  sourceRecipeTitle: string
  color: string
  text: string
  sort: number
  done: boolean
}

export interface LocalCookingIngredient {
  id?: number
  sourceRecipeTitle: string
  color: string
  name: string
  amount?: string
  done: boolean
}

export class LocalRecipeDB extends Dexie {
  recipes!: Table<LocalRecipe>
  cookingSessions!: Table<LocalCookingSession>

  constructor() {
    super('CookingPlanLocal')
    this.version(2).stores({
      recipes: '++id, title, createdAt',
      cookingSessions: '++id, name, createdAt',
    })
  }
}

export const localDB = new LocalRecipeDB()

// ============ 菜谱相关 ============

export async function saveLocalRecipe(recipe: LocalRecipe) {
  const now = new Date().toISOString()
  if (recipe.id) {
    await localDB.recipes.update(recipe.id, {
      ...recipe,
      updatedAt: now,
    })
    return recipe
  } else {
    recipe.createdAt = now
    recipe.updatedAt = now
    const id = await localDB.recipes.add(recipe)
    return { ...recipe, id }
  }
}

export async function getLocalRecipes(): Promise<LocalRecipe[]> {
  return await localDB.recipes.orderBy('createdAt').reverse().toArray()
}

export async function getLocalRecipe(id: number): Promise<LocalRecipe | undefined> {
  return await localDB.recipes.get(id)
}

export async function deleteLocalRecipe(id: number) {
  await localDB.recipes.delete(id)
}

// ============ Cooking 会话相关 ============

export async function saveLocalCookingSession(session: LocalCookingSession) {
  const now = new Date().toISOString()
  if (session.id) {
    await localDB.cookingSessions.update(session.id, {
      ...session,
      updatedAt: now,
    })
    return session
  } else {
    session.createdAt = now
    session.updatedAt = now
    const id = await localDB.cookingSessions.add(session)
    return { ...session, id }
  }
}

export async function getLocalCookingSessions(): Promise<LocalCookingSession[]> {
  return await localDB.cookingSessions.orderBy('createdAt').reverse().toArray()
}

export async function getLocalCookingSession(id: number): Promise<LocalCookingSession | undefined> {
  return await localDB.cookingSessions.get(id)
}

export async function deleteLocalCookingSession(id: number) {
  await localDB.cookingSessions.delete(id)
}
