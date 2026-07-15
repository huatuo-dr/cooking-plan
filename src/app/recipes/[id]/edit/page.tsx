'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getRecipeById, saveRecipe, UnifiedRecipe } from '@/lib/storage/client'

export default function EditRecipePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [recipe, setRecipe] = useState<UnifiedRecipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [ingredients, setIngredients] = useState<{ name: string; amount?: string }[]>([])
  const [steps, setSteps] = useState<{ phase: 'prep' | 'cook'; text: string }[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadRecipe()
  }, [params.id])

  const loadRecipe = async () => {
    setLoading(true)
    try {
      const data = await getRecipeById(params.id)
      if (data) {
        setRecipe(data)
        setTitle(data.title)
        setImageUrl(data.imageUrl || '')
        setIngredients(data.ingredients.length > 0 ? data.ingredients : [{ name: '', amount: '' }])
        setSteps(data.steps.length > 0 ? data.steps : [{ phase: 'prep', text: '' }])
      }
    } catch (error) {
      console.error('加载失败', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const { url } = await response.json()
        setImageUrl(url)
      } else {
        alert('图片上传失败')
      }
    } catch (error) {
      alert('图片上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      alert('请输入菜谱名称')
      return
    }

    if (ingredients.length === 0 || !ingredients[0].name) {
      alert('请至少添加一种食材')
      return
    }

    setSaving(true)
    try {
      await saveRecipe({
        id: params.id,
        title,
        imageUrl: imageUrl || undefined,
        ingredients: ingredients.filter(i => i.name),
        steps: steps.filter(s => s.text),
      })
      router.push(`/recipes/${params.id}`)
    } catch (error) {
      alert('保存失败')
    } finally {
      setSaving(false)
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href={`/recipes/${params.id}`} className="text-gray-600 hover:text-gray-900">
            ← 返回
          </Link>
          <h1 className="text-xl font-bold text-gray-900">编辑菜谱</h1>
          {recipe.source === 'local' && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
              本地存储
            </span>
          )}
        </div>
      </header>

      <main className="py-8">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow">
          {/* 菜谱名称 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              菜谱名称 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* 菜谱图片 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              菜谱图片
            </label>
            <div className="flex items-start gap-4">
              {imageUrl && (
                <div className="relative w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
                  <img src={imageUrl} alt="预览" className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {uploading && <p className="mt-1 text-sm text-gray-500">上传中...</p>}
              </div>
            </div>
          </div>

          {/* 食材 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">食材 *</label>
              <button
                type="button"
                onClick={() => setIngredients([...ingredients, { name: '', amount: '' }])}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + 添加食材
              </button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={(e) => {
                      const newIngs = [...ingredients]
                      newIngs[index].name = e.target.value
                      setIngredients(newIngs)
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="食材名称（必填）"
                  />
                  <input
                    type="text"
                    value={ing.amount || ''}
                    onChange={(e) => {
                      const newIngs = [...ingredients]
                      newIngs[index].amount = e.target.value
                      setIngredients(newIngs)
                    }}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="用量"
                  />
                  {ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))}
                      className="text-red-600 hover:text-red-700 px-2"
                    >
                      删除
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 步骤 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">步骤 *</label>
              <button
                type="button"
                onClick={() => setSteps([...steps, { phase: 'prep', text: '' }])}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + 添加步骤
              </button>
            </div>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-500">{index + 1}.</span>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          checked={step.phase === 'prep'}
                          onChange={() => {
                            const newSteps = [...steps]
                            newSteps[index].phase = 'prep'
                            setSteps(newSteps)
                          }}
                          className="text-blue-600"
                        />
                        <span className="text-sm">准备</span>
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          checked={step.phase === 'cook'}
                          onChange={() => {
                            const newSteps = [...steps]
                            newSteps[index].phase = 'cook'
                            setSteps(newSteps)
                          }}
                          className="text-blue-600"
                        />
                        <span className="text-sm">制作</span>
                      </label>
                    </div>
                    <div className="ml-auto flex gap-1">
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newSteps = [...steps]
                            ;[newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]]
                            setSteps(newSteps)
                          }}
                          className="text-gray-400 hover:text-gray-600 px-1"
                        >
                          ↑
                        </button>
                      )}
                      {index < steps.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newSteps = [...steps]
                            ;[newSteps[index + 1], newSteps[index]] = [newSteps[index], newSteps[index + 1]]
                            setSteps(newSteps)
                          }}
                          className="text-gray-400 hover:text-gray-600 px-1"
                        >
                          ↓
                        </button>
                      )}
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSteps(steps.filter((_, i) => i !== index))}
                          className="text-red-600 hover:text-red-700 px-1"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={step.text}
                    onChange={(e) => {
                      const newSteps = [...steps]
                      newSteps[index].text = e.target.value
                      setSteps(newSteps)
                    }}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    placeholder="描述这一步的操作..."
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end gap-3">
            <Link
              href={`/recipes/${params.id}`}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
            >
              {saving ? '保存中...' : '保存修改'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
