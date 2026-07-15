import { NextRequest, NextResponse } from 'next/server'
import { getInviteCodes, generateInviteCode } from '@/lib/actions/invitation'
import { generateInviteSchema } from '@/lib/validators'

export async function GET() {
  try {
    const codes = await getInviteCodes()
    return NextResponse.json(codes)
  } catch (error: any) {
    const msg = error?.message || '获取失败'
    const isUserError = ['请先登录', '管理员'].some(k => msg.includes(k))
    return NextResponse.json(
      { error: isUserError ? msg : '获取失败' },
      { status: isUserError ? 401 : 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parseResult = generateInviteSchema.safeParse({
      maxUses: Number(body.maxUses) || 1
    })
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || '参数错误' },
        { status: 400 }
      )
    }
    const code = await generateInviteCode(parseResult.data.maxUses)
    return NextResponse.json(code)
  } catch (error: any) {
    const msg = error?.message || '生成失败'
    const isUserError = ['请先登录', '管理员'].some(k => msg.includes(k))
    return NextResponse.json(
      { error: isUserError ? msg : '生成失败' },
      { status: isUserError ? 401 : 500 }
    )
  }
}
