'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getRecipeById, deleteRecipe, UnifiedRecipe } from '@/lib/storage/client'
import { CopyRecipeButton } from '@/components/CopyRecipeButton'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

export default function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const { isLoggedIn, isAdmin } = useAuth()
  const [recipe, setRecipe] = useState<UnifiedRecipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadRecipe()
  }, [id])

  const loadRecipe = async () => {
    setLoading(true)
    try {
      const data = await getRecipeById(id)
      setRecipe(data)
    } catch (error) {
      console.error('加载失败', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!recipe) return
    if (!confirm(`确定要删除「${recipe.title}」吗？此操作不可撤销。`)) return

    setDeleting(true)
    try {
      await deleteRecipe(id)
      router.push('/')
    } catch (error) {
      alert('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>
  }

  if (!recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">未找到该菜谱</p>
          <Link href="/" className="text-blue-600">返回首页</Link>
        </div>
      </div>
    )
  }

  const prepSteps = recipe.steps.filter(s => s.phase === 'prep')
  const cookSteps = recipe.steps.filter(s => s.phase === 'cook')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            ← 返回
          </Link>
          <h1 className="text-xl font-bold text-gray-900">菜谱详情</h1>
          {recipe.isOfficial && (
            <span className="px-2 py-1 bg-orange-500 text-white text-xs rounded font-medium">
              官方
            </span>
          )}
          {!recipe.isOfficial && recipe.source === 'cloud' && recipe.isMine && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
              我的
            </span>
          )}
          {recipe.source === 'local' && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded font-medium">
              本地
            </span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* 菜谱图片 */}
        {recipe.imageUrl && (
          <div className="mb-6 rounded-lg overflow-hidden">
            <img src={recipe.imageUrl} alt={recipe.title} className="w-full" />
          </div>
        )}

        {/* 菜谱标题 */}
        <h2 className="text-3xl font-bold text-gray-900 mb-6">{recipe.title}</h2>

        {/* 食材 */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
              🥬
            </span>
            食材
          </h3>
          <ul className="bg-white rounded-lg p-4 space-y-2">
            {recipe.ingredients.map((ing, index) => (
              <li key={index} className="flex justify-between items-center py-1">
                <span className="text-gray-900">{ing.name}</span>
                {ing.amount && <span className="text-gray-500">{ing.amount}</span>}
              </li>
            ))}
          </ul>
        </section>

        {/* 准备步骤 */}
        {prepSteps.length > 0 && (
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-sm">
                🔪
              </span>
              准备
            </h3>
            <ol className="bg-white rounded-lg p-4 space-y-3">
              {prepSteps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <span className="text-gray-700">{step.text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 制作步骤 */}
        {cookSteps.length > 0 && (
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm">
                🔥
              </span>
              制作
            </h3>
            <ol className="bg-white rounded-lg p-4 space-y-3">
              {cookSteps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <span className="text-gray-700">{step.text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 操作按钮 - 根据权限显示 */}
        <div className="flex flex-wrap gap-3">
          {/* 编辑按钮：本地菜谱 / 我的云端菜谱 / 管理员编辑官方菜谱 */}
          {(() => {
            const canEdit =
              recipe.source === 'local' ||          // 本地菜谱
              recipe.isMine ||                       // 我的云端菜谱
              (recipe.isOfficial && isAdmin)         // 管理员编辑官方菜谱

            return canEdit ? (
              <Link
                href={`/recipes/${recipe.id}/edit`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                编辑
              </Link>
            ) : null
          })()}

          {/* 复制按钮：自己的菜谱（已经拥有）不需要复制 */}
          {recipe && !(recipe.isMine || (recipe.source === 'local')) && (
            <CopyRecipeButton recipe={recipe} isLoggedIn={isLoggedIn} />
          )}

          {/* 删除按钮：本地菜谱 / 我的云端菜谱 / 管理员删除官方菜谱 */}
          {(() => {
            const canDelete =
              recipe.source === 'local' ||
              recipe.isMine ||
              (recipe.isOfficial && isAdmin)

            return canDelete ? (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 disabled:bg-gray-100 disabled:text-gray-400 flex items-center gap-2"
              >
                <Trash2 size={18} />
                {deleting ? '删除中...' : '删除'}
              </button>
            ) : null
          })()}

          <Link
            href="/"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            返回列表
          </Link>
        </div>
      </main>
    </div>
  )
}
