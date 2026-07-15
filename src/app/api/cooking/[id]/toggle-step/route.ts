import { NextRequest, NextResponse } from 'next/server'
import { toggleStepDone } from '@/lib/actions/cooking'
import { toggleSchema } from '@/lib/validators'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const parseResult = toggleSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || '参数错误' },
        { status: 400 }
      )
    }
    await toggleStepDone(parseResult.data.id, parseResult.data.done)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    // G 生产环境错误脱敏
    const msg = error?.message || '保存失败'
    const isUserError = ['无权操作', '步骤不存在', '请先登录'].some(k => msg.includes(k))
    return NextResponse.json(
      { error: isUserError ? msg : '保存失败' },
      { status: isUserError ? 403 : 500 }
    )
  }
}
