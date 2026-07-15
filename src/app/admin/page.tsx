'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, Trash2, Plus } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

interface InviteCode {
  id: number
  code: string
  maxUses: number
  usedCount: number
  createdAt: string
}

export default function AdminPage() {
  const router = useRouter()
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [codes, setCodes] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [maxUses, setMaxUses] = useState(1)

  // 客户端角色校验 redirect
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login')
      } else if (!isAdmin) {
        router.push('/')
      }
    }
  }, [authLoading, user, isAdmin, router])

  useEffect(() => {
    if (isAdmin) {
      loadCodes()
    }
  }, [isAdmin])

  const loadCodes = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/invites')
      if (response.ok) {
        const data = await response.json()
        setCodes(data)
      }
    } catch (error) {
      console.error('加载失败', error)
    } finally {
      setLoading(false)
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
    // 简单的视觉反馈
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            ← 返回
          </Link>
          <h1 className="text-xl font-bold text-gray-900">管理员面板</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* 邀请码管理 */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">邀请码管理</h2>

          {/* 生成邀请码 */}
          <div className="flex items-end gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
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
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : codes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">还没有邀请码</div>
          ) : (
            <div className="space-y-2">
              {codes.map((code) => (
                <div
                  key={code.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <code className="px-3 py-1 bg-gray-100 rounded text-lg font-mono">
                      {code.code}
                    </code>
                    <button
                      onClick={() => handleCopy(code.code)}
                      className="text-gray-500 hover:text-gray-700"
                      title="复制"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      使用: {code.usedCount} / {code.maxUses}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
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
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 提示信息 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">使用说明</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 新用户注册时需要输入有效的邀请码</li>
            <li>• 邀请码使用次数达到上限后自动失效</li>
            <li>• 可以随时撤销未使用的邀请码</li>
            <li>• 首个注册用户自动成为管理员</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
