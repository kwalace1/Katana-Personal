import type { ReactNode } from 'react'
import { Eye, EyeOff, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ModuleSectionMeta } from '@/lib/module-layout'

interface ModuleSectionFrameProps {
  sectionId: string
  label: string
  description: string
  customizeMode: boolean
  isHidden: boolean
  isDragging: boolean
  draggable: boolean
  onDragStart: () => void
  onDragEnter: () => void
  onDragEnd: () => void
  onKeyDown: (event: React.KeyboardEvent) => void
  onToggleHidden: () => void
  children: ReactNode
  className?: string
  /** Optional tour selector value for data-tour */
  dataTour?: string
}

export function ModuleSectionFrame({
  sectionId,
  label,
  description,
  customizeMode,
  isHidden,
  isDragging,
  draggable,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onKeyDown,
  onToggleHidden,
  children,
  className,
  dataTour,
}: ModuleSectionFrameProps) {
  if (!customizeMode && isHidden) return null

  return (
    <section
      data-module-section={sectionId}
      data-tour={dataTour}
      className={cn(
        'relative transition-all',
        customizeMode && 'rounded-xl border border-dashed border-primary/30 bg-muted/20 p-3',
        isHidden && customizeMode && 'opacity-60',
        isDragging && 'opacity-50 scale-[0.99]',
        className
      )}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', sectionId)
        onDragStart()
      }}
      onDragEnter={(event) => {
        if (!draggable) return
        event.preventDefault()
        onDragEnter()
      }}
      onDragOver={(event) => {
        if (!draggable) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDragEnd={onDragEnd}
      onKeyDown={onKeyDown}
      tabIndex={customizeMode ? 0 : -1}
      role={customizeMode ? 'button' : undefined}
      aria-label={
        customizeMode
          ? `${label}. Press arrow keys to reorder, or drag to move.`
          : undefined
      }
    >
      {customizeMode && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md bg-primary text-primary-foreground active:cursor-grabbing"
              aria-label="Drag section handle"
            >
              <GripVertical className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{label}</p>
              <p className="text-xs text-muted-foreground truncate">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isHidden && (
              <Badge variant="secondary" className="text-xs">
                Hidden
              </Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={(event) => {
                event.stopPropagation()
                onToggleHidden()
              }}
              aria-label={isHidden ? `Show ${label}` : `Hide ${label}`}
            >
              {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
      {children}
    </section>
  )
}

export function sectionMetaProps(
  meta: ModuleSectionMeta
): Pick<ModuleSectionFrameProps, 'label' | 'description'> {
  return { label: meta.label, description: meta.description }
}
