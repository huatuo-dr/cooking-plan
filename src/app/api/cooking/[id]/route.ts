import { NextRequest, NextResponse } from 'next/server'
import { getCookingSession, deleteCookingSession } from '@/lib/actions/cooking'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCookingSession(Number((await params).id))
    if (!session) {
      return NextResponse.json({ error: '未找到该计划' }, { status: 404 })
    }
    return NextResponse.json(session)
  } catch (error) {
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await deleteCookingSession(Number((await params).id))
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '删除失败' }, { status: 500 })
  }
}
