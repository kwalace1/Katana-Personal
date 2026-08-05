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
  Users,
  Trophy,
  Share2,
  Menu,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
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
import { SocialInboxProvider, useSharedSocialInbox } from '@/contexts/SocialInboxContext'

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

const DRAWER_WIDTH = 280
const EDGE_OPEN_PX = 28
const SWIPE_OPEN_PX = 56
const SWIPE_CLOSE_PX = 80

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
  return (
    <SocialInboxProvider>
      <AppShellInner>{children}</AppShellInner>
    </SocialInboxProvider>
  )
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const { cloudUser } = useCloudAuth()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { pendingCount: pendingFriends } = useSharedSocialInbox()
  useNotificationToasts()

  const closeNav = useCallback(() => setNavOpen(false), [])
  const openNav = useCallback(() => setNavOpen(true), [])

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
      <NavGroup items={PRIMARY} onNavigate={closeNav} />
      <NavGroup label="Plan" items={PLAN} onNavigate={closeNav} />
      <NavGroup label="Life" items={LIFE} onNavigate={closeNav} />
      <NavGroup label="Together" items={togetherItems} onNavigate={closeNav} />
      <div className="mt-2">
        <NavLink
          to="/settings"
          onClick={closeNav}
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
              className="rounded-xl"
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
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_CLOSE_PX || info.velocity.x < -400) {
      onOpenChange(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,85vw)] flex-col border-r border-border/40 bg-background shadow-xl md:hidden"
            style={{ width: `min(${DRAWER_WIDTH}px, 85vw)` }}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.85 }}
            drag="x"
            dragConstraints={{ left: -DRAWER_WIDTH, right: 0 }}
            dragElastic={0.08}
            onDragEnd={handleDragEnd}
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
