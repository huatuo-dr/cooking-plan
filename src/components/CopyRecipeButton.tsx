'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { saveRecipe, UnifiedRecipe } from '@/lib/storage/client'

interface CopyRecipeButtonProps {
  recipe: UnifiedRecipe
  isLoggedIn: boolean
}

export function CopyRecipeButton({ recipe, isLoggedIn }: CopyRecipeButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCopy = async () => {
    setLoading(true)
    try {
      if (isLoggedIn) {
        // 登录用户：复制到云端
        const cloudId = recipe.id.replace('cloud-', '')
        const response = await fetch('/api/recipes/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromId: Number(cloudId) }),
        })

        if (response.ok) {
          const newRecipe = await response.json()
          router.push(`/recipes/cloud-${newRecipe.id}/edit`)
        } else {
          alert('复制失败')
        }
      } else {
        // 匿名用户：复制到本地 IndexedDB
        const saved = await saveRecipe({
          title: `${recipe.title} (副本)`,
          imageUrl: recipe.imageUrl,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
        })
        router.push(`/recipes/${saved.id}/edit`)
      }
    } catch (error) {
      alert('复制失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCopy}
      disabled={loading}
      className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:bg-gray-100 disabled:text-gray-400 flex items-center gap-2"
    >
      <Copy size={18} />
      {loading ? '复制中...' : isLoggedIn ? '复制到我的菜谱' : '复制到本地'}
    </button>
  )
}
