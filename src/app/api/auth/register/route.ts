import { NextRequest, NextResponse } from 'next/server'
import { register } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // #7 rate-limit：每个 IP 每小时最多 3 次注册
    const ip = getClientIP(request)
    const limit = rateLimit(`register:${ip}`, { windowSec: 3600, max: 3 })
    if (!limit.success) {
      const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: `注册尝试过多，请 ${Math.ceil(retryAfter / 60)} 分钟后重试` },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) }
        }
      )
    }

    const body = await request.json()
    const result = await register(body)

    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: '注册失败' }, { status: 500 })
  }
}
