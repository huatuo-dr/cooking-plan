import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import {
  cleanRecipeText,
  parseOfficialRecipesFromHtml,
} from './official-recipes-parser'

describe('official recipe HTML parser', () => {
  it('extracts recipes from the exported HTML outline', () => {
    const html = readFileSync('/mnt/d/UbuntuDisk/菜谱.html', 'utf8')

    const recipes = parseOfficialRecipesFromHtml(html)

    expect(recipes).toHaveLength(36)
    expect(recipes[0]).toMatchObject({
      title: '紫菜炒饭',
      ingredients: [
        { name: '米饭' },
        { name: '紫菜' },
        { name: '鸡蛋' },
        { name: '午餐肉' },
      ],
    })
    expect(recipes[0].steps.map((step) => step.text)).toContain('炒米饭，蚝油、生抽')
    expect(recipes.at(-1)?.title).toBe('新疆手抓饭')
  })

  it('cleans obvious typos without changing recipe structure', () => {
    expect(cleanRecipeText('炒米饭，耗油、生抽')).toBe('炒米饭，蚝油、生抽')
    expect(cleanRecipeText('姜蒜切沫，泡椒切圈')).toBe('姜蒜切末，泡椒切圈')
    expect(cleanRecipeText('淋上热油在葱姜丝上，到上料汁')).toBe('淋上热油在葱姜丝上，倒上料汁')
    expect(cleanRecipeText('绿泡10分钟')).toBe('绿豆泡10分钟')
    expect(cleanRecipeText('洋葱半颗，片2片')).toBe('洋葱半颗，姜片2片')
  })
})
