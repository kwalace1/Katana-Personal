import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  CalendarDays,
  CheckSquare,
  FileText,
  Flame,
  HeartPulse,
  Sun,
  NotebookPen,
  Target,
  BookOpen,
  LogOut,
  Settings,
  Sparkles,
  Search,
  MoreHorizontal,
  Plus,
  Users,
  Trophy,
  Share2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { SimpleThemeToggle } from '@/components/SimpleThemeToggle'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { CommandPalette } from '@/components/CommandPalette'
import { NotificationBell, useNotificationToasts } from '@/components/NotificationBell'
import { BackupNudge } from '@/components/BackupNudge'
import { PwaInstallNudge } from '@/components/PwaInstallNudge'
import { WorkspaceSyncHost } from '@/components/WorkspaceSyncHost'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { listFriendships } from '@/lib/social/friends'
import { listMyPendingCircleInvites } from '@/lib/social/invites'

export const PRIMARY = [
  { to: '/dashboard', label: 'Today', icon: Sun },
  { to: '/ask', label: 'Ask', icon: Sparkles },
] as const

export const PLAN = [
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/goals', label: 'Goals', icon: Target },
] as const

export const LIFE = [
  { to: '/habits', label: 'Habits', icon: Flame },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/health', label: 'Health', icon: HeartPulse },
  { to: '/notes', label: 'Notes', icon: NotebookPen },
  { to: '/documents', label: 'Files', icon: FileText },
] as const

export const SOCIAL = [
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/shared', label: 'Shared', icon: Share2 },
  { to: '/circles', label: 'Circles', icon: Trophy },
] as const

function NavGroup({
  label,
  items,
  onNavigate,
}: {
  label?: string
  items: readonly { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
  onNavigate?: () => void
}) {
  return (
    <div className="space-y-1">
      {label ? <p className="kp-section-label px-3 pb-1 pt-3">{label}</p> : null}
      {items.map(({ to, label: itemLabel, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2 text-[0.925rem] font-medium transition-all duration-200',
              isActive
                ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]'
                : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
            )
          }
        >
          <Icon className="h-[1.05rem] w-[1.05rem] shrink-0 opacity-80" />
          {itemLabel}
        </NavLink>
      ))}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const { cloudUser } = useCloudAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [pendingFriends, setPendingFriends] = useState(0)
  useNotificationToasts()

  useEffect(() => {
    if (!cloudUser) {
      setPendingFriends(0)
      return
    }
    let cancelled = false
    void Promise.all([
      listFriendships(cloudUser.uid),
      listMyPendingCircleInvites(cloudUser.uid).catch(() => []),
    ])
      .then(([list, circleInvites]) => {
        if (cancelled) return
        const friends = list.filter((f) => f.status === 'pending' && f.requestedBy !== cloudUser.uid)
          .length
        setPendingFriends(friends + circleInvites.length)
      })
      .catch(() => {
        if (!cancelled) setPendingFriends(0)
      })
    return () => {
      cancelled = true
    }
  }, [cloudUser?.uid, location.pathname])

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const togetherItems = SOCIAL.map((item) =>
    item.to === '/friends' && pendingFriends > 0
      ? { ...item, label: `Friends (${pendingFriends})` }
      : item,
  )

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-2" aria-label="Main">
      <NavGroup items={PRIMARY} onNavigate={() => setMoreOpen(false)} />
      <NavGroup label="Plan" items={PLAN} onNavigate={() => setMoreOpen(false)} />
      <NavGroup label="Life" items={LIFE} onNavigate={() => setMoreOpen(false)} />
      <NavGroup label="Together" items={togetherItems} onNavigate={() => setMoreOpen(false)} />
      <div className="mt-2">
        <NavLink
          to="/settings"
          onClick={() => setMoreOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-[0.925rem] font-medium transition-all',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
            )
          }
        >
          <Settings className="h-[1.05rem] w-[1.05rem] shrink-0 opacity-80" />
          Settings
        </NavLink>
      </div>
    </nav>
  )

  const isToday = location.pathname === '/dashboard'
  const isTasks = location.pathname.startsWith('/tasks')
  const isHabits = location.pathname.startsWith('/habits')
  const isTogether = ['/friends', '/shared', '/circles'].includes(location.pathname)

  return (
    <div className="flex min-h-screen pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-[env(safe-area-inset-bottom)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-[100dvh] w-[17.5rem] shrink-0 flex-col border-r border-border/40 bg-card/40 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:flex">
        <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-6">
          <BrandMark to="/dashboard" />
          <div className="flex items-center gap-0.5">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              aria-label="Search"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {nav}
        <div className="mt-auto space-y-3 border-t border-border/40 p-4">
          <div className="px-1">
            <p className="truncate text-sm font-semibold tracking-tight">{profile?.display_name || 'You'}</p>
            <p className="truncate text-xs text-muted-foreground">
              {cloudUser ? 'Cloud sync on · Save a copy as backup' : 'This device · Save a copy to move'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <SimpleThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-2 rounded-xl text-muted-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/40 bg-background/75 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:hidden">
          <BrandMark compact />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              aria-label="Search or capture"
              onClick={() => setPaletteOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <SimpleThemeToggle />
          </div>
        </header>

        <main id="main-content" className="flex-1" tabIndex={-1}>
          {children}
          <BackupNudge />
          <PwaInstallNudge />
          <WorkspaceSyncHost />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/40 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Mobile"
      >
        <div className="grid grid-cols-5 gap-0.5 px-1 py-1">
          <NavLink
            to="/dashboard"
            className={cn(
              'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.65rem] font-medium',
              isToday ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Sun className="h-5 w-5" />
            Today
          </NavLink>
          <NavLink
            to="/tasks"
            className={cn(
              'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.65rem] font-medium',
              isTasks ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <CheckSquare className="h-5 w-5" />
            Tasks
          </NavLink>
          <NavLink
            to="/habits"
            className={cn(
              'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.65rem] font-medium',
              isHabits ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Flame className="h-5 w-5" />
            Habits
          </NavLink>
          <NavLink
            to="/friends"
            className={cn(
              'relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.65rem] font-medium',
              isTogether ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Users className="h-5 w-5" />
            Together
            {pendingFriends > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.55rem] font-semibold text-primary-foreground">
                {pendingFriends > 9 ? '9+' : pendingFriends}
              </span>
            ) : null}
          </NavLink>
          <button
            type="button"
            className={cn(
              'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.65rem] font-medium',
              moreOpen ? 'text-primary' : 'text-muted-foreground',
            )}
            onClick={() => setMoreOpen(true)}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle className="font-display text-left text-xl">More</SheetTitle>
          </SheetHeader>
          <p className="mt-1 px-1 text-xs text-muted-foreground">
            This device · use Settings → Save a copy to move to another phone or computer
          </p>
          <div className="mt-2 max-h-[65vh] overflow-y-auto">
            <NavGroup
              label="Capture & plan"
              items={[
                { to: '/ask', label: 'Ask', icon: Sparkles },
                { to: '/calendar', label: 'Calendar', icon: CalendarDays },
                { to: '/goals', label: 'Goals', icon: Target },
              ]}
              onNavigate={() => setMoreOpen(false)}
            />
            <NavGroup
              label="Life"
              items={LIFE.filter((i) => i.to !== '/habits')}
              onNavigate={() => setMoreOpen(false)}
            />
            <NavGroup label="Together" items={togetherItems} onNavigate={() => setMoreOpen(false)} />
            <NavLink
              to="/settings"
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                cn(
                  'mt-2 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[0.925rem] font-medium',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                )
              }
            >
              <Settings className="h-[1.05rem] w-[1.05rem] shrink-0 opacity-80" />
              Settings
            </NavLink>
          </div>
          <div className="mt-3 border-t border-border/40 pt-3">
            <Button variant="outline" className="min-h-11 w-full gap-2 rounded-xl" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <CommandPaletteControlled open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}

/** Wrapper so AppShell can open palette from Capture button while ⌘K still works. */
function CommandPaletteControlled({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return <CommandPalette open={open} onOpenChange={onOpenChange} />
}
