'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAllRecipes, createCookingSession, UnifiedRecipe } from '@/lib/storage/client'

export default function CookingPage() {
  const router = useRouter()
  const [recipes, setRecipes] = useState<UnifiedRecipe[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [planName, setPlanName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadRecipes()
  }, [])

  const loadRecipes = async () => {
    setLoading(true)
    try {
      const data = await getAllRecipes()
      setRecipes(data)
    } catch (error) {
      console.error('加载失败', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleRecipe = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedIds.size === 0) {
      alert('请选择至少一道菜')
      return
    }

    if (!planName.trim()) {
      alert('请输入计划名称')
      return
    }

    setSubmitting(true)
    try {
      const selectedRecipes = recipes.filter(r => selectedIds.has(r.id))
      const session = await createCookingSession(planName, selectedRecipes)
      router.push(`/cooking/${session.id}`)
    } catch (error: any) {
      alert(error.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/cooking" className="text-gray-600 hover:text-gray-900">
            ← 返回
          </Link>
          <h1 className="text-xl font-bold text-gray-900">创建 Cooking 计划</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 计划名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              计划名称 *
            </label>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例如：今晚的晚餐"
              required
            />
          </div>

          {/* 选择菜谱 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择菜谱 * (已选择 {selectedIds.size} 道)
            </label>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {recipes.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  还没有菜谱，{' '}
                  <Link href="/recipes/new" className="text-blue-600 hover:text-blue-700">
                    先创建一道菜吧
                  </Link>
                </div>
              ) : (
                recipes.map((recipe) => (
                  <label
                    key={recipe.id}
                    className="flex items-center p-4 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(recipe.id)}
                      onChange={() => handleToggleRecipe(recipe.id)}
                      className="w-5 h-5 rounded text-blue-600"
                    />
                    <div className="ml-3 flex-1">
                      <span className="font-medium text-gray-900">{recipe.title}</span>
                      {recipe.source === 'local' && (
                        <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                          本地
                        </span>
                      )}
                    </div>
                    {recipe.imageUrl && (
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                  </label>
                ))
              )}
            </div>
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end gap-3">
            <Link
              href="/cooking"
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={submitting || selectedIds.size === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
            >
              {submitting ? '创建中...' : '创建计划'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
