import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: LucideIcon
  className?: string
  action?: React.ReactNode
  compact?: boolean
  /** Skip the card chrome when this already sits inside a section. */
  plain?: boolean
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  icon: Icon,
  className,
  action,
  compact = false,
  plain = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-5 text-center',
        plain ? 'px-0 py-2' : 'kp-surface',
        compact && 'py-5',
        className,
      )}
    >
      {Icon ? (
        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      ) : null}
      <h3 className="font-display text-base tracking-tight text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
