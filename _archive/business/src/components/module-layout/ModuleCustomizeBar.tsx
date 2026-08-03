import { Check, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ModuleCustomizeBarProps {
  customizeMode: boolean
  onEnterCustomize: () => void
  onDone: () => void
  /** Short product name in instruction copy, e.g. "Projects" */
  surfaceLabel: string
  className?: string
  customizeButtonClassName?: string
  dataTourCustomize?: string
}

export function ModuleCustomizeControls({
  customizeMode,
  onEnterCustomize,
  onDone,
  className,
  dataTourCustomize = 'module-customize',
}: Omit<ModuleCustomizeBarProps, 'surfaceLabel'> & { className?: string }) {
  if (customizeMode) {
    return (
      <Button
        variant="default"
        size="sm"
        className={cn('gap-2', className)}
        aria-label="Save layout"
        onClick={onDone}
      >
        <Check className="h-4 w-4" />
        Done
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('gap-2', className)}
      data-tour={dataTourCustomize}
      aria-label="Customize layout"
      onClick={onEnterCustomize}
    >
      <LayoutGrid className="h-4 w-4" />
      Customize
    </Button>
  )
}

export function ModuleCustomizeHint({
  surfaceLabel,
  className,
}: {
  surfaceLabel: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground',
        className
      )}
    >
      <span className="font-medium text-foreground">Customize your {surfaceLabel}.</span> Drag
      widgets to move them, resize from the edges, add from the catalog, and remove what you
      don&apos;t need. Click <span className="font-medium text-foreground">Done</span> when
      finished.
    </div>
  )
}
