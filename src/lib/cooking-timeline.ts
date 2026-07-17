export interface TimelineStepWithId {
  id?: number
}

export function getStepSortableId(step: TimelineStepWithId, index: number) {
  return step.id == null ? `step-index-${index}` : `step-${step.id}`
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = items.slice()
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export function reorderStepsBySortableIds<T extends TimelineStepWithId>(
  steps: T[],
  activeId: string | number,
  overId: string | number
) {
  const oldIndex = steps.findIndex(
    (step, index) => getStepSortableId(step, index) === String(activeId)
  )
  const newIndex = steps.findIndex(
    (step, index) => getStepSortableId(step, index) === String(overId)
  )

  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return {
      steps,
      stepIds: steps
        .map((step) => step.id)
        .filter((id): id is number => id != null),
    }
  }

  const reorderedSteps = moveItem(steps, oldIndex, newIndex)

  return {
    steps: reorderedSteps,
    stepIds: reorderedSteps
      .map((step) => step.id)
      .filter((id): id is number => id != null),
  }
}
