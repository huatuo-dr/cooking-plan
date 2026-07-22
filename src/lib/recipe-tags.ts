export const MAX_TAG_LENGTH = 20
export const MAX_TAGS_PER_RECIPE = 8

export interface NormalizedTag {
  name: string
  normalizedName: string
}

export interface RecipeTaggable {
  title: string
  ingredients?: { name: string }[]
  tags?: string[]
}

export function normalizeTagName(tag: string): string {
  return tag
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getNormalizedTagKey(tag: string): string {
  return normalizeTagName(tag).toLowerCase()
}

export function normalizeTags(tags: unknown): NormalizedTag[] {
  if (!Array.isArray(tags)) return []

  const result: NormalizedTag[] = []
  const seen = new Set<string>()

  for (const tag of tags) {
    if (typeof tag !== 'string') continue

    const name = normalizeTagName(tag)
    if (!name) continue
    if (name.length > MAX_TAG_LENGTH) {
      throw new Error(`标签不能超过 ${MAX_TAG_LENGTH} 个字符`)
    }

    const normalizedName = getNormalizedTagKey(name)
    if (normalizedName.length > MAX_TAG_LENGTH) {
      throw new Error(`标签规范化后不能超过 ${MAX_TAG_LENGTH} 个字符`)
    }
    if (seen.has(normalizedName)) continue

    seen.add(normalizedName)
    result.push({ name, normalizedName })
  }

  return result
}

export function normalizeRecipeTags(tags: unknown): NormalizedTag[] {
  const result = normalizeTags(tags)

  if (result.length > MAX_TAGS_PER_RECIPE) {
    throw new Error(`每个菜谱最多添加 ${MAX_TAGS_PER_RECIPE} 个标签`)
  }

  return result
}

export function getAvailableTags(recipes: RecipeTaggable[]): string[] {
  const tags: string[] = []
  const seen = new Set<string>()

  for (const recipe of recipes) {
    for (const tag of normalizeTags(recipe.tags || [])) {
      if (seen.has(tag.normalizedName)) continue
      seen.add(tag.normalizedName)
      tags.push(tag.name)
    }
  }

  return tags
}

export function filterRecipesByQueryAndTags<T extends RecipeTaggable>(
  recipes: T[],
  filters: { query: string; selectedTags: string[] }
): T[] {
  const query = normalizeTagName(filters.query).toLowerCase()
  const selectedTagKeys = normalizeTags(filters.selectedTags).map(tag => tag.normalizedName)

  return recipes.filter((recipe) => {
    const recipeTags = normalizeTags(recipe.tags || [])
    const recipeTagKeys = new Set(recipeTags.map(tag => tag.normalizedName))
    const matchesTags = selectedTagKeys.every(tag => recipeTagKeys.has(tag))
    if (!matchesTags) return false

    if (!query) return true

    const titleMatches = recipe.title.toLowerCase().includes(query)
    const ingredientMatches = (recipe.ingredients || []).some(ingredient =>
      ingredient.name.toLowerCase().includes(query)
    )
    const tagMatches = recipeTags.some(tag => tag.name.toLowerCase().includes(query))

    return titleMatches || ingredientMatches || tagMatches
  })
}
