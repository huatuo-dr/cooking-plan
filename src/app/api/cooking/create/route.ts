import { NextRequest, NextResponse } from 'next/server'
import { createCookingSession } from '@/lib/actions/cooking'
import { cookingCreateSchema } from '@/lib/validators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // #4 服务端 zod 校验
    const parseResult = cookingCreateSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || '输入不合法' },
        { status: 400 }
      )
    }

    const session = await createCookingSession(parseResult.data)
    return NextResponse.json(session)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '创建失败' }, { status: 400 })
  }
}
