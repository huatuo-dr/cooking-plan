'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getAllRecipes, UnifiedRecipe } from '@/lib/storage/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { RecipeFilters } from '@/components/RecipeFilters'
import { filterRecipesByQueryAndTags } from '@/lib/recipe-tags'

export default function HomePage() {
  const { user, isLoggedIn, isAdmin } = useAuth()
  const [recipes, setRecipes] = useState<UnifiedRecipe[]>([])
  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const filteredRecipes = filterRecipesByQueryAndTags(recipes, { query, selectedTags })

  // #12 登录态变化时重新加载菜谱
  useEffect(() => {
    loadData()
  }, [isLoggedIn])

  const loadData = async () => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">🍳 Cooking Plan</h1>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {user?.email[0].toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">{user?.email}</span>
                  {isAdmin && (
                    <span className="px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded">
                      管理员
                    </span>
                  )}
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
                  登录
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  注册
                </Link>
              </>
            )}
            <Link
              href="/cooking"
              className="px-4 py-2 border border-orange-600 text-orange-600 rounded-lg hover:bg-orange-50 font-medium flex items-center gap-1"
            >
              🍳 Cooking
            </Link>
            <Link
              href="/recipes/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              + 新建菜谱
            </Link>
          </div>
        </div>
      </header>

      {/* 菜谱列表 */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {!isLoggedIn && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              💡 你正在以访客模式浏览。创建的菜谱保存在浏览器本地，{` `}
              <Link href="/register" className="font-medium underline">
                注册账号
              </Link>
              {` `}后可保存到云端并使用多设备同步。
            </p>
          </div>
        )}

        {!loading && recipes.length > 0 && (
          <RecipeFilters
            recipes={recipes}
            query={query}
            selectedTags={selectedTags}
            onQueryChange={setQuery}
            onSelectedTagsChange={setSelectedTags}
          />
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">还没有菜谱，快来创建第一道菜吧！</p>
            <Link
              href="/recipes/new"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              创建菜谱
            </Link>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">没有找到匹配菜谱</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setSelectedTags([])
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              清空筛选
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden relative"
              >
                {/* 来源标签 */}
                <div className="absolute top-2 right-2 z-10 flex gap-1">
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
                {recipe.imageUrl ? (
                  <div className="aspect-video bg-gray-100">
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
                    <span className="text-4xl">🍳</span>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-medium text-gray-900">{recipe.title}</h3>
                  {recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {recipe.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                      {recipe.tags.length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                          +{recipe.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(recipe.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
