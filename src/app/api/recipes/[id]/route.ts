import { NextRequest, NextResponse } from 'next/server'
import { getRecipe, updateRecipe, deleteRecipe } from '@/lib/actions/recipes'
import { recipeUpdateSchema } from '@/lib/validators'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const recipe = await getRecipe(Number((await params).id))
    if (!recipe) {
      return NextResponse.json({ error: '未找到或无权访问' }, { status: 404 })
    }
    return NextResponse.json(recipe)
  } catch (error) {
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()

    const parseResult = recipeUpdateSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || '输入不合法' },
        { status: 400 }
      )
    }

    await updateRecipe(Number((await params).id), parseResult.data)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    // G 错误脱敏
    const msg = error?.message || ''
    const isUserError = ['请先登录', '没有权限', '不存在'].some(k => msg.includes(k))
    const status = msg.includes('请先登录') ? 401 : (msg.includes('权限') || msg.includes('不存在') ? 403 : 500)
    return NextResponse.json(
      { error: isUserError ? msg : '更新失败' },
      { status }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await deleteRecipe(Number((await params).id))
    return NextResponse.json({ success: true })
  } catch (error: any) {
    const msg = error?.message || ''
    const isUserError = ['请先登录', '没有权限', '不存在'].some(k => msg.includes(k))
    const status = msg.includes('请先登录') ? 401 : (msg.includes('权限') || msg.includes('不存在') ? 403 : 500)
    return NextResponse.json(
      { error: isUserError ? msg : '删除失败' },
      { status }
    )
  }
}
