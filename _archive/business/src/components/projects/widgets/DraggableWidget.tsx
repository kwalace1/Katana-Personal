import { ReactNode, DragEvent } from "react"
import { GripVertical } from "lucide-react"

interface DraggableWidgetProps {
  id: string
  index: number
  children: ReactNode
  isEditMode?: boolean
  onDragStart?: (index: number) => void
  onDragEnter?: (index: number) => void
  onDragEnd?: () => void
}

export function DraggableWidget({ 
  id, 
  index,
  children, 
  isEditMode = false,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: DraggableWidgetProps) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (!isEditMode) return
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/html", id)
    if (onDragStart) onDragStart(index)
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (!isEditMode) return
    e.preventDefault()
    if (onDragEnter) onDragEnter(index)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!isEditMode) return
    e.preventDefault()
  }

  const handleDragEnd = () => {
    if (!isEditMode) return
    if (onDragEnd) onDragEnd()
  }

  return (
    <div
      draggable={isEditMode}
      onDragStart={handleDragStart}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      className="relative"
    >
      {isEditMode && (
        <div className="absolute -top-2 -left-2 z-10 cursor-grab active:cursor-grabbing bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg hover:scale-110 transition-transform">
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <div className={isEditMode ? "ring-2 ring-primary ring-offset-2 rounded-lg transition-all" : ""}>
        {children}
      </div>
    </div>
  )
}

