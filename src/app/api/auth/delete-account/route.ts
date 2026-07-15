import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { getSession, clearSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // 管理员不允许注销
    if (session.role === 'admin') {
      return NextResponse.json({ error: '管理员账户不能注销' }, { status: 403 })
    }

    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json({ error: '请输入密码确认' }, { status: 400 })
    }

    // #11 二次验证：必须输入密码（不只是邮箱）
    const user = await db.select().from(users).where(eq(users.id, session.id)).limit(1)
    if (user.length === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const isValid = await bcrypt.compare(password, user[0].passwordHash)
    if (!isValid) {
      return NextResponse.json({ error: '密码错误' }, { status: 400 })
    }

    // 删除用户（数据库级联删除会自动清理所有关联数据）
    await db.delete(users).where(eq(users.id, session.id))

    // 清除登录会话
    await clearSession()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('注销账户失败:', error)
    return NextResponse.json({ error: error.message || '注销失败' }, { status: 500 })
  }
}
