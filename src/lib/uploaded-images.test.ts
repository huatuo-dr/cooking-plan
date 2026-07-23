import { mkdtemp, rm, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import { readUploadedImage } from './uploaded-images'

let tempDir: string | null = null

async function createTempUploadsDir() {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'cooking-plan-uploads-'))
  return tempDir
}

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})

describe('readUploadedImage', () => {
  it('reads a managed uploaded image and returns its content type', async () => {
    const uploadDir = await createTempUploadsDir()
    await writeFile(path.join(uploadDir, 'abcdefghijklmnop.png'), Buffer.from([1, 2, 3]))

    const result = await readUploadedImage('abcdefghijklmnop.png', uploadDir)

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.contentType).toBe('image/png')
      expect([...result.body]).toEqual([1, 2, 3])
    }
  })

  it('rejects unsafe filenames before reading from disk', async () => {
    const uploadDir = await createTempUploadsDir()

    await expect(readUploadedImage('../abcdefghijklmnop.png', uploadDir)).resolves.toEqual({
      status: 'invalid',
    })
    await expect(readUploadedImage('abcdefghijklmnop.gif', uploadDir)).resolves.toEqual({
      status: 'invalid',
    })
    await expect(readUploadedImage('abcdef%2Fghijklmnop.png', uploadDir)).resolves.toEqual({
      status: 'invalid',
    })
  })

  it('returns missing for valid managed filenames that are not on disk', async () => {
    const uploadDir = await createTempUploadsDir()

    await expect(readUploadedImage('abcdefghijklmnop.webp', uploadDir)).resolves.toEqual({
      status: 'missing',
    })
  })
})
