import { inArray, eq } from 'drizzle-orm'
import { recipeTagRelations, recipeTags } from '../../db/schema'
import { normalizeRecipeTags } from '../recipe-tags'

export async function syncRecipeTagsInTx(tx: any, recipeId: number, tags: string[]) {
  const normalizedTags = normalizeRecipeTags(tags)

  await tx.delete(recipeTagRelations).where(eq(recipeTagRelations.recipeId, recipeId))

  if (normalizedTags.length === 0) return

  await tx.insert(recipeTags)
    .values(normalizedTags.map(tag => ({
      name: tag.name,
      normalizedName: tag.normalizedName,
    })))
    .onConflictDoNothing({ target: recipeTags.normalizedName })

  const tagRows: { id: number; normalizedName: string }[] = await tx
    .select({
      id: recipeTags.id,
      normalizedName: recipeTags.normalizedName,
    })
    .from(recipeTags)
    .where(inArray(recipeTags.normalizedName, normalizedTags.map(tag => tag.normalizedName)))

  const tagIdByNormalizedName = new Map(tagRows.map(tag => [tag.normalizedName, tag.id]))
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
