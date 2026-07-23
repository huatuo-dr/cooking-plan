import { describe, expect, it, vi } from 'vitest'
import {
  getManagedUploadFilename,
  cleanupUnusedRecipeImage,
} from './recipe-images'

describe('getManagedUploadFilename', () => {
  it('accepts only upload URLs produced by the current upload endpoint', () => {
    expect(getManagedUploadFilename('/uploads/abcdefghijklmnop.jpg')).toBe('abcdefghijklmnop.jpg')
    expect(getManagedUploadFilename('/uploads/abcdEFGH1234_-xy.png')).toBe('abcdEFGH1234_-xy.png')
    expect(getManagedUploadFilename('/uploads/abcdEFGH1234_-xy.webp')).toBe('abcdEFGH1234_-xy.webp')
  })

  it('strictly rejects unsafe or unmanaged image URLs', () => {
    expect(getManagedUploadFilename('https://example.com/a.jpg')).toBeNull()
    expect(getManagedUploadFilename('/uploads/../abcdefghijklmnop.jpg')).toBeNull()
    expect(getManagedUploadFilename('/uploads/nested/abcdefghijklmnop.jpg')).toBeNull()
    expect(getManagedUploadFilename('/uploads/abcdefghijklmno.jpg')).toBeNull()
    expect(getManagedUploadFilename('/uploads/abcdefghijklmnop.gif')).toBeNull()
    expect(getManagedUploadFilename('/uploads/abcdef%2Fghijklmnop.jpg')).toBeNull()
    expect(getManagedUploadFilename('/uploads/abcdef\\ghijklmnop.jpg')).toBeNull()
  })
})

describe('cleanupUnusedRecipeImage', () => {
  it('skips unmanaged image URLs', async () => {
    const hasReferences = vi.fn()
    const unlinkFile = vi.fn()

    const result = await cleanupUnusedRecipeImage('https://example.com/a.jpg', {
      hasReferences,
      unlinkFile,
    })

    expect(result).toBe('skipped-unmanaged')
    expect(hasReferences).not.toHaveBeenCalled()
    expect(unlinkFile).not.toHaveBeenCalled()
  })

  it('does not delete an upload while another recipe still references it', async () => {
    const hasReferences = vi.fn().mockResolvedValue(true)
    const unlinkFile = vi.fn()

    const result = await cleanupUnusedRecipeImage('/uploads/abcdefghijklmnop.jpg', {
      hasReferences,
      unlinkFile,
    })

    expect(result).toBe('skipped-in-use')
    expect(hasReferences).toHaveBeenCalledWith('/uploads/abcdefghijklmnop.jpg')
    expect(unlinkFile).not.toHaveBeenCalled()
  })

  it('treats reference query failures as non-blocking cleanup errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const hasReferences = vi.fn().mockRejectedValue(new Error('database unavailable'))
    const unlinkFile = vi.fn()

    try {
      const result = await cleanupUnusedRecipeImage('/uploads/abcdefghijklmnop.jpg', {
        hasReferences,
        unlinkFile,
      })

      expect(result).toBe('skipped-error')
      expect(consoleError).toHaveBeenCalled()
      expect(unlinkFile).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('deletes an upload file when no recipes still reference it', async () => {
    const hasReferences = vi.fn().mockResolvedValue(false)
    const unlinkFile = vi.fn().mockResolvedValue(undefined)

    const result = await cleanupUnusedRecipeImage('/uploads/abcdefghijklmnop.jpg', {
      hasReferences,
      unlinkFile,
      cwd: '/app',
    })

    expect(result).toBe('deleted')
    expect(unlinkFile).toHaveBeenCalledWith('/app/public/uploads/abcdefghijklmnop.jpg')
  })
})
