'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  getCookingSession,
  updateStepOrder,
  toggleStepDone,
  toggleIngredientDone,
  UnifiedCookingSession,
} from '@/lib/storage/client'
import {
  DndContext,
  DragEndEvent,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import { getStepSortableId, reorderStepsBySortableIds } from '@/lib/cooking-timeline'

interface Step {
  id?: number
  phase: 'prep' | 'cook'
  sourceRecipeTitle: string
  color: string
  text: string
  sort: number
  done: boolean
}

interface Ingredient {
  id?: number
  sourceRecipeTitle: string
  color: string
  name: string
  amount?: string
  done: boolean
}

function DraggableStep({
  step,
  index,
  sortableId,
  onToggleDone,
}: {
  step: Step
  index: number
  sortableId: string
  onToggleDone: (index: number, done: boolean) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId })

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const phaseLabel = step.phase === 'prep' ? '准备' : '制作'
  const phaseColor =
    step.phase === 'prep'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-orange-100 text-orange-700'

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderLeftColor: step.color,
        borderLeftWidth: '4px',
      }}
      className={`p-4 border rounded-lg bg-white ${step.done ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 p-2 -ml-2 text-gray-400 hover:text-gray-600 cursor-grab touch-none"
          style={{ minHeight: '44px', minWidth: '44px' }}
          aria-label="拖拽排序"
        >
          <GripVertical size={24} />
        </button>
        <div className="flex-1 min-w-0">
          {/* 菜谱名标签（突出显示） */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-semibold"
              style={{
                backgroundColor: step.color + '20',
                color: step.color,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: step.color }}
              />
              {step.sourceRecipeTitle}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${phaseColor}`}>
              {phaseLabel}
            </span>
          </div>
          {/* 步骤内容 */}
          <p className={`text-base ${step.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {step.text}
          </p>
        </div>
        <input
          type="checkbox"
          checked={step.done}
          onChange={(e) => onToggleDone(index, e.target.checked)}
          className="mt-2 w-5 h-5 rounded cursor-pointer"
        />
      </div>
    </div>
  )
}

export default function CookingSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [session, setSession] = useState<UnifiedCookingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSession()
  }, [id])

  const loadSession = async () => {
    setLoading(true)
    try {
      const data = await getCookingSession(id)
      setSession(data)
    } catch (error) {
      console.error('加载失败', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!session) return

    const { active, over } = event
    if (!over || active.id === over.id) return

    const { steps: newSteps, stepIds } = reorderStepsBySortableIds(
      session.steps,
      active.id,
      over.id
    )
    setSession({ ...session, steps: newSteps })

    setSaving(true)
    try {
      // #14 传入真实 stepIds
      await updateStepOrder(id, stepIds)
    } catch (error) {
      console.error('保存失败', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStepDone = async (index: number, done: boolean) => {
    if (!session) return

    const step = session.steps[index]
    const newSteps = [...session.steps]
    newSteps[index] = { ...step, done }
    setSession({ ...session, steps: newSteps })

    try {
      // #14 传入真实 stepId
      if (step.id !== undefined) {
        await toggleStepDone(id, step.id, done)
      }
    } catch (error) {
      console.error('保存失败', error)
    }
  }

  const handleToggleIngredientDone = async (index: number, done: boolean) => {
    if (!session) return

    const ing = session.ingredients[index]
    const newIngredients = [...session.ingredients]
    newIngredients[index] = { ...ing, done }
    setSession({ ...session, ingredients: newIngredients })

    try {
      // #14 传入真实 ingredientId
      if (ing.id !== undefined) {
        await toggleIngredientDone(id, ing.id, done)
      }
    } catch (error) {
      console.error('保存失败', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">加载中...</div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">未找到该计划</p>
          <Link href="/cooking" className="text-blue-600">
            返回
          </Link>
        </div>
      </div>
    )
  }

  // 按菜谱分组食材
  const ingredientsByRecipe = session.ingredients.reduce(
    (acc: any, ing: Ingredient) => {
      if (!acc[ing.sourceRecipeTitle]) {
        acc[ing.sourceRecipeTitle] = []
      }
      acc[ing.sourceRecipeTitle].push(ing)
      return acc
    },
    {}
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/cooking" className="text-gray-600 hover:text-gray-900">
            ← 返回
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{session.name}</h1>
          <div className="flex items-center gap-2">
            {session.source === 'local' && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                本地
              </span>
            )}
            {saving && <span className="text-sm text-gray-500">保存中...</span>}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* 食材清单 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
              🥬
            </span>
            食材清单
          </h2>
          <div className="bg-white rounded-lg p-4">
            {Object.entries(ingredientsByRecipe).map(
              ([recipeTitle, items]: [string, any]) => (
                <div key={recipeTitle} className="mb-4 last:mb-0">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    {recipeTitle}
                  </h3>
                  <div className="space-y-1">
                    {items.map((ing: Ingredient, idx: number) => {
                      const globalIndex = session.ingredients.findIndex(
                        (i) => i === ing
                      )
                      return (
                        <label
                          key={globalIndex}
                          className={`flex items-center gap-2 py-1 ${
                            ing.done ? 'opacity-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={ing.done}
                            onChange={(e) =>
                              handleToggleIngredientDone(
                                globalIndex,
                                e.target.checked
                              )
                            }
                            className="w-4 h-4 rounded"
                          />
                          <span
                            className={
                              ing.done
                                ? 'line-through text-gray-400'
                                : 'text-gray-700'
                            }
                          >
                            {ing.name}
                          </span>
                          {ing.amount && (
                            <span className="text-gray-500 text-sm">
                              ({ing.amount})
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        {/* 统一时间线 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm">
              🔄
            </span>
            操作时间线
          </h2>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={session.steps.map((step, idx) => getStepSortableId(step, idx))}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {session.steps.map((step: Step, index: number) => {
                  const sortableId = getStepSortableId(step, index)
                  return (
                    <DraggableStep
                      key={sortableId}
                      step={step}
                      index={index}
                      sortableId={sortableId}
                      onToggleDone={handleToggleStepDone}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        {/* 进度统计 */}
        <div className="mt-8 p-4 bg-white rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">完成进度</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{
                    width: `${
                      session.steps.length > 0
                        ? (session.steps.filter((s) => s.done).length /
                            session.steps.length) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <span className="text-sm text-gray-600">
              {session.steps.filter((s) => s.done).length} / {session.steps.length}
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
