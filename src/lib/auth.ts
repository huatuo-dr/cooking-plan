import bcrypt from 'bcrypt'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { db, users } from '@/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

// #6 JWT_SECRET 启动校验
const JWT_SECRET_RAW = process.env.JWT_SECRET
if (!JWT_SECRET_RAW || JWT_SECRET_RAW.length < 16) {
  throw new Error('JWT_SECRET 环境变量未配置或过短（至少 16 字符）')
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW)

const COOKIE_NAME = 'session'

export interface SessionUser {
  id: number
  email: string
  role: 'admin' | 'user'
  iat?: number  // 签发时间（JWT 自动填充）
}

// 获取当前会话用户
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const user = payload as unknown as SessionUser

    // #8 改密失效旧 session：校验签发时间是否早于 passwordChangedAt
    if (user.iat) {
      const dbUser = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
      if (dbUser.length === 0) return null

      const passwordChangedAt = Math.floor(dbUser[0].passwordChangedAt.getTime() / 1000)
      if (user.iat < passwordChangedAt) {
        return null  // 密码已修改，旧 token 失效
      }
    }

    return user
  } catch {
    return null
  }
}

// 必须登录
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) {
    redirect('/login')
  }
  return user
}

// 必须是管理员
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== 'admin') {
    redirect('/')
  }
  return user
}

// 创建会话
async function createSession(user: SessionUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

// 设置会话 Cookie
export async function setSessionCookie(user: SessionUser) {
  const token = await createSession(user)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

// 清除会话
export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

// #10 时序攻击防护：固定的假哈希用于"用户不存在"场景
const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

// 注册
export async function register(data: {
  email: string
  password: string
  inviteCode?: string
}) {
  // 检查邮箱是否已存在
  const existing = await db.select().from(users).where(eq(users.email, data.email)).limit(1)
  if (existing.length > 0) {
    return { error: '该邮箱已被注册' }
  }

  // 所有新注册用户都需要邀请码（管理员通过 seed 脚本创建）
  if (!data.inviteCode) {
    return { error: '请输入邀请码' }
  }

  // 哈希密码（事务外计算，避免在事务内做耗时操作）
  const passwordHash = await bcrypt.hash(data.password, 10)

  // B 使用事务：邀请码消费 + 用户创建必须原子
  // 避免邀请码已扣减但用户创建失败导致浪费
  const { consumeInviteCodeInTx } = await import('./actions/invitation')

  let newUser
  try {
    const inviteCode = data.inviteCode!  // 前面已校验非空
    newUser = await db.transaction(async (tx) => {
      // 在事务中消费邀请码
      const consumeResult = await consumeInviteCodeInTx(tx, inviteCode)
      if (!consumeResult.success) {
        throw new Error(consumeResult.error || '邀请码无效或已使用完毕')
      }

      // 创建用户
      const [user] = await tx.insert(users).values({
        email: data.email,
        passwordHash,
        role: 'user',
      }).returning()

      return user
    })
  } catch (error: any) {
    // 体验优化：唯一约束错误友好提示
    if (error?.code === '23505' || error?.message?.includes('already exists')) {
      return { error: '该邮箱已被注册' }
    }
    return { error: error?.message || '注册失败' }
  }

  // 自动登录
  const sessionUser: SessionUser = {
    id: newUser.id,
    email: newUser.email,
    role: newUser.role as 'admin' | 'user',
  }
  await setSessionCookie(sessionUser)

  return { success: true, user: sessionUser }
}

// 登录
export async function login(data: { email: string; password: string }) {
  // 查找用户
  const found = await db.select().from(users).where(eq(users.email, data.email)).limit(1)

  // #10 时序攻击防护：用户不存在时也执行 bcrypt.compare，保持相同响应时间
  if (found.length === 0) {
    await bcrypt.compare(data.password, DUMMY_HASH)  // 假比较
    return { error: '邮箱或密码错误' }
  }

  const user = found[0]

  // 验证密码
  const isValid = await bcrypt.compare(data.password, user.passwordHash)
  if (!isValid) {
    return { error: '邮箱或密码错误' }
  }

  // 创建会话
  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    role: user.role as 'admin' | 'user',
  }
  await setSessionCookie(sessionUser)

  return { success: true, user: sessionUser }
}

// 登出
export async function logout() {
  await clearSession()
}
