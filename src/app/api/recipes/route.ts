import { NextRequest, NextResponse } from 'next/server'
import { getRecipes, createRecipe } from '@/lib/actions/recipes'
import { recipeSchema } from '@/lib/validators'

export async function GET() {
  try {
    const recipes = await getRecipes()
    return NextResponse.json(recipes)
  } catch (error) {
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parseResult = recipeSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || '输入不合法' },
        { status: 400 }
      )
    }

    const recipe = await createRecipe(parseResult.data)
    return NextResponse.json(recipe)
  } catch (error: any) {
    // G 错误脱敏：用户友好错误透传，DB 错误统一返回
    const msg = error?.message || ''
    const isUserError = ['请先登录', '没有权限', '不存在'].some(k => msg.includes(k))
    return NextResponse.json(
      { error: isUserError ? msg : '创建失败' },
      { status: isUserError ? 403 : 500 }
    )
  }
}
