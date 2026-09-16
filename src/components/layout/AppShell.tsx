import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom'
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
  ChevronRight,
  ListTodo,
  Users,
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
import { IntegrationSyncHost } from '@/components/IntegrationSyncHost'
import { PushScheduleHost } from '@/components/PushScheduleHost'
import { CardioTrackHost } from '@/components/CardioTrackHost'
import { ShareWinHost } from '@/components/ShareWinHost'
import { SocialInboxProvider, useSharedSocialInbox } from '@/contexts/SocialInboxContext'
import { useKeepInputVisible } from '@/hooks/useKeepInputVisible'
import { resolveProfilePhotoUrl } from '@/lib/social/friends'
import { FeedAvatar, profilePath } from '@/modules/social/components/feed-ui'

export const PRIMARY = [
  { to: '/dashboard', label: 'Today', icon: Sun },
  { to: '/ask', label: 'Ask', icon: Sparkles },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
] as const

export const TOGETHER_PRIMARY = [
  { to: '/social', label: 'Social', icon: Newspaper },
] as const

export const PLAN = [
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/habits', label: 'Habits', icon: Flame },
  { to: '/notes', label: 'Notes', icon: NotebookPen },
  { to: '/documents', label: 'Files', icon: FileText },
] as const

export const LIFE = [
  { to: '/health', label: 'Health & Wellness', icon: HeartPulse },
  { to: '/journal', label: 'Journal', icon: BookOpen },
] as const

export const SOCIAL = [
  { to: '/social', label: 'Social', icon: Newspaper },
  { to: '/shared', label: 'Plans', icon: Share2 },
  { to: '/circles', label: 'Circles', icon: Trophy },
] as const

/** Together section under the top-level Social link (no duplicate Social row). */
export const TOGETHER_MORE = [
  { to: '/shared', label: 'Plans', icon: Share2 },
  { to: '/circles', label: 'Circles', icon: Trophy },
] as const

const NAV_SECTION_KEYS = {
  plan: 'katana-personal:nav-plan',
  life: 'katana-personal:nav-life',
  together: 'katana-personal:nav-together',
} as const
const DRAWER_WIDTH = 280
const EDGE_OPEN_PX = 28
const SWIPE_OPEN_PX = 56

function readNavOpen(key: string, fallback = false) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === '1') return true
    if (raw === '0') return false
  } catch {
    // ignore
  }
  return fallback
}

function writeNavOpen(key: string, open: boolean) {
  try {
    localStorage.setItem(key, open ? '1' : '0')
  } catch {
    // ignore
  }
}

function NavGroup({
  label,
  items,
  onNavigate,
}: {
  label?: string
  items: readonly { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
  onNavigate?: () => void
}) {
  const location = useLocation()
  return (
    <div className="space-y-1">
      {label ? <p className="kp-section-label px-3 pb-1 pt-3">{label}</p> : null}
      {items.map(({ to, label: itemLabel, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={() => {
            const path = to.split('?')[0]
            const query = to.includes('?') ? new URLSearchParams(to.split('?')[1]) : null
            const search = new URLSearchParams(location.search)
            const active = query
              ? location.pathname === path &&
                [...query.entries()].every(([key, value]) => search.get(key) === value)
              : location.pathname === path
            return cn(
              'group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[0.925rem] font-medium transition-all duration-200',
              active
                ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]'
                : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
            )
          }}
        >
          <Icon className="h-[1.05rem] w-[1.05rem] shrink-0 opacity-80" />
          {itemLabel}
        </NavLink>
      ))}
    </div>
  )
}

function NavExpandable({
  label,
  icon: Icon,
  open,
  onToggle,
  items,
  onNavigate,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  open: boolean
  onToggle: () => void
  items: readonly { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
  onNavigate?: () => void
}) {
  return (
    <div className="pt-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-[0.925rem] font-medium text-muted-foreground transition hover:bg-secondary/80 hover:text-foreground"
        aria-expanded={open}
      >
        <Icon className="h-[1.05rem] w-[1.05rem] shrink-0 opacity-80" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="mt-0.5 space-y-1 border-l border-border/50 pl-1">
          <NavGroup items={items} onNavigate={onNavigate} />
        </div>
      ) : null}
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
  const { cloudUser, cloudProfile, signOutCloud } = useCloudAuth()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(() => readNavOpen(NAV_SECTION_KEYS.plan))
  const [lifeOpen, setLifeOpen] = useState(() => readNavOpen(NAV_SECTION_KEYS.life))
  const [togetherOpen, setTogetherOpen] = useState(() => readNavOpen(NAV_SECTION_KEYS.together))
  const [photoURL, setPhotoURL] = useState<string | null>(null)
  const { pendingCount: pendingFriends } = useSharedSocialInbox()
  useNotificationToasts()
  useKeepInputVisible()

  const displayName = cloudProfile?.displayName || profile?.display_name || 'You'
  const profileTo = cloudUser ? profilePath(cloudUser.uid) : '/settings/together'

  useEffect(() => {
    if (!cloudProfile?.photoURL) {
      setPhotoURL(null)
      return
    }
    let cancelled = false
    void resolveProfilePhotoUrl(cloudProfile.photoURL).then((url) => {
      if (!cancelled) setPhotoURL(url)
    })
    return () => {
      cancelled = true
    }
  }, [cloudProfile?.photoURL])

  const closeNav = useCallback(() => setNavOpen(false), [])
  const openNav = useCallback(() => setNavOpen(true), [])

  function toggleSection(section: keyof typeof NAV_SECTION_KEYS, open: boolean, setOpen: (v: boolean) => void) {
    const next = !open
    writeNavOpen(NAV_SECTION_KEYS[section], next)
    setOpen(next)
  }

  async function handleSignOut() {
    await signOutCloud()
    await signOut()
    navigate('/')
  }

  const socialPrimary = onboardingDone
    ? [
        {
          to: '/social' as const,
          label: pendingFriends > 0 ? `Social (${pendingFriends})` : 'Social',
          icon: Newspaper,
        },
      ]
    : []

  const primaryItems = onboardingDone ? PRIMARY : PRIMARY.filter((item) => item.to === '/dashboard')

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-2" aria-label="Main">
      <NavGroup items={primaryItems} onNavigate={closeNav} />
      {socialPrimary.length > 0 ? <NavGroup items={socialPrimary} onNavigate={closeNav} /> : null}
      {onboardingDone ? (
        <div className="mt-1 space-y-0.5">
          <NavExpandable
            label="Plan"
            icon={ListTodo}
            open={planOpen}
            onToggle={() => toggleSection('plan', planOpen, setPlanOpen)}
            items={PLAN}
            onNavigate={closeNav}
          />
          <NavExpandable
            label="Life"
            icon={HeartPulse}
            open={lifeOpen}
            onToggle={() => toggleSection('life', lifeOpen, setLifeOpen)}
            items={LIFE}
            onNavigate={closeNav}
          />
          <NavExpandable
            label="Together"
            icon={Users}
            open={togetherOpen}
            onToggle={() => toggleSection('together', togetherOpen, setTogetherOpen)}
            items={TOGETHER_MORE}
            onNavigate={closeNav}
          />
        </div>
      ) : (
        <p className="px-3 pb-1 text-[0.7rem] text-muted-foreground">
          Finish your first minute — Ask opens when the loop reaches it
        </p>
      )}
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
      <Link
        to={profileTo}
        onClick={closeNav}
        className="flex items-center gap-3 rounded-xl px-1 py-1.5 transition hover:bg-secondary/60"
      >
        <FeedAvatar name={displayName} photoURL={photoURL} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">{displayName}</p>
          <p className="text-xs leading-snug text-muted-foreground">
            {cloudUser
              ? 'Your profile · bio & photo'
              : 'Connect to set up your profile'}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
      <p className="px-1 text-[0.7rem] text-muted-foreground">
        {cloudUser ? 'Cloud sync on · Save a copy as backup' : 'This device · Save a copy to move'}
      </p>
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

      <aside className="kp-glass-chrome sticky top-0 hidden h-[100dvh] w-[17.5rem] shrink-0 flex-col border-r pt-[env(safe-area-inset-top)] md:flex">
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
        <header className="kp-glass-chrome sticky top-0 z-20 flex items-center justify-between border-b px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden">
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
          <IntegrationSyncHost />
          <PushScheduleHost />
          <ShareWinHost />
          <CardioTrackHost />
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
            className="fixed inset-0 z-40 touch-manipulation bg-black/35 backdrop-blur-sm md:hidden"
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
            className="kp-glass-chrome fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,85vw)] flex-col border-r touch-pan-y md:hidden"
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
