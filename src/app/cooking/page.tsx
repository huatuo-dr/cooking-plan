'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getAllCookingSessions, deleteCookingSession, CookingSessionSummary } from '@/lib/storage/client'
import { Plus, Trash2, Clock, ChefHat } from 'lucide-react'

export default function CookingListPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<CookingSessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setLoading(true)
    try {
      const data = await getAllCookingSessions()
      setSessions(data)
    } catch (error) {
      console.error('加载失败', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除计划「${name}」吗？`)) return

    setDeleting(id)
    try {
      await deleteCookingSession(id)
      setSessions(sessions.filter(s => s.id !== id))
    } catch (error) {
      alert('删除失败')
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days} 天前`
    return date.toLocaleDateString('zh-CN')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-600 hover:text-gray-900">
              ← 返回
            </Link>
            <h1 className="text-xl font-bold text-gray-900">🍳 Cooking 计划</h1>
          </div>
          <Link
            href="/cooking/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-1"
          >
            <Plus size={18} />
            新建计划
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <ChefHat size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">还没有 Cooking 计划</p>
            <p className="text-sm text-gray-400 mb-6">创建一个计划，把多道菜的步骤合并成一条真实的操作时间线</p>
            <Link
              href="/cooking/new"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              创建第一个计划
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const progress = session.stepCount > 0
                ? Math.round((session.doneCount / session.stepCount) * 100)
                : 0
              const isComplete = session.doneCount === session.stepCount && session.stepCount > 0

              return (
                <div
                  key={session.id}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-5"
                >
                  <div className="flex items-start justify-between">
                    <Link
                      href={`/cooking/${session.id}`}
                      className="flex-1"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">{session.name}</h3>
                        {session.source === 'local' && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                            本地
                          </span>
                        )}
                        {isComplete && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                            ✓ 已完成
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <ChefHat size={14} />
                          {session.recipeCount} 道菜
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {formatDate(session.createdAt)}
                        </span>
                      </div>
                    </Link>
                    <button
                      onClick={() => handleDelete(session.id, session.name)}
                      disabled={deleting === session.id}
                      className="ml-4 p-2 text-gray-400 hover:text-red-600 disabled:opacity-50"
                      title="删除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* 进度条 */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>进度</span>
                      <span>{session.doneCount} / {session.stepCount} 步 ({progress}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isComplete ? 'bg-green-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
