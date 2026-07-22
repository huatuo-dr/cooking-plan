import 'dotenv/config'
import { readFile } from 'fs/promises'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../src/db'
import {
  ingredients,
  recipeTagRelations,
  recipeTags,
  recipes,
  steps,
  users,
} from '../src/db/schema'
import { normalizeRecipeTags } from '../src/lib/recipe-tags'
import { parseOfficialRecipesFromHtml } from './official-recipes-parser'

const DEFAULT_HTML_PATH = '/mnt/d/UbuntuDisk/菜谱2.html'

const tagsByTitle: Record<string, string[]> = {
  滑蛋鸡腿饭: ['荤菜', '超级单品'],
  小龙虾: ['热菜', '荤菜'],
  高压锅红烧猪蹄: ['热菜', '荤菜'],
  捞汁小海鲜: ['凉菜', '荤菜'],
  水煮肉片: ['热菜', '荤菜'],
  芙蓉蔬菜汤: ['汤', '素菜'],
  可乐鸡翅: ['热菜', '荤菜'],
  西红柿炖牛腩: ['热菜', '荤菜'],
  手撕鸡: ['凉菜', '荤菜'],
  油麦菜: ['热菜', '素菜'],
  红枣银耳汤: ['汤', '素菜'],
  大盘鸡: ['热菜', '荤菜', '超级单品'],
  三鲜汤: ['汤', '荤菜'],
}

async function main() {
  const htmlPath = process.argv[2] || DEFAULT_HTML_PATH
  const adminEmail = process.env.ADMIN_EMAIL

  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL 环境变量未配置，无法确定官方菜谱归属管理员')
  }

  const html = await readFile(htmlPath, 'utf8')
  const parsedRecipes = parseOfficialRecipesFromHtml(html)
  if (parsedRecipes.length === 0) {
    throw new Error(`未从 ${htmlPath} 解析出菜谱`)
  }

  const missingTagRecipes = parsedRecipes.filter((recipe) => !tagsByTitle[recipe.title])
  if (missingTagRecipes.length > 0) {
    throw new Error(`以下菜谱未配置标签：${missingTagRecipes.map((recipe) => recipe.title).join('、')}`)
  }

  const result = await db.transaction(async (tx) => {
    const [admin] = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1)

    if (!admin) {
      throw new Error(`未找到管理员账号：${adminEmail}`)
    }

    const titles = parsedRecipes.map((recipe) => recipe.title)
    const existingOfficialRecipes = await tx
      .select({ id: recipes.id, title: recipes.title })
      .from(recipes)
      .where(and(eq(recipes.userId, admin.id), inArray(recipes.title, titles)))

    const existingIds = existingOfficialRecipes.map((recipe) => recipe.id)
    if (existingIds.length > 0) {
      await tx.delete(recipeTagRelations).where(inArray(recipeTagRelations.recipeId, existingIds))
      await tx.delete(ingredients).where(inArray(ingredients.recipeId, existingIds))
      await tx.delete(steps).where(inArray(steps.recipeId, existingIds))
      await tx.delete(recipes).where(inArray(recipes.id, existingIds))
    }

    const insertedTitles: string[] = []
    const baseTime = Date.now()

    for (const [recipeIndex, parsedRecipe] of parsedRecipes.entries()) {
      const timestamp = new Date(baseTime + recipeIndex)
      const [insertedRecipe] = await tx
        .insert(recipes)
        .values({
          userId: admin.id,
          title: parsedRecipe.title,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .returning({ id: recipes.id, title: recipes.title })

      insertedTitles.push(insertedRecipe.title)

      if (parsedRecipe.ingredients.length > 0) {
        await tx.insert(ingredients).values(
          parsedRecipe.ingredients.map((ingredient, index) => ({
            recipeId: insertedRecipe.id,
            name: ingredient.name,
            amount: ingredient.amount,
            sort: index,
          }))
        )
      }

      if (parsedRecipe.steps.length > 0) {
        await tx.insert(steps).values(
          parsedRecipe.steps.map((step, index) => ({
            recipeId: insertedRecipe.id,
            phase: step.phase,
            text: step.text,
            sort: index,
          }))
        )
      }

      await syncRecipeTags(tx, insertedRecipe.id, tagsByTitle[parsedRecipe.title])
    }

    return {
      adminEmail: admin.email,
      replacedTitles: existingOfficialRecipes.map((recipe) => recipe.title),
      insertedTitles,
    }
  })

  console.log(`官方菜谱追加导入完成：新增 ${result.insertedTitles.length} 条，替换 ${result.replacedTitles.length} 条`)
  console.log(`归属管理员：${result.adminEmail}`)
  console.log(`新增菜谱：${result.insertedTitles.join('、')}`)
  if (result.replacedTitles.length > 0) {
    console.log(`替换菜谱：${result.replacedTitles.join('、')}`)
  }
  process.exit(0)
}

async function syncRecipeTags(tx: any, recipeId: number, tags: string[]) {
  const normalizedTags = normalizeRecipeTags(tags)
  if (normalizedTags.length === 0) return

  await tx.insert(recipeTags)
    .values(normalizedTags.map((tag) => ({
      name: tag.name,
      normalizedName: tag.normalizedName,
    })))
    .onConflictDoNothing({ target: recipeTags.normalizedName })

  const tagRows: { id: number; normalizedName: string }[] = await tx
    .select({
      id: recipeTags.id,
      normalizedName: recipeTags.normalizedName,
    })
    .from(recipeTags)
    .where(inArray(recipeTags.normalizedName, normalizedTags.map((tag) => tag.normalizedName)))

  const tagIdByNormalizedName = new Map(tagRows.map((tag) => [tag.normalizedName, tag.id]))
  const relations = normalizedTags
    .map((tag) => {
      const tagId = tagIdByNormalizedName.get(tag.normalizedName)
      return tagId ? { recipeId, tagId } : null
    })
    .filter((relation): relation is { recipeId: number; tagId: number } => relation !== null)

  if (relations.length > 0) {
    await tx.insert(recipeTagRelations)
      .values(relations)
      .onConflictDoNothing()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
