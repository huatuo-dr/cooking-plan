import { describe, expect, it } from 'vitest'
import {
  filterRecipesByQueryAndTags,
  getAvailableTags,
  normalizeTagName,
  normalizeRecipeTags,
  normalizeTags,
  type RecipeTaggable,
} from './recipe-tags'

const recipes: RecipeTaggable[] = [
  {
    title: '紫菜炒饭',
    ingredients: [{ name: '米饭' }, { name: '紫菜' }, { name: '鸡蛋' }],
    tags: ['主食', '鸡蛋'],
  },
  {
    title: '凉拌菠菜',
    ingredients: [{ name: '菠菜' }, { name: '花生' }],
    tags: ['凉菜', '素菜'],
  },
  {
    title: '山药牛肉汤',
    ingredients: [{ name: '山药' }, { name: '牛肉' }],
    tags: ['汤', '牛肉'],
  },
]

describe('recipe tags', () => {
  it('normalizes tags consistently for client and server callers', () => {
    expect(normalizeTagName('　 牛   肉  ')).toBe('牛 肉')
    expect(normalizeTags([' 主食 ', '主食', '', '  ', 'Dinner', 'dinner'])).toEqual([
      { name: '主食', normalizedName: '主食' },
      { name: 'Dinner', normalizedName: 'dinner' },
    ])
  })

  it('uses locale-stable lowercase keys', () => {
    expect(normalizeTags(['İSTANBUL'])[0].normalizedName).toBe('i̇stanbul')
  })

  it('normalizes more than one recipe worth of tags for global filtering', () => {
    expect(normalizeTags(['1', '2', '3', '4', '5', '6', '7', '8', '9'])).toHaveLength(9)
  })

  it('limits tag count only when normalizing tags for one recipe', () => {
    expect(() => normalizeRecipeTags(['1', '2', '3', '4', '5', '6', '7', '8', '9'])).toThrow('每个菜谱最多添加 8 个标签')
  })

  it('limits tag length before and after normalization', () => {
    expect(() => normalizeTags(['一二三四五六七八九十一二三四五六七八九十一'])).toThrow('标签不能超过 20 个字符')
    expect(() => normalizeTags(['İ'.repeat(20)])).toThrow('标签规范化后不能超过 20 个字符')
  })

  it('builds available tags from visible recipes only', () => {
    expect(getAvailableTags(recipes)).toEqual(['主食', '鸡蛋', '凉菜', '素菜', '汤', '牛肉'])
  })

  it('filters recipes by title, ingredient, tag, and all selected tags', () => {
    expect(filterRecipesByQueryAndTags(recipes, { query: '紫菜', selectedTags: [] }).map(r => r.title)).toEqual(['紫菜炒饭'])
    expect(filterRecipesByQueryAndTags(recipes, { query: '花生', selectedTags: [] }).map(r => r.title)).toEqual(['凉拌菠菜'])
    expect(filterRecipesByQueryAndTags(recipes, { query: '牛肉', selectedTags: ['汤'] }).map(r => r.title)).toEqual(['山药牛肉汤'])
    expect(filterRecipesByQueryAndTags(recipes, { query: '', selectedTags: ['汤', '牛肉'] }).map(r => r.title)).toEqual(['山药牛肉汤'])
    expect(filterRecipesByQueryAndTags(recipes, { query: '', selectedTags: ['汤', '素菜'] })).toEqual([])
    expect(filterRecipesByQueryAndTags(recipes, { query: '', selectedTags: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] })).toEqual([])
  })
})
