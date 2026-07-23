import path from 'path'

import { unlink } from 'fs/promises'

const MANAGED_UPLOAD_URL_PATTERN = /^\/uploads\/([A-Za-z0-9_-]{16}\.(?:jpg|png|webp))$/

export type RecipeImageCleanupResult =
  | 'deleted'
  | 'skipped-unmanaged'
  | 'skipped-in-use'
  | 'skipped-missing'
  | 'skipped-error'

export function getManagedUploadFilename(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null

  let decoded: string
  try {
    decoded = decodeURIComponent(imageUrl)
  } catch {
    return null
  }

  if (decoded !== imageUrl) return null
  if (decoded.includes('\\') || decoded.includes('..')) return null

  const match = MANAGED_UPLOAD_URL_PATTERN.exec(decoded)
  return match?.[1] ?? null
}

export async function cleanupUnusedRecipeImage(
  imageUrl: string | null | undefined,
  options: {
    hasReferences: (imageUrl: string) => Promise<boolean>
    unlinkFile?: (filepath: string) => Promise<void>
    cwd?: string
  }
): Promise<RecipeImageCleanupResult> {
  const filename = getManagedUploadFilename(imageUrl)
  if (!filename || !imageUrl) return 'skipped-unmanaged'

  const uploadDir = path.join(options.cwd || process.cwd(), 'public', 'uploads')
  const filepath = path.join(uploadDir, filename)
  const unlinkFile = options.unlinkFile || unlink

  try {
    if (await options.hasReferences(imageUrl)) {
      return 'skipped-in-use'
    }

    await unlinkFile(filepath)
    return 'deleted'
  } catch (error: any) {
    if (error?.code === 'ENOENT') return 'skipped-missing'
    console.error('Recipe image cleanup failed:', error)
    return 'skipped-error'
  }
}
