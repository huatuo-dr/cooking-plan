import { describe, expect, it } from 'vitest'
import {
  getNextRecipeImageUrl,
  shouldCleanupOldRecipeImage,
} from './recipe-update'

describe('recipe image update semantics', () => {
  it('keeps the old image when update payload omits imageUrl', () => {
    const input = { title: '番茄炒蛋' }

    expect(getNextRecipeImageUrl(input, '/uploads/abcdefghijklmnop.jpg')).toBe('/uploads/abcdefghijklmnop.jpg')
  })

  it('keeps the old image when update payload has imageUrl undefined', () => {
    const input = { title: '番茄炒蛋', imageUrl: undefined }

    expect(getNextRecipeImageUrl(input, '/uploads/abcdefghijklmnop.jpg')).toBe('/uploads/abcdefghijklmnop.jpg')
  })

  it('clears the image when update payload sends null', () => {
    const input = { title: '番茄炒蛋', imageUrl: null }

    expect(getNextRecipeImageUrl(input, '/uploads/abcdefghijklmnop.jpg')).toBeNull()
  })

  it('sets a replacement image when update payload sends a string', () => {
    const input = { title: '番茄炒蛋', imageUrl: '/uploads/ponmlkjihgfedcba.webp' }

    expect(getNextRecipeImageUrl(input, '/uploads/abcdefghijklmnop.jpg')).toBe('/uploads/ponmlkjihgfedcba.webp')
  })

  it('cleans up only when an existing old image changes', () => {
    expect(shouldCleanupOldRecipeImage('/uploads/abcdefghijklmnop.jpg', null)).toBe(true)
    expect(shouldCleanupOldRecipeImage('/uploads/abcdefghijklmnop.jpg', '/uploads/ponmlkjihgfedcba.webp')).toBe(true)
    expect(shouldCleanupOldRecipeImage('/uploads/abcdefghijklmnop.jpg', '/uploads/abcdefghijklmnop.jpg')).toBe(false)
    expect(shouldCleanupOldRecipeImage(null, '/uploads/ponmlkjihgfedcba.webp')).toBe(false)
  })
})
