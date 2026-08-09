import { NavLink, useNavigate } from 'react-router-dom'
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
  Plus,
  Newspaper,
  Trophy,
  Share2,
  Menu,
  ChevronDown,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
import { ShareWinHost } from '@/components/ShareWinHost'
import { SocialInboxProvider, useSharedSocialInbox } from '@/contexts/SocialInboxContext'

export const PRIMARY = [
  { to: '/dashboard', label: 'Today', icon: Sun },
  { to: '/ask', label: 'Ask', icon: Sparkles },
] as const

export const TOGETHER_PRIMARY = [
  { to: '/social', label: 'Social', icon: Newspaper },
] as const

export const PLAN = [
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/goals', label: 'Goals', icon: Target },
] as const

export const LIFE = [
  { to: '/habits', label: 'Habits', icon: Flame },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/health', label: 'Health and Wellness', icon: HeartPulse },
  { to: '/notes', label: 'Notes', icon: NotebookPen },
  { to: '/documents', label: 'Files', icon: FileText },
] as const

export const SOCIAL = [
  { to: '/social', label: 'Social', icon: Newspaper },
  { to: '/shared', label: 'Plans', icon: Share2 },
  { to: '/circles', label: 'Circles', icon: Trophy },
] as const

const MORE_KEY = 'katana-personal:nav-more'
const DRAWER_WIDTH = 280
const EDGE_OPEN_PX = 28
const SWIPE_OPEN_PX = 56

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
              'group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[0.925rem] font-medium transition-all duration-200',
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
  return (
    <SocialInboxProvider>
      <AppShellInner>{children}</AppShellInner>
    </SocialInboxProvider>
  )
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { profile, signOut, onboardingDone } = useAuth()
  const { cloudUser } = useCloudAuth()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(() => {
    try {
      return localStorage.getItem(MORE_KEY) === '1'
    } catch {
      return false
    }
  })
  const { pendingCount: pendingFriends } = useSharedSocialInbox()
  useNotificationToasts()

  const closeNav = useCallback(() => setNavOpen(false), [])
  const openNav = useCallback(() => setNavOpen(true), [])

  function toggleMore() {
    setMoreOpen((v) => {
      const next = !v
      try {
        localStorage.setItem(MORE_KEY, next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const socialPrimary = [
    {
      to: '/social' as const,
      label: pendingFriends > 0 ? `Social (${pendingFriends})` : 'Social',
      icon: Newspaper,
    },
  ]

  const moreSocial = SOCIAL.filter((item) => item.to !== '/social')

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-2" aria-label="Main">
      <NavGroup items={PRIMARY} onNavigate={closeNav} />
      <NavGroup items={socialPrimary} onNavigate={closeNav} />
      <div className="pt-2">
        <button
          type="button"
          onClick={toggleMore}
          className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-[0.925rem] font-medium text-muted-foreground transition hover:bg-secondary/80 hover:text-foreground"
          aria-expanded={moreOpen}
        >
          <span>More</span>
          <ChevronDown className={cn('h-4 w-4 transition', moreOpen && 'rotate-180')} />
        </button>
        {moreOpen ? (
          <div className="mt-1 space-y-1 border-l border-border/50 pl-1">
            <p className="px-3 pb-1 pt-2 text-[0.65rem] leading-snug text-muted-foreground">
              Depth when you need it — Today stays the home of the day loop.
            </p>
            <NavGroup label="Plan" items={PLAN} onNavigate={closeNav} />
            <NavGroup label="Life" items={LIFE} onNavigate={closeNav} />
            <NavGroup label="Together" items={moreSocial} onNavigate={closeNav} />
          </div>
        ) : !onboardingDone ? (
          <p className="px-3 pb-1 text-[0.7rem] text-muted-foreground">
            Plan & Life open after your first minute — the loop comes first
          </p>
        ) : (
          <p className="px-3 pb-1 text-[0.65rem] text-muted-foreground">
            Tasks, habits, health — depth, not the home
          </p>
        )}
      </div>
      <div className="mt-2">
        <NavLink
          to="/settings"
          onClick={closeNav}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[0.925rem] font-medium transition-all',
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

  const sidebarFooter = (
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
  )

  return (
    <div className="flex min-h-screen pb-[env(safe-area-inset-bottom)]">
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
        {sidebarFooter}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/40 bg-background/75 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-xl"
              aria-label="Open menu"
              aria-expanded={navOpen}
              onClick={openNav}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <BrandMark compact />
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-xl"
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
          <ShareWinHost />
        </main>
      </div>

      {/* Left-edge swipe zone — slide right to open menu on phone */}
      <EdgeSwipeOpen enabled={!navOpen} onOpen={openNav} />

      <MobileNavDrawer open={navOpen} onOpenChange={setNavOpen}>
        <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-5">
            <div onClick={closeNav}>
              <BrandMark to="/dashboard" />
            </div>
            {pendingFriends > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                {pendingFriends > 9 ? '9+' : pendingFriends} pending
              </span>
            ) : null}
          </div>
          {nav}
          {sidebarFooter}
        </div>
      </MobileNavDrawer>

      <CommandPaletteControlled open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}

/** Invisible left-edge zone: swipe right from the edge to open the nav drawer. */
function EdgeSwipeOpen({ enabled, onOpen }: { enabled: boolean; onOpen: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!enabled) return

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t || t.clientX > EDGE_OPEN_PX) {
        start.current = null
        return
      }
      start.current = { x: t.clientX, y: t.clientY }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!start.current) return
      const t = e.touches[0]
      if (!t) return
      const dx = t.clientX - start.current.x
      const dy = Math.abs(t.clientY - start.current.y)
      if (dy > 40) {
        start.current = null
        return
      }
      if (dx >= SWIPE_OPEN_PX) {
        start.current = null
        onOpen()
      }
    }

    const onTouchEnd = () => {
      start.current = null
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled, onOpen])

  return (
    <div
      className="fixed inset-y-0 left-0 z-30 w-3 touch-pan-y md:hidden"
      aria-hidden
      onPointerDown={(e) => {
        // Mouse/trackpad fallback for desktop testing in narrow viewports
        if (e.pointerType === 'touch') return
        const originX = e.clientX
        const originY = e.clientY
        const onMove = (ev: PointerEvent) => {
          const dx = ev.clientX - originX
          const dy = Math.abs(ev.clientY - originY)
          if (dy > 40) {
            cleanup()
            return
          }
          if (dx >= SWIPE_OPEN_PX) {
            cleanup()
            onOpen()
          }
        }
        const cleanup = () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', cleanup)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', cleanup)
      }}
    />
  )
}

function MobileNavDrawer({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Full-screen dismiss layer — closes on first touch/click, not delayed click */}
          <motion.div
            role="presentation"
            aria-hidden
            className="fixed inset-0 z-40 touch-manipulation bg-black/50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onOpenChange(false)
            }}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,85vw)] flex-col border-r border-border/40 bg-background shadow-xl touch-pan-y md:hidden"
            style={{ width: `min(${DRAWER_WIDTH}px, 85vw)` }}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.85 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {children}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
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
