'use client'

import { KeyboardEvent, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { normalizeRecipeTags, normalizeTags } from '@/lib/recipe-tags'

interface RecipeTagsInputProps {
  value: string[]
  availableTags: string[]
  onChange: (tags: string[]) => void
}

export function RecipeTagsInput({ value, availableTags, onChange }: RecipeTagsInputProps) {
  const [input, setInput] = useState('')
  const selected = normalizeTags(value).map(tag => tag.name)
  const selectedKeys = new Set(normalizeTags(selected).map(tag => tag.normalizedName))
  const selectableTags = normalizeTags(availableTags)
    .filter(tag => !selectedKeys.has(tag.normalizedName))
    .map(tag => tag.name)

  const updateTags = (nextTags: string[]) => {
    try {
      onChange(normalizeRecipeTags(nextTags).map(tag => tag.name))
    } catch (error) {
      alert(error instanceof Error ? error.message : '标签不合法')
    }
  }

  const addTag = (tag: string) => {
    if (!tag.trim()) return
    updateTags([...selected, tag])
    setInput('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(input)
    }
  }

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        标签
      </label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selected.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => updateTags(selected.filter(item => item !== tag))}
              className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200"
            >
              {tag}
              <X size={14} />
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="输入标签"
        />
        <button
          type="button"
          onClick={() => addTag(input)}
          className="px-3 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-1 text-sm"
        >
          <Plus size={16} />
          添加
        </button>
      </div>

      {selectableTags.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-2">已有标签</div>
          <div className="flex flex-wrap gap-2">
            {selectableTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="px-3 py-1 border border-gray-300 text-gray-600 rounded-full text-sm hover:bg-gray-50"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
