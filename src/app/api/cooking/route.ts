import { NextResponse } from 'next/server'
import { getCookingSessions } from '@/lib/actions/cooking'

export async function GET() {
  try {
    const sessions = await getCookingSessions()
    return NextResponse.json(sessions)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '获取失败' }, { status: 500 })
  }
}
