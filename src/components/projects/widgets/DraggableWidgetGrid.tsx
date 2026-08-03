import { ReactNode, useState, Children } from "react"

interface DraggableWidgetGridProps {
  children: ReactNode
  columns?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: number
  className?: string
  isEditMode?: boolean
  onReorder?: (newOrder: string[]) => void
  widgetIds: string[]
}

export function DraggableWidgetGrid({
  children,
  columns = { md: 2, lg: 3 },
  gap = 4,
  className = "",
  isEditMode = false,
  onReorder,
  widgetIds,
}: DraggableWidgetGridProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragEnter = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return

    if (onReorder) {
      const newOrder = [...widgetIds]
      const draggedItem = newOrder[draggedIndex]
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(index, 0, draggedItem)
      onReorder(newOrder)
      setDraggedIndex(index)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const gridClasses = [
    'grid',
    `gap-${gap}`,
    columns.sm && `sm:grid-cols-${columns.sm}`,
    columns.md && `md:grid-cols-${columns.md}`,
    columns.lg && `lg:grid-cols-${columns.lg}`,
    columns.xl && `xl:grid-cols-${columns.xl}`,
    className
  ].filter(Boolean).join(' ')

  // Clone children and add drag handlers if in edit mode
  const childrenArray = Children.toArray(children)
  const enhancedChildren = isEditMode
    ? childrenArray.map((child, index) => {
        if (typeof child === 'object' && child !== null && 'props' in child) {
          return {
            ...child,
            props: {
              ...child.props,
              index,
              onDragStart: handleDragStart,
              onDragEnter: handleDragEnter,
              onDragEnd: handleDragEnd,
            }
          }
        }
        return child
      })
    : children

  return (
    <div className={gridClasses}>
      {enhancedChildren}
    </div>
  )
}

