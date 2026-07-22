'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, Upload, X } from 'lucide-react'
import {
  importRecipesFromJson,
  previewRecipeImport,
  type ImportRecipesResult,
} from '@/lib/storage/client'
import { getImportSourceWarning, MAX_RECIPES_PER_IMPORT } from '@/lib/recipe-package'

const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024

interface RecipeImportDialogProps {
  open: boolean
  onClose: () => void
  onImported: (result: ImportRecipesResult) => void
}

export function RecipeImportDialog({ open, onClose, onImported }: RecipeImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [json, setJson] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ReturnType<typeof previewRecipeImport> | null>(null)
  const [importing, setImporting] = useState(false)

  if (!open) return null

  const reset = () => {
    setJson('')
    setError('')
    setPreview(null)
    setImporting(false)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setError('')
    setPreview(null)
    setJson('')
    if (!file) return

    if (!file.name.endsWith('.json')) {
      setError('请选择 JSON 文件')
      return
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError('JSON 文件不能超过 2MB')
      return
    }

    try {
      const text = await file.text()
      const parsed = previewRecipeImport(text)
      setJson(text)
      setPreview(parsed)
    } catch (error) {
      setError(error instanceof Error ? error.message : '菜谱包格式不合法')
    }
  }

  const handleImport = async () => {
    if (!preview || !json) return
    setImporting(true)
    setError('')
    try {
      const result = await importRecipesFromJson(json)
      onImported(result)
      handleClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">导入菜谱 JSON</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-gray-500 hover:text-gray-900"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-2">JSON 文件</span>
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </label>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                <div>菜谱数量：{preview.recipePackage.recipes.length} / {MAX_RECIPES_PER_IMPORT}</div>
                <div>标签数量：{new Set(preview.recipePackage.recipes.flatMap(recipe => recipe.tags)).size}</div>
              </div>

              {preview.imageWarnings.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg">
                  <div className="flex items-center gap-2 font-medium mb-2">
                    <AlertTriangle size={16} />
                    图片引用提示
                  </div>
                  <ul className="space-y-1">
                    {preview.imageWarnings.slice(0, 5).map(warning => (
                      <li key={`${warning.recipeTitle}-${warning.imageUrl}`}>
                        {warning.recipeTitle}：
                        {warning.type === 'upload'
                          ? '仅导入 /uploads 路径，需要单独同步图片文件'
                          : '导入后依赖外部图片地址可访问'}
                      </li>
                    ))}
                    {preview.imageWarnings.length > 5 && (
                      <li>还有 {preview.imageWarnings.length - 5} 条图片提示</li>
                    )}
                  </ul>
                </div>
              )}

              {getImportSourceWarning(preview.recipePackage) && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle size={16} />
                    {getImportSourceWarning(preview.recipePackage)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!preview || importing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload size={18} />
            {importing ? '导入中...' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
