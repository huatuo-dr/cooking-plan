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

  it('extracts recipes from the second exported HTML outline', () => {
    const html = readFileSync('/mnt/d/UbuntuDisk/菜谱2.html', 'utf8')

    const recipes = parseOfficialRecipesFromHtml(html)
    const seafood = recipes.find((recipe) => recipe.title === '捞汁小海鲜')
    const beef = recipes.find((recipe) => recipe.title === '西红柿炖牛腩')

    expect(recipes).toHaveLength(13)
    expect(seafood?.steps.map((step) => step.text)).toContain('8分钟，海螺')
    expect(beef?.ingredients.map((ingredient) => ingredient.name)).toContain('花椒')
    expect(beef?.steps.map((step) => step.text)).toContain('加入1勺料酒、1勺番茄酱、1勺生抽、1勺老抽，一点黑胡椒')
  })

  it('cleans obvious typos without changing recipe structure', () => {
    expect(cleanRecipeText('炒米饭，耗油、生抽')).toBe('炒米饭，蚝油、生抽')
    expect(cleanRecipeText('姜蒜切沫，泡椒切圈')).toBe('姜蒜切末，泡椒切圈')
    expect(cleanRecipeText('淋上热油在葱姜丝上，到上料汁')).toBe('淋上热油在葱姜丝上，倒上料汁')
    expect(cleanRecipeText('绿泡10分钟')).toBe('绿豆泡10分钟')
    expect(cleanRecipeText('洋葱半颗，片2片')).toBe('洋葱半颗，姜片2片')
    expect(cleanRecipeText('料汁儿：生抽2勺')).toBe('料汁：生抽2勺')
    expect(cleanRecipeText('撇如鸡蛋液定型')).toBe('淋入鸡蛋液定型')
    expect(cleanRecipeText('鸡皮面冲下')).toBe('鸡皮面朝下')
    expect(cleanRecipeText('根部冲上20分钟')).toBe('根部朝上20分钟')
    expect(cleanRecipeText('关火再闷15分钟')).toBe('关火再焖15分钟')
    expect(cleanRecipeText('准备：鸡腿，葱香菜')).toBe('准备：鸡腿，葱、香菜')
    expect(cleanRecipeText('放入高压锅，加入，姜片')).toBe('放入高压锅，加入姜片')
    expect(cleanRecipeText('准备：鸡腿2，鸡蛋2')).toBe('准备：鸡腿2个，鸡蛋2个')
  })
})
