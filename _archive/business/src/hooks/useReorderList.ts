import { useCallback, useRef, useState } from 'react'

/** Drag-and-drop + keyboard reordering for a list identified by array indices. */
export function useReorderList<T>(items: T[]) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const draggedIndexRef = useRef<number | null>(null)

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index)
    draggedIndexRef.current = index
  }, [])

  const handleDragEnter = useCallback(
    (index: number, reorder: (fromIndex: number, toIndex: number) => void) => {
      const fromIndex = draggedIndexRef.current
      if (fromIndex === null || fromIndex === index) return
      reorder(fromIndex, index)
      setDraggedIndex(index)
      draggedIndexRef.current = index
    },
    []
  )

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
    draggedIndexRef.current = null
  }, [])

  const handleKeyDown = useCallback(
    (
      event: React.KeyboardEvent,
      currentIndex: number,
      reorder: (fromIndex: number, toIndex: number) => void
    ) => {
      if (event.key === 'ArrowUp' && currentIndex > 0) {
        event.preventDefault()
        reorder(currentIndex, currentIndex - 1)
      } else if (event.key === 'ArrowDown' && currentIndex < items.length - 1) {
        event.preventDefault()
        reorder(currentIndex, currentIndex + 1)
      }
    },
    [items.length]
  )

  return {
    draggedIndex,
    handleDragStart,
    handleDragEnter,
    handleDragEnd,
    handleKeyDown,
  }
}
