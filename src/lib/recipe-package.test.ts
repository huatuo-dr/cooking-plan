import { describe, expect, it } from 'vitest'
import {
  MAX_INGREDIENTS_PER_RECIPE,
  MAX_RECIPES_PER_IMPORT,
  MAX_STEPS_PER_RECIPE,
  exportRecipePackage,
  getImportImageWarnings,
  getImportSourceWarning,
  parseRecipePackageJson,
  validateRecipePackage,
} from './recipe-package'

const baseRecipe = {
  id: 'cloud-1',
  title: '紫菜炒饭',
  imageUrl: undefined,
  ingredients: [{ name: '米饭', amount: undefined }],
  steps: [{ phase: 'cook' as const, text: '炒熟' }],
  tags: ['超级单品'],
  createdAt: '2026-07-22T00:00:00.000Z',
  source: 'cloud',
  isOfficial: true,
  isMine: false,
}

describe('recipe package import/export', () => {
  it('exports recipe content without account or runtime fields', () => {
    const recipePackage = exportRecipePackage([baseRecipe], new Date('2026-07-22T00:00:00.000Z'))

    expect(recipePackage).toEqual({
      version: 1,
      exportedAt: '2026-07-22T00:00:00.000Z',
      app: 'cooking-plan',
      recipes: [{
        title: '紫菜炒饭',
        imageUrl: null,
        ingredients: [{ name: '米饭', amount: null }],
        steps: [{ phase: 'cook', text: '炒熟' }],
        tags: ['超级单品'],
      }],
    })
    expect(JSON.stringify(recipePackage)).not.toContain('cloud-1')
    expect(JSON.stringify(recipePackage)).not.toContain('isOfficial')
  })

  it('parses and normalizes a valid recipe package json string', () => {
    const parsed = parseRecipePackageJson(JSON.stringify({
      version: 1,
      recipes: [{
        title: '  紫菜炒饭  ',
        imageUrl: null,
        ingredients: [{ name: '米饭', amount: null }],
        steps: [{ phase: 'cook', text: '炒熟' }],
        tags: [' 超级单品 ', '超级单品'],
      }],
    }))

    expect(parsed.recipes[0]).toMatchObject({
      title: '紫菜炒饭',
      imageUrl: null,
      ingredients: [{ name: '米饭', amount: null }],
      tags: ['超级单品'],
    })
  })

  it('accepts non cooking-plan app values and reports a source warning', () => {
    const parsed = parseRecipePackageJson(JSON.stringify({
      version: 1,
      app: 'other-app',
      recipes: [{
        title: '紫菜炒饭',
        ingredients: [{ name: '米饭' }],
        steps: [{ phase: 'cook', text: '炒熟' }],
        tags: [],
      }],
    }))

    expect(parsed.app).toBe('other-app')
    expect(getImportSourceWarning(parsed)).toBe('该文件来源不是 cooking-plan，请确认后导入')
  })

  it('does not report a source warning for cooking-plan packages', () => {
    const recipePackage = exportRecipePackage([baseRecipe], new Date('2026-07-22T00:00:00.000Z'))

    expect(getImportSourceWarning(recipePackage)).toBeNull()
  })

  it('rejects invalid json and oversized packages', () => {
    expect(() => parseRecipePackageJson('{')).toThrow('JSON 格式不合法')
    expect(() => validateRecipePackage({
      version: 1,
      recipes: Array.from({ length: MAX_RECIPES_PER_IMPORT + 1 }, (_, index) => ({
        title: `菜谱${index}`,
        ingredients: [{ name: '食材' }],
        steps: [{ phase: 'cook', text: '步骤' }],
        tags: [],
      })),
    })).toThrow(`一次最多导入 ${MAX_RECIPES_PER_IMPORT} 道菜谱`)
  })

  it('rejects blank text after trimming', () => {
    expect(() => validateRecipePackage({
      version: 1,
      recipes: [{
        title: '   ',
        ingredients: [{ name: '食材' }],
        steps: [{ phase: 'cook', text: '步骤' }],
        tags: [],
      }],
    })).toThrow('菜谱名称不能为空')

    expect(() => validateRecipePackage({
      version: 1,
      recipes: [{
        title: '菜谱',
        ingredients: [{ name: '   ' }],
        steps: [{ phase: 'cook', text: '步骤' }],
        tags: [],
      }],
    })).toThrow('食材名称不能为空')

    expect(() => validateRecipePackage({
      version: 1,
      recipes: [{
        title: '菜谱',
        ingredients: [{ name: '食材' }],
        steps: [{ phase: 'cook', text: '   ' }],
        tags: [],
      }],
    })).toThrow('步骤内容不能为空')
  })

  it('rejects recipes with too many ingredients or steps', () => {
    expect(() => validateRecipePackage({
      version: 1,
      recipes: [{
        title: '食材过多',
        ingredients: Array.from({ length: MAX_INGREDIENTS_PER_RECIPE + 1 }, (_, index) => ({ name: `食材${index}` })),
        steps: [{ phase: 'cook', text: '步骤' }],
        tags: [],
      }],
    })).toThrow(`每道菜最多 ${MAX_INGREDIENTS_PER_RECIPE} 个食材`)

    expect(() => validateRecipePackage({
      version: 1,
      recipes: [{
        title: '步骤过多',
        ingredients: [{ name: '食材' }],
        steps: Array.from({ length: MAX_STEPS_PER_RECIPE + 1 }, (_, index) => ({ phase: 'cook', text: `步骤${index}` })),
        tags: [],
      }],
    })).toThrow(`每道菜最多 ${MAX_STEPS_PER_RECIPE} 个步骤`)
  })

  it('reports image warnings for external urls and upload paths', () => {
    const warnings = getImportImageWarnings({
      version: 1,
      recipes: [
        { ...baseRecipe, title: '外部图', imageUrl: 'https://example.com/a.jpg' },
        { ...baseRecipe, title: '上传图', imageUrl: '/uploads/a.jpg' },
        { ...baseRecipe, title: '无图', imageUrl: undefined },
      ],
    })

    expect(warnings).toEqual([
      { recipeTitle: '外部图', imageUrl: 'https://example.com/a.jpg', type: 'external' },
      { recipeTitle: '上传图', imageUrl: '/uploads/a.jpg', type: 'upload' },
    ])
  })
})
