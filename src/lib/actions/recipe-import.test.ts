import { describe, expect, it } from 'vitest'
import { resolveImportRecipeTitles, validateImportRequestBody } from './recipe-import'

describe('recipe import title conflict handling', () => {
  it('adds numeric suffixes without overwriting existing or same-batch titles', () => {
    const titles = resolveImportRecipeTitles(
      ['紫菜炒饭', '紫菜炒饭', '紫菜炒饭_2', '宫保鸡丁'],
      ['紫菜炒饭', '紫菜炒饭_2', '宫保鸡丁_2']
    )

    expect(titles).toEqual([
      '紫菜炒饭_3',
      '紫菜炒饭_4',
      '紫菜炒饭_2_2',
      '宫保鸡丁',
    ])
  })

  it('rejects unsupported conflict strategies', () => {
    expect(() => validateImportRequestBody({
      recipePackage: {
        version: 1,
        recipes: [{
          title: '紫菜炒饭',
          ingredients: [{ name: '米饭' }],
          steps: [{ phase: 'cook', text: '炒熟' }],
          tags: [],
        }],
      },
      conflictStrategy: 'replace',
    })).toThrow('仅支持 rename 冲突策略')
  })
})
