'use server'

import { db, invitationCodes } from '@/db'
import { eq, sql, and, lt } from 'drizzle-orm'
import { requireAdmin } from '@/lib/auth'
import { nanoid } from 'nanoid'

// 生成邀请码
export async function generateInviteCode(maxUses: number = 1) {
  const user = await requireAdmin()

  const code = nanoid(8).toUpperCase()
  const [inviteCode] = await db.insert(invitationCodes).values({
    code,
    createdBy: user.id,
    maxUses,
    usedCount: 0,
  }).returning()

  return inviteCode
}

// 获取所有邀请码
export async function getInviteCodes() {
  await requireAdmin()
  return await db.select().from(invitationCodes)
    .orderBy(invitationCodes.createdAt)
}

// 撤销邀请码
export async function revokeInviteCode(id: number) {
  await requireAdmin()
  await db.delete(invitationCodes).where(eq(invitationCodes.id, id))
}

// #3 原子消费邀请码（防止并发竞态）
// 返回 { success, error? }
export async function consumeInviteCode(code: string): Promise<{ success: boolean; error?: string }> {
  // 单条 UPDATE 完成校验 + 计数 + 1，靠 rowCount 判断是否成功
  const result = await db.update(invitationCodes)
    .set({ usedCount: sql`${invitationCodes.usedCount} + 1` })
    .where(and(
      eq(invitationCodes.code, code),
      lt(invitationCodes.usedCount, invitationCodes.maxUses),
      // 过期校验（expiresAt 为 null 或大于当前时间）
      sql`(${invitationCodes.expiresAt} IS NULL OR ${invitationCodes.expiresAt} > NOW())`
    ))
    .returning({ id: invitationCodes.id })

  if (result.length === 0) {
    // 邀请码不存在、已用完、已过期
    return { success: false, error: '邀请码无效或已使用完毕' }
  }

  return { success: true }
}

// B 事务版：在外部事务中消费邀请码
// 接收 tx 参数，与调用方共享同一事务
export async function consumeInviteCodeInTx(
  tx: any,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const result = await tx.update(invitationCodes)
    .set({ usedCount: sql`${invitationCodes.usedCount} + 1` })
    .where(and(
      eq(invitationCodes.code, code),
      lt(invitationCodes.usedCount, invitationCodes.maxUses),
      sql`(${invitationCodes.expiresAt} IS NULL OR ${invitationCodes.expiresAt} > NOW())`
    ))
    .returning({ id: invitationCodes.id })

  if (result.length === 0) {
    return { success: false, error: '邀请码无效或已使用完毕' }
  }

  return { success: true }
}

// 仅查询邀请码是否有效（用于前端预校验，不消费）
export async function validateInviteCode(code: string): Promise<boolean> {
  const result = await db.select().from(invitationCodes)
    .where(eq(invitationCodes.code, code))
    .limit(1)

  if (result.length === 0) return false

  const inviteCode = result[0]

  if (inviteCode.usedCount >= inviteCode.maxUses) return false
  if (inviteCode.expiresAt && new Date(inviteCode.expiresAt) < new Date()) return false

  return true
}
