import { eq } from 'drizzle-orm'
import { ingredients, recipes, steps } from '../../db/schema'
import { syncRecipeTagsInTx } from './recipe-tags'
import {
  RecipeExportPackage,
  resolveImportRecipeTitles,
  toRecipeInput,
  validateRecipePackage,
} from '../recipe-package'

export interface ImportRecipesResult {
  importedCount: number
  renamedCount: number
  recipes: { title: string; originalTitle: string }[]
}

export { resolveImportRecipeTitles }

export async function importRecipesForUser(userId: number, input: unknown): Promise<ImportRecipesResult> {
  const recipePackage = validateRecipePackage(input)
  const { db } = await import('../../db')

  const result = await db.transaction(async (tx) => {
    const incomingTitles = recipePackage.recipes.map(recipe => recipe.title)
    const existingRows = incomingTitles.length > 0
      ? await tx
        .select({ title: recipes.title })
        .from(recipes)
        .where(eq(recipes.userId, userId))
      : []
    const resolvedTitles = resolveImportRecipeTitles(
      incomingTitles,
      existingRows.map(row => row.title)
    )

    const imported: { title: string; originalTitle: string }[] = []

    for (const [index, packageRecipe] of recipePackage.recipes.entries()) {
      const recipeInput = toRecipeInput(packageRecipe)
      const title = resolvedTitles[index]

      const [insertedRecipe] = await tx
        .insert(recipes)
        .values({
          userId,
          title,
          imageUrl: recipeInput.imageUrl,
        })
        .returning({ id: recipes.id })

      if (recipeInput.ingredients.length > 0) {
        await tx.insert(ingredients).values(
          recipeInput.ingredients.map((ingredient, ingredientIndex) => ({
            recipeId: insertedRecipe.id,
            name: ingredient.name,
            amount: ingredient.amount,
            sort: ingredientIndex,
          }))
        )
      }

      if (recipeInput.steps.length > 0) {
        await tx.insert(steps).values(
          recipeInput.steps.map((step, stepIndex) => ({
            recipeId: insertedRecipe.id,
            phase: step.phase,
            text: step.text,
            sort: stepIndex,
          }))
        )
      }

      await syncRecipeTagsInTx(tx, insertedRecipe.id, recipeInput.tags || [])
      imported.push({ title, originalTitle: packageRecipe.title })
    }

    return {
      importedCount: imported.length,
      renamedCount: imported.filter(recipe => recipe.title !== recipe.originalTitle).length,
      recipes: imported,
    }
  })

  return result
}

export function validateImportRequestBody(body: unknown): RecipeExportPackage {
  if (!body || typeof body !== 'object' || !('recipePackage' in body)) {
    throw new Error('缺少 recipePackage')
  }
  const conflictStrategy = (body as { conflictStrategy?: unknown }).conflictStrategy
  if (conflictStrategy !== undefined && conflictStrategy !== 'rename') {
    throw new Error('仅支持 rename 冲突策略')
  }

  return validateRecipePackage((body as { recipePackage: unknown }).recipePackage)
}
