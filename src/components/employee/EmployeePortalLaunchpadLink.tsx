import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmployeePortalUnread } from '@/hooks/useEmployeePortalUnread'
import { EmployeePortalUnreadBadge } from '@/components/employee/EmployeePortalUnreadBadge'

interface EmployeePortalLaunchpadLinkProps {
  variant: 'sidebar' | 'header' | 'hub'
  collapsed?: boolean
  className?: string
}

export function EmployeePortalLaunchpadLink({
  variant,
  collapsed = false,
  className,
}: EmployeePortalLaunchpadLinkProps) {
  const location = useLocation()
  const isActive = location.pathname.startsWith('/employee')
  const { total: unreadCount } = useEmployeePortalUnread()

  const title =
    unreadCount > 0
      ? `Employee Portal — ${unreadCount} item${unreadCount === 1 ? '' : 's'} need attention`
      : 'Employee Portal — your personal launchpad'

  if (variant === 'header') {
    return (
      <Link
        to="/employee"
        title={title}
        className={cn(
          'relative inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15',
          isActive && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
          className,
        )}
      >
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">My Portal</span>
        <EmployeePortalUnreadBadge
          count={unreadCount}
          className="absolute -top-1 -right-1"
        />
      </Link>
    )
  }

  if (variant === 'hub') {
    return (
      <Link
        to="/employee"
        title={title}
        className={cn(
          'group relative flex items-center gap-4 rounded-xl border-2 border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 transition-all hover:border-primary/40 hover:shadow-md',
          isActive && 'border-primary bg-primary/15',
          className,
        )}
      >
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary group-hover:bg-primary/20',
            isActive && 'bg-primary text-primary-foreground',
          )}
        >
          <Sparkles className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-foreground">Employee Portal</p>
          <p className="text-sm text-muted-foreground">
            Your personal launchpad — feed, goals, performance, and profile
          </p>
        </div>
        <EmployeePortalUnreadBadge count={unreadCount} className="absolute top-4 right-4" />
        <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </Link>
    )
  }

  return (
    <Link
      to="/employee"
      title={title}
      className={cn(
        'relative flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2.5 transition-all hover:border-primary/30 hover:bg-primary/10',
        isActive && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
        collapsed ? 'justify-center px-2' : '',
        className,
      )}
    >
      <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && (
        <div className="min-w-0">
          <span className="block text-sm font-semibold leading-tight">Employee Portal</span>
          <span
            className={cn(
              'block text-xs leading-tight',
              isActive ? 'text-primary-foreground/80' : 'text-muted-foreground',
            )}
          >
            Your launchpad
          </span>
        </div>
      )}
      <EmployeePortalUnreadBadge
        count={unreadCount}
        variant={collapsed ? 'dot' : 'count'}
        className={collapsed ? 'absolute top-1 right-1' : 'ml-auto shrink-0'}
      />
    </Link>
  )
}
