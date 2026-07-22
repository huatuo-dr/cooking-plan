import { NextRequest, NextResponse } from 'next/server'
import { getRecipe, createRecipe } from '@/lib/actions/recipes'
import { getSession } from '@/lib/auth'
import { copyRecipeSchema } from '@/lib/validators'

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const body = await request.json()
    const parseResult = copyRecipeSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: '参数错误' },
        { status: 400 }
      )
    }

    const originalRecipe = await getRecipe(parseResult.data.fromId)
    if (!originalRecipe) {
      return NextResponse.json({ error: '原菜谱不存在或无权访问' }, { status: 404 })
    }

    const newRecipe = await createRecipe({
      title: `${originalRecipe.title} (副本)`,
      imageUrl: originalRecipe.imageUrl || undefined,
      ingredients: originalRecipe.ingredients.map((i: any) => ({
        name: i.name,
        amount: i.amount,
      })),
      steps: originalRecipe.steps.map((s: any) => ({
        phase: s.phase,
        text: s.text,
      })),
      tags: originalRecipe.tags || [],
    })

    return NextResponse.json(newRecipe)
  } catch (error: any) {
    const msg = error?.message || '复制失败'
    const isUserError = ['请先登录'].some(k => msg.includes(k))
    return NextResponse.json(
      { error: isUserError ? msg : '复制失败' },
      { status: isUserError ? 401 : 500 }
    )
  }
}
