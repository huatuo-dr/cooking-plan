import { readFile } from 'fs/promises'
import path from 'path'

const UPLOAD_FILENAME_PATTERN = /^[A-Za-z0-9_-]{16}\.(jpg|png|webp)$/

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export type UploadedImageReadResult =
  | { status: 'ok'; body: Buffer; contentType: string }
  | { status: 'invalid' }
  | { status: 'missing' }

export function getUploadedImageContentType(filename: string): string | null {
  const match = UPLOAD_FILENAME_PATTERN.exec(filename)
  if (!match) return null

  return CONTENT_TYPES[match[1]] ?? null
}

export async function readUploadedImage(
  filename: string,
  uploadDir = path.join(process.cwd(), 'public', 'uploads')
): Promise<UploadedImageReadResult> {
  const contentType = getUploadedImageContentType(filename)
  if (!contentType) return { status: 'invalid' }

  try {
    const body = await readFile(path.join(uploadDir, filename))
    return { status: 'ok', body, contentType }
  } catch (error: any) {
    if (error?.code === 'ENOENT') return { status: 'missing' }
    console.error('Uploaded image read failed:', error)
    return { status: 'missing' }
  }
}
