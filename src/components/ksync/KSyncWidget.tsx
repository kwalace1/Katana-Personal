import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getKSyncContext } from '@/lib/ksync-context'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { AgentChatPopover } from '@/components/agent-office/popup/AgentChatPopover'

const NUDGE_DELAY_MS = 900
const DISMISSED_KEY = 'ksync_dismissed_nudges'

interface OpenContext {
  agentName: string
  moduleLabel: string
}

function loadDismissedNudges(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveDismissedNudge(path: string) {
  try {
    const set = loadDismissedNudges()
    set.add(path)
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
}

/**
 * Floating agent helper — opens the module's specialist in Agent Office.
 * Internal name remains KSyncWidget for import stability; user-facing copy is agent-only.
 */
export function KSyncWidget() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const pageContext = useMemo(
    () => getKSyncContext(location.pathname),
    [location.pathname],
  )

  const [showNudge, setShowNudge] = useState(false)
  // When set, the inline chat popup is open for this captured agent context.
  const [openContext, setOpenContext] = useState<OpenContext | null>(null)
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const routeKey = location.pathname.replace(/\/$/, '') || '/'

  // Hub is the home page — clear any stale dismissal whenever the user lands
  // there so the nudge always reappears, regardless of prior interactions.
  useEffect(() => {
    if (pageContext.moduleId !== 'hub') return
    try {
      const set = loadDismissedNudges()
      if (set.has(routeKey)) {
        set.delete(routeKey)
        sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]))
      }
    } catch { /* ignore */ }
  }, [pageContext.moduleId, routeKey])

  useEffect(() => {
    return () => {
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
    }
  }, [])

  useEffect(() => {
    if (pageContext.hidden || !pageContext.nudge) {
      setShowNudge(false)
      return
    }

    setShowNudge(false)
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current)

    if (loadDismissedNudges().has(routeKey)) return

    nudgeTimer.current = setTimeout(() => {
      if (!loadDismissedNudges().has(routeKey)) {
        setShowNudge(true)
      }
    }, NUDGE_DELAY_MS)

    return () => {
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
    }
  }, [routeKey, pageContext.hidden, pageContext.nudge])

  const dismissNudge = useCallback(() => {
    // Hub is the home page — don't suppress its nudge permanently within
    // the session so it can reappear each time the user returns there.
    if (pageContext.moduleId !== 'hub') {
      saveDismissedNudge(routeKey)
    }
    setShowNudge(false)
  }, [routeKey, pageContext.moduleId])

  // Open the inline chat, capturing the current page's agent so it stays fixed
  // even if the user navigates while chatting.
  const openChat = useCallback(() => {
    setShowNudge(false)
    setOpenContext({
      agentName: pageContext.agentName,
      moduleLabel: pageContext.moduleLabel,
    })
  }, [pageContext.agentName, pageContext.moduleLabel])

  const closeChat = useCallback(() => setOpenContext(null), [])

  // Hand off to the full Agent Office for the selected agent.
  const openFull = useCallback((agentId: string | null) => {
    setOpenContext(null)
    if (agentId) {
      navigate(`/agents/chat/${agentId}`)
    } else {
      navigate('/agents', {
        state: {
          agentName: pageContext.agentName,
          moduleLabel: pageContext.moduleLabel,
          fromPath: location.pathname,
        },
      })
    }
  }, [navigate, pageContext.agentName, pageContext.moduleLabel, location.pathname])

  // Escape closes the open chat.
  useEffect(() => {
    if (!openContext) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenContext(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openContext])

  if (!user || pageContext.hidden) return null

  const isOpen = openContext !== null

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      <AnimatePresence mode="popLayout">
        {isOpen && (
          <AgentChatPopover
            key="popover"
            agentName={openContext.agentName}
            moduleLabel={openContext.moduleLabel}
            onClose={closeChat}
            onOpenFull={openFull}
          />
        )}

        {!isOpen && showNudge && (
          <motion.div
            key={`nudge-${routeKey}`}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="pointer-events-auto w-[min(100vw-2.5rem,340px)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
          >
            <div className="flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-sm font-semibold">{pageContext.agentName}</p>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                    {pageContext.moduleLabel}
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{pageContext.nudge}</p>
              </div>
              <button
                type="button"
                onClick={dismissNudge}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
              <Button size="sm" className="h-8 flex-1 text-xs" onClick={openChat}>
                Talk to Agent
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground"
                onClick={dismissNudge}
              >
                Not now
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <motion.button
          type="button"
          layout
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={openChat}
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background shadow-lg transition-shadow hover:shadow-xl',
            showNudge ? 'px-4 py-2.5 ring-2 ring-primary/25' : 'h-12 w-12 justify-center',
          )}
          aria-label={`Talk to ${pageContext.agentName}`}
        >
          <Sparkles className={cn('text-primary', showNudge ? 'h-4 w-4' : 'h-5 w-5')} />
          {showNudge && (
            <span className="text-sm font-medium">{pageContext.agentName}</span>
          )}
          {showNudge && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
        </motion.button>
      )}
    </div>
  )
}
