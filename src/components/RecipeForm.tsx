'use client'

import { useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const recipeSchema = z.object({
  title: z.string().min(1, '菜谱名称不能为空'),
  ingredients: z.array(z.object({
    name: z.string().min(1, '食材名称不能为空'),
    amount: z.string().optional(),
  })).min(1, '至少需要一种食材'),
  steps: z.array(z.object({
    phase: z.enum(['prep', 'cook']),
    text: z.string().min(1, '步骤内容不能为空'),
  })).min(1, '至少需要一个步骤'),
})

type RecipeFormData = z.infer<typeof recipeSchema>

interface RecipeFormProps {
  initialData?: {
    title: string
    imageUrl?: string
    ingredients: { name: string; amount?: string }[]
    steps: { phase: 'prep' | 'cook'; text: string }[]
  }
  onSubmit: (data: RecipeFormData) => Promise<void>
  submitLabel: string
}

export function RecipeForm({ initialData, onSubmit, submitLabel }: RecipeFormProps) {
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '')
  const [uploading, setUploading] = useState(false)

  const { control, register, handleSubmit, watch } = useForm<RecipeFormData>({
    resolver: zodResolver(recipeSchema),
    defaultValues: initialData || {
      title: '',
      ingredients: [{ name: '', amount: '' }],
      steps: [{ phase: 'prep' as const, text: '' }],
    },
  })

  const { fields: ingredientFields, append: appendIngredient, remove: removeIngredient } = useFieldArray({
    control,
    name: 'ingredients',
  })

  const { fields: stepFields, append: appendStep, remove: removeStep, move: moveStep } = useFieldArray({
    control,
    name: 'steps',
  })

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

  const onFormSubmit = async (data: RecipeFormData) => {
    await onSubmit({ ...data, imageUrl: imageUrl || undefined })
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow">
      {/* 菜谱名称 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          菜谱名称 *
        </label>
        <input
          {...register('title')}
          type="text"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="例如：番茄炒蛋"
        />
        <p className="mt-1 text-sm text-red-600">{watch('title') ? '' : '菜谱名称不能为空'}</p>
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
          <label className="block text-sm font-medium text-gray-700">
            食材 *
          </label>
          <button
            type="button"
            onClick={() => appendIngredient({ name: '', amount: '' })}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + 添加食材
          </button>
        </div>
        <div className="space-y-2">
          {ingredientFields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-center">
              <input
                {...register(`ingredients.${index}.name`)}
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="食材名称（必填）"
              />
              <input
                {...register(`ingredients.${index}.amount`)}
                type="text"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="用量"
              />
              {ingredientFields.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
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
          <label className="block text-sm font-medium text-gray-700">
            步骤 *
          </label>
          <button
            type="button"
            onClick={() => appendStep({ phase: 'prep' as const, text: '' })}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + 添加步骤
          </button>
        </div>
        <div className="space-y-3">
          {stepFields.map((field, index) => (
            <div key={field.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-500">{index + 1}.</span>
                <Controller
                  control={control}
                  name={`steps.${index}.phase`}
                  render={({ field }) => (
                    <div className="flex gap-2">
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          {...field}
                          value="prep"
                          checked={field.value === 'prep'}
                          className="text-blue-600"
                        />
                        <span className="text-sm">准备</span>
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          {...field}
                          value="cook"
                          checked={field.value === 'cook'}
                          className="text-blue-600"
                        />
                        <span className="text-sm">制作</span>
                      </label>
                    </div>
                  )}
                />
                <div className="ml-auto flex gap-1">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => moveStep(index, index - 1)}
                      className="text-gray-400 hover:text-gray-600 px-1"
                      title="上移"
                    >
                      ↑
                    </button>
                  )}
                  {index < stepFields.length - 1 && (
                    <button
                      type="button"
                      onClick={() => moveStep(index, index + 1)}
                      className="text-gray-400 hover:text-gray-600 px-1"
                      title="下移"
                    >
                      ↓
                    </button>
                  )}
                  {stepFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="text-red-600 hover:text-red-700 px-1"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
              <textarea
                {...register(`steps.${index}.text`)}
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
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
