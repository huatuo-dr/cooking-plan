import { describe, expect, it } from 'vitest'
import {
  getStepSortableId,
  reorderStepsBySortableIds,
  type TimelineStepWithId,
} from './cooking-timeline'

interface TestTimelineStep extends TimelineStepWithId {
  color: string
}

describe('cooking timeline sortable identity', () => {
  it('keeps a step sortable id stable when its index changes', () => {
    const step: TimelineStepWithId = { id: 42 }

    expect(getStepSortableId(step, 0)).toBe('step-42')
    expect(getStepSortableId(step, 3)).toBe('step-42')
  })

  it('reorders steps by stable sortable ids and returns persisted step ids', () => {
    const steps: TestTimelineStep[] = [
      { id: 1, color: '#e8590c' },
      { id: 2, color: '#1971c2' },
      { id: 3, color: '#2f9e44' },
    ]

    const result = reorderStepsBySortableIds(steps, 'step-1', 'step-3')

    expect(result.steps.map((step) => step.id)).toEqual([2, 3, 1])
    expect(result.stepIds).toEqual([2, 3, 1])
    expect(result.steps.map((step) => step.color)).toEqual([
      '#1971c2',
      '#2f9e44',
      '#e8590c',
    ])
  })
})
