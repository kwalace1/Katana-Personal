import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: LucideIcon
  className?: string
  action?: React.ReactNode
  compact?: boolean
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  icon: Icon,
  className,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'kp-surface flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-10' : 'px-6 py-14',
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      ) : null}
      <h3 className="font-display text-xl tracking-tight text-foreground">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
