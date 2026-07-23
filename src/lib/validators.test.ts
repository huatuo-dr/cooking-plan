import { describe, expect, it } from 'vitest'
import { recipeSchema, recipeUpdateSchema } from './validators'

const validRecipe = {
  title: '番茄炒蛋',
  ingredients: [{ name: '番茄', amount: '2个' }],
  steps: [{ phase: 'cook' as const, text: '炒熟' }],
}

describe('recipeSchema tags', () => {
  it('normalizes optional recipe tags on the server boundary', () => {
    const result = recipeSchema.parse({
      ...validRecipe,
      tags: [' 快手菜 ', '快手菜', '鸡蛋'],
    })

    expect(result.tags).toEqual(['快手菜', '鸡蛋'])
  })

  it('rejects oversized tag lists', () => {
    expect(() => recipeSchema.parse({
      ...validRecipe,
      tags: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    })).toThrow('每个菜谱最多添加 8 个标签')
  })

  it('does not default missing update tags to an empty list', () => {
    const result = recipeUpdateSchema.parse(validRecipe)

    expect(result.tags).toBeUndefined()
  })

  it('preserves null image in update payloads as a remove-image command', () => {
    const result = recipeUpdateSchema.parse({
      title: '紫菜炒饭',
      imageUrl: null,
      ingredients: [{ name: '米饭', amount: null }],
      steps: [{ phase: 'cook', text: '炒米饭' }],
      tags: ['主食'],
    })

    expect(result.imageUrl).toBeNull()
    expect(result.ingredients).toEqual([{ name: '米饭', amount: undefined }])
    expect(result.tags).toEqual(['主食'])
  })

  it('does not change image when update payload omits imageUrl', () => {
    const result = recipeUpdateSchema.parse(validRecipe)

    expect(result.imageUrl).toBeUndefined()
  })
})
