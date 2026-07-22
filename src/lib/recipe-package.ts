import { z } from 'zod'
import { normalizeRecipeTags } from './recipe-tags'

export const RECIPE_PACKAGE_VERSION = 1
export const MAX_RECIPES_PER_IMPORT = 100
export const MAX_INGREDIENTS_PER_RECIPE = 100
export const MAX_STEPS_PER_RECIPE = 100

export interface RecipePackageRecipe {
  title: string
  imageUrl: string | null
  ingredients: { name: string; amount: string | null }[]
  steps: { phase: 'prep' | 'cook'; text: string }[]
  tags: string[]
}

export interface RecipeExportPackage {
  version: 1
  exportedAt?: string
  app?: string
  recipes: RecipePackageRecipe[]
}

export interface ExportableRecipe {
  title: string
  imageUrl?: string | null
  ingredients: { name: string; amount?: string | null }[]
  steps: { phase: 'prep' | 'cook'; text: string }[]
  tags?: string[]
}

export interface ImportImageWarning {
  recipeTitle: string
  imageUrl: string
  type: 'external' | 'upload'
}

export const MAX_RECIPE_IMPORT_FILE_BYTES = 2 * 1024 * 1024

const nullableString = (max: number) => z.preprocess(
  value => typeof value === 'string' ? value.trim() : value,
  z.string().max(max).nullish().transform(value => value || null)
)
const trimmedRequiredString = (max: number, minMessage: string, maxMessage?: string) => (
  z.preprocess(
    value => typeof value === 'string' ? value.trim() : value,
    z.string().min(1, minMessage).max(max, maxMessage)
  )
)

const recipePackageRecipeSchema = z.object({
  title: trimmedRequiredString(200, '菜谱名称不能为空', '菜谱名称不能超过 200 字符'),
  imageUrl: nullableString(500),
  ingredients: z.array(z.object({
    name: trimmedRequiredString(100, '食材名称不能为空'),
    amount: nullableString(50),
  }))
    .min(1, '至少需要一种食材')
    .max(MAX_INGREDIENTS_PER_RECIPE, `每道菜最多 ${MAX_INGREDIENTS_PER_RECIPE} 个食材`),
  steps: z.array(z.object({
    phase: z.enum(['prep', 'cook']),
    text: trimmedRequiredString(1000, '步骤内容不能为空'),
  }))
    .min(1, '至少需要一个步骤')
    .max(MAX_STEPS_PER_RECIPE, `每道菜最多 ${MAX_STEPS_PER_RECIPE} 个步骤`),
  tags: z.array(z.string()).optional().default([]).transform((tags, ctx) => {
    try {
      return normalizeRecipeTags(tags).map(tag => tag.name)
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : '标签不合法',
      })
      return z.NEVER
    }
  }),
})

const recipePackageSchema = z.object({
  version: z.literal(RECIPE_PACKAGE_VERSION),
  exportedAt: z.string().datetime().optional(),
  app: z.string().optional(),
  recipes: z.array(recipePackageRecipeSchema)
    .min(1, '至少需要一道菜谱')
    .max(MAX_RECIPES_PER_IMPORT, `一次最多导入 ${MAX_RECIPES_PER_IMPORT} 道菜谱`),
})

export function exportRecipePackage(
  recipes: ExportableRecipe[],
  exportedAt: Date = new Date()
): RecipeExportPackage {
  return {
    version: RECIPE_PACKAGE_VERSION,
    exportedAt: exportedAt.toISOString(),
    app: 'cooking-plan',
    recipes: recipes.map(recipe => ({
      title: recipe.title.trim(),
      imageUrl: recipe.imageUrl || null,
      ingredients: recipe.ingredients.map(ingredient => ({
        name: ingredient.name.trim(),
        amount: ingredient.amount || null,
      })),
      steps: recipe.steps.map(step => ({
        phase: step.phase,
        text: step.text.trim(),
      })),
      tags: normalizeRecipeTags(recipe.tags || []).map(tag => tag.name),
    })),
  }
}

export function parseRecipePackageJson(json: string): RecipeExportPackage {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('JSON 格式不合法')
  }

  return validateRecipePackage(parsed)
}

export function validateRecipePackage(input: unknown): RecipeExportPackage {
  try {
    return recipePackageSchema.parse(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message || '菜谱包格式不合法')
    }
    throw error
  }
}

export function getImportImageWarnings(recipePackage: RecipeExportPackage | { recipes: ExportableRecipe[] }): ImportImageWarning[] {
  const warnings: ImportImageWarning[] = []

  for (const recipe of recipePackage.recipes) {
    const imageUrl = recipe.imageUrl
    if (!imageUrl) continue

    if (imageUrl.startsWith('/uploads/')) {
      warnings.push({ recipeTitle: recipe.title, imageUrl, type: 'upload' })
    } else if (/^https?:\/\//i.test(imageUrl)) {
      warnings.push({ recipeTitle: recipe.title, imageUrl, type: 'external' })
    }
  }

  return warnings
}

export function getImportSourceWarning(recipePackage: Pick<RecipeExportPackage, 'app'>): string | null {
  if (recipePackage.app && recipePackage.app !== 'cooking-plan') {
    return '该文件来源不是 cooking-plan，请确认后导入'
  }

  return null
}

export function resolveImportRecipeTitles(incomingTitles: string[], existingTitles: string[]): string[] {
  const usedTitles = new Set(existingTitles)

  return incomingTitles.map((incomingTitle) => {
    let candidate = incomingTitle
    let suffix = 2

    while (usedTitles.has(candidate)) {
      candidate = `${incomingTitle}_${suffix}`
      suffix += 1
    }

    usedTitles.add(candidate)
    return candidate
  })
}

export function toRecipeInput(recipe: RecipePackageRecipe) {
  return {
    title: recipe.title,
    imageUrl: recipe.imageUrl || undefined,
    ingredients: recipe.ingredients.map(ingredient => ({
      name: ingredient.name,
      amount: ingredient.amount || undefined,
    })),
    steps: recipe.steps,
    tags: recipe.tags,
  }
}
