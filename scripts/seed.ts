import 'dotenv/config'
import bcrypt from 'bcrypt'
import { db } from '../src/db'
import { users } from '../src/db/schema'
import { eq } from 'drizzle-orm'

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.error('❌ 请在 .env 中配置 ADMIN_EMAIL 和 ADMIN_PASSWORD')
    process.exit(1)
  }

  console.log(`🔧 正在初始化管理员账号: ${email}`)

  try {
    // 检查该邮箱是否已有用户
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)

    const passwordHash = await bcrypt.hash(password, 10)

    if (existing.length === 0) {
      // 创建新管理员
      await db.insert(users).values({
        email,
        passwordHash,
        role: 'admin',
      })
      console.log('✅ 管理员账号创建成功！')
    } else {
      // 已存在，更新为管理员并重置密码
      await db.update(users)
        .set({ role: 'admin', passwordHash })
        .where(eq(users.email, email))
      console.log('✅ 管理员账号已更新（角色设为管理员，密码已重置）')
    }

    console.log('')
    console.log('📋 登录信息：')
    console.log(`   邮箱: ${email}`)
    console.log(`   密码: ${password}`)
    console.log('')
    console.log('⚠️  安全提醒：')
    console.log('   • 请立即记录此密码到密码管理器')
    console.log('   • 生产环境建议立即登录后修改密码')
    console.log('   • 此日志仅为初始化时显示，请勿在 CI/日志系统中保留')

    process.exit(0)
  } catch (error) {
    console.error('❌ 初始化失败:', error)
    process.exit(1)
  }
}

seedAdmin()
