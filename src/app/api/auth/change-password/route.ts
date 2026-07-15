import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { getSession, setSessionCookie, SessionUser } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // #7 rate-limit：每个 IP 每小时最多 5 次改密尝试
    const ip = getClientIP(request)
    const limit = rateLimit(`change-password:${ip}`, { windowSec: 3600, max: 5 })
    if (!limit.success) {
      const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: `尝试过于频繁，请 ${Math.ceil(retryAfter / 60)} 分钟后重试` },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) }
        }
      )
    }

    const body = await request.json()
    const { oldPassword, newPassword } = body

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: '请填写完整' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: '新密码长度至少 6 位' }, { status: 400 })
    }

    // 获取当前用户
    const user = await db.select().from(users).where(eq(users.id, session.id)).limit(1)
    if (user.length === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 验证旧密码
    const isValid = await bcrypt.compare(oldPassword, user[0].passwordHash)
    if (!isValid) {
      return NextResponse.json({ error: '原密码错误' }, { status: 400 })
    }

    // 更新密码 + 更新 passwordChangedAt（#8 让旧 session 失效）
    const newHash = await bcrypt.hash(newPassword, 10)
    const now = new Date()
    await db.update(users)
      .set({
        passwordHash: newHash,
        passwordChangedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, session.id))

    // 颁发新 session token（当前设备保持登录）
    const sessionUser: SessionUser = {
      id: user[0].id,
      email: user[0].email,
      role: user[0].role as 'admin' | 'user',
    }
    await setSessionCookie(sessionUser)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '修改失败' }, { status: 500 })
  }
}
