export type RecipeImageUpdateInput = {
  imageUrl?: string | null
  [key: string]: unknown
}

export function getNextRecipeImageUrl(
  input: RecipeImageUpdateInput,
  oldImageUrl: string | null
): string | null {
  if (input.imageUrl !== undefined) {
    return input.imageUrl ?? null
  }

  return oldImageUrl
}

export function shouldCleanupOldRecipeImage(
  oldImageUrl: string | null | undefined,
  nextImageUrl: string | null | undefined
): oldImageUrl is string {
  return !!oldImageUrl && oldImageUrl !== nextImageUrl
}
