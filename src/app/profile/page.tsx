'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { Copy, Trash2, Plus, Lock, LogOut, ChevronRight, UserX } from 'lucide-react'

interface InviteCode {
  id: number
  code: string
  maxUses: number
  usedCount: number
  createdAt: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, isAdmin, loading, refresh } = useAuth()

  // 邀请码相关
  const [codes, setCodes] = useState<InviteCode[]>([])
  const [codesLoading, setCodesLoading] = useState(true)
  const [maxUses, setMaxUses] = useState(1)
  const [generating, setGenerating] = useState(false)

  // 修改密码相关
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')

  // 注销账户相关
  const [showDeleteSection, setShowDeleteSection] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (isAdmin) {
      loadCodes()
    }
  }, [isAdmin])

  const loadCodes = async () => {
    setCodesLoading(true)
    try {
      const response = await fetch('/api/admin/invites')
      if (response.ok) {
        const data = await response.json()
        setCodes(data)
      }
    } catch (error) {
      console.error('加载失败', error)
    } finally {
      setCodesLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxUses }),
      })

      if (response.ok) {
        const newCode = await response.json()
        setCodes([newCode, ...codes])
      }
    } catch (error) {
      alert('生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleRevoke = async (id: number) => {
    if (!confirm('确定要撤销这个邀请码吗？')) return

    try {
      await fetch(`/api/admin/invites/${id}`, { method: 'DELETE' })
      setCodes(codes.filter(c => c.id !== id))
    } catch (error) {
      alert('撤销失败')
    }
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    alert('邀请码已复制：' + code)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMsg('')

    if (newPassword !== confirmPassword) {
      setPasswordMsg('两次密码输入不一致')
      return
    }

    if (newPassword.length < 6) {
      setPasswordMsg('新密码长度至少 6 位')
      return
    }

    setChangingPassword(true)
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      })

      const data = await response.json()

      if (data.success) {
        setPasswordMsg('✅ 密码修改成功')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordMsg(data.error || '修改失败')
      }
    } catch (error) {
      setPasswordMsg('网络错误')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    await refresh()
    router.push('/')
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      alert('请输入密码确认')
      return
    }

    if (!confirm('⚠️ 确定要注销账户吗？\n\n这将永久删除：\n• 你的所有菜谱\n• 你的所有 Cooking 计划\n• 你的账户信息\n\n此操作不可撤销！')) {
      return
    }

    if (!confirm('再次确认：真的要删除所有数据吗？')) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      })

      const data = await response.json()

      if (data.success) {
        await refresh()
        router.push('/')
      } else {
        alert(data.error || '注销失败')
      }
    } catch (error) {
      alert('网络错误')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            ← 返回
          </Link>
          <h1 className="text-xl font-bold text-gray-900">个人中心</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* 用户信息卡片 */}
        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
              {user.email[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{user.email}</h2>
              <div className="flex items-center gap-2 mt-1">
                {isAdmin ? (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium">
                    管理员
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-medium">
                    普通用户
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 功能菜单 */}
        <section className="bg-white rounded-lg shadow divide-y divide-gray-100">
          {/* 邀请码管理（仅管理员可见） */}
          {isAdmin && (
            <div className="p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm">
                  🎟️
                </span>
                邀请码管理
              </h3>

              {/* 生成邀请码 */}
              <div className="flex items-end gap-3 mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大使用次数
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                  <Plus size={18} />
                  {generating ? '生成中...' : '生成邀请码'}
                </button>
              </div>

              {/* 邀请码列表 */}
              {codesLoading ? (
                <div className="text-center py-4 text-gray-500">加载中...</div>
              ) : codes.length === 0 ? (
                <div className="text-center py-4 text-gray-500">还没有邀请码</div>
              ) : (
                <div className="space-y-2">
                  {codes.map((code) => (
                    <div
                      key={code.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <code className="px-3 py-1 bg-gray-100 rounded text-base font-mono font-medium">
                          {code.code}
                        </code>
                        <button
                          onClick={() => handleCopy(code.code)}
                          className="text-gray-500 hover:text-gray-700"
                          title="复制"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">
                          {code.usedCount} / {code.maxUses}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            code.usedCount >= code.maxUses
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {code.usedCount >= code.maxUses ? '已用完' : '可用'}
                        </span>
                        <button
                          onClick={() => handleRevoke(code.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="撤销"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 修改密码 */}
          <div className="p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
                <Lock size={16} />
              </span>
              修改密码
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  原密码
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  新密码
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="至少 6 位"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  确认新密码
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              {passwordMsg && (
                <div className={`text-sm ${passwordMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                  {passwordMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={changingPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {changingPassword ? '修改中...' : '确认修改'}
              </button>
            </form>
          </div>

          {/* 退出登录 */}
          <div className="p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-sm">
                <LogOut size={16} />
              </span>
              退出登录
            </h3>
            <p className="text-sm text-gray-500 mb-3">退出当前账号，返回访客模式</p>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 font-medium"
            >
              退出登录
            </button>
          </div>

          {/* 注销账户（仅普通用户） */}
          {!isAdmin && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-base font-semibold text-red-600 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-sm">
                  <UserX size={16} />
                </span>
                注销账户
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                ⚠️ 危险操作：将永久删除你的账户和所有数据（菜谱、Cooking 计划等），不可恢复。
              </p>

              {!showDeleteSection ? (
                <button
                  onClick={() => setShowDeleteSection(true)}
                  className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 font-medium"
                >
                  申请注销账户
                </button>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                  <p className="text-sm text-red-700">
                    请输入密码确认注销账户：
                  </p>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="输入密码确认"
                    className="w-full max-w-md px-3 py-2 border border-red-300 rounded-lg"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting || !deletePassword}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium"
                    >
                      {deleting ? '注销中...' : '确认注销账户'}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteSection(false)
                        setDeletePassword('')
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
