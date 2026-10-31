import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: LucideIcon
  className?: string
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  /** Tighter padding for a section that already has its own heading. */
  compact?: boolean
  /** Skip the card chrome when this sits in the page flow or inside another surface. */
  plain?: boolean
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  icon: Icon,
  className,
  action,
  secondaryAction,
  compact = false,
  plain = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 text-center',
        plain ? 'py-12 sm:py-16' : 'kp-surface py-8',
        compact && 'px-3 py-6 sm:py-8',
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-border bg-secondary text-foreground">
          <Icon className="size-5" aria-hidden />
        </div>
      ) : null}
      <h3 className="font-display text-lg tracking-tight text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  )
}
