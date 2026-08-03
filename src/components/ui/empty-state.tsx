import { type LucideIcon, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: LucideIcon
  className?: string
  /** Optional action (e.g. button) to show below description */
  action?: React.ReactNode
  /** If true, use compact padding. Default false. */
  compact?: boolean
}

export function EmptyState({
  title = 'No data yet',
  description,
  icon: Icon = Inbox,
  className,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center text-muted-foreground',
        compact ? 'py-8 px-4' : 'py-12 px-6',
        className
      )}
    >
      <Icon className="h-12 w-12 mb-3 opacity-50" aria-hidden />
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  )
}
