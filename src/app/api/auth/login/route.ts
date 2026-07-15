import { NextRequest, NextResponse } from 'next/server'
import { login } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // #7 rate-limit：每个 IP 每分钟最多 5 次登录尝试
    const ip = getClientIP(request)
    const limit = rateLimit(`login:${ip}`, { windowSec: 60, max: 5 })
    if (!limit.success) {
      const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: `尝试过于频繁，请 ${retryAfter} 秒后重试` },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) }
        }
      )
    }

    const body = await request.json()
    const result = await login(body)

    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: '登录失败' }, { status: 500 })
  }
}
