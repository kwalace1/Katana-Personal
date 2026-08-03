import { NavLink, Link } from 'react-router-dom'
import { EmployeePortalThemeToggle } from '@/components/employee/EmployeePortalThemeToggle'
import { NotificationCenter } from '@/components/NotificationCenter'
import { useEmployeePortalComms } from '@/contexts/EmployeePortalCommsContext'
import { useEmployeePortalUnread } from '@/hooks/useEmployeePortalUnread'
import { EmployeePortalUnreadBadge } from '@/components/employee/EmployeePortalUnreadBadge'
import {
  LayoutDashboard,
  Users,
  Star,
  Target,
  BookOpen,
  User,
  Briefcase,
  Sparkles,
  MessageSquare,
  ClipboardList,
} from 'lucide-react'

const portalItems = [
  { path: '/employee', label: 'Feed', icon: LayoutDashboard, end: true },
  { path: '/employee/work', label: 'My work', icon: ClipboardList, end: false },
  { path: '/employee/directory', label: 'People', icon: Users, end: false },
  { path: '/employee/performance', label: 'Performance', icon: Star, end: false },
  { path: '/employee/goals', label: 'Goals', icon: Target, end: false },
  { path: '/employee/development', label: 'Learning', icon: BookOpen, end: false },
  { path: '/employee/profile', label: 'Profile', icon: User, end: false },
  { path: '/employee/jobs', label: 'Jobs', icon: Briefcase, end: false },
]

export function EmployeePortalNav() {
  const { unreadCommsCount } = useEmployeePortalComms()
  const { total: unreadAttentionCount } = useEmployeePortalUnread()

  return (
    <nav
      className="sticky top-0 z-10 border-b border-border/80 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75"
      aria-label="Employee portal"
      data-tour="launchpad-nav"
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between gap-2 py-3">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {portalItems.map(({ path, label, icon: Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors shrink-0 ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
                {path === '/employee' && (
                  <EmployeePortalUnreadBadge
                    count={unreadAttentionCount}
                    className="absolute -top-0.5 -right-0.5"
                  />
                )}
              </NavLink>
            ))}
            {unreadCommsCount > 0 && (
              <Link
                to="/comms"
                title="Open unread messages in Katana Comms"
                className="relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
              >
                <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Messages</span>
                <EmployeePortalUnreadBadge count={unreadCommsCount} className="sm:ml-0" />
              </Link>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <NotificationCenter variant="portal" />
            <EmployeePortalThemeToggle />
            <Link
              to="/hub"
              title="Go to Katana Hub"
              data-tour="launchpad-hub-link"
              className="flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
            >
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Hub</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
