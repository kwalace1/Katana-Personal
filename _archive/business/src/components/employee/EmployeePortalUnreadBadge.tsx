import { cn } from '@/lib/utils'
import { formatPortalUnreadCount } from '@/lib/employee-portal-unread'

interface EmployeePortalUnreadBadgeProps {
  count: number
  /** count = numeric pill; dot = small indicator without number */
  variant?: 'count' | 'dot'
  className?: string
}

export function EmployeePortalUnreadBadge({
  count,
  variant = 'count',
  className,
}: EmployeePortalUnreadBadgeProps) {
  if (count <= 0) return null

  if (variant === 'dot') {
    return (
      <span
        className={cn(
          'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background',
          className
        )}
        aria-hidden
      />
    )
  }

  return (
    <span
      className={cn(
        'flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground',
        className
      )}
    >
      {formatPortalUnreadCount(count)}
    </span>
  )
}
