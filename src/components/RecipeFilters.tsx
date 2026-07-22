'use client'

import { Search, X } from 'lucide-react'
import { getAvailableTags } from '@/lib/recipe-tags'
import { UnifiedRecipe } from '@/lib/storage/client'

interface RecipeFiltersProps {
  recipes: UnifiedRecipe[]
  query: string
  selectedTags: string[]
  onQueryChange: (query: string) => void
  onSelectedTagsChange: (tags: string[]) => void
}

export function RecipeFilters({
  recipes,
  query,
  selectedTags,
  onQueryChange,
  onSelectedTagsChange,
}: RecipeFiltersProps) {
  const availableTags = getAvailableTags(recipes)
  const hasFilters = query.trim() || selectedTags.length > 0

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onSelectedTagsChange(selectedTags.filter(item => item !== tag))
    } else {
      onSelectedTagsChange([...selectedTags, tag])
    }
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="搜索菜名、食材或标签"
        />
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              onQueryChange('')
              onSelectedTagsChange([])
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
            title="清空筛选"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableTags.map(tag => {
            const active = selectedTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-full border text-sm transition-colors ${
                  active
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
