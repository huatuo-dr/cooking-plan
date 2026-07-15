import { NextRequest, NextResponse } from 'next/server'
import { revokeInviteCode } from '@/lib/actions/invitation'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await revokeInviteCode(Number((await params).id))
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '撤销失败' }, { status: 401 })
  }
}
