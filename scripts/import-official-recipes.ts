import 'dotenv/config'
import { readFile } from 'fs/promises'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/db'
import { ingredients, recipes, steps, users } from '../src/db/schema'
import { parseOfficialRecipesFromHtml } from './official-recipes-parser'

const DEFAULT_HTML_PATH = '/mnt/d/UbuntuDisk/菜谱.html'

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

  const result = await db.transaction(async (tx) => {
    const [admin] = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1)

    if (!admin) {
      throw new Error(`未找到管理员账号：${adminEmail}`)
    }

    const existingOfficialRecipes = await tx
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.userId, admin.id))

    const existingIds = existingOfficialRecipes.map((recipe) => recipe.id)
    if (existingIds.length > 0) {
      await tx.delete(ingredients).where(inArray(ingredients.recipeId, existingIds))
      await tx.delete(steps).where(inArray(steps.recipeId, existingIds))
      await tx.delete(recipes).where(inArray(recipes.id, existingIds))
    }

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
        .returning({ id: recipes.id })

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
    }

    return {
      adminEmail: admin.email,
      deletedCount: existingIds.length,
      insertedCount: parsedRecipes.length,
      titles: parsedRecipes.map((recipe) => recipe.title),
    }
  })

  console.log(`官方菜谱导入完成：删除 ${result.deletedCount} 条，新增 ${result.insertedCount} 条`)
  console.log(`归属管理员：${result.adminEmail}`)
  console.log(`首尾菜谱：${result.titles[0]} / ${result.titles.at(-1)}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
