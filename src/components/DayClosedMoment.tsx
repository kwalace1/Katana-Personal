import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Moon, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { burstConfetti } from '@/lib/celebrate'
import { springSoft } from '@/lib/motion-ui'
import type { DayCloseSummary } from '@/lib/ritual-path'

export type { DayCloseSummary }

/** Signature evening beat — day card → optional Social share → rest. */
export function DayClosedMoment({
  open,
  summary,
  onShare,
  onDone,
}: {
  open: boolean
  summary: DayCloseSummary
  onShare: () => void
  onDone: () => void
}) {
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => burstConfetti(), 280)
    return () => window.clearTimeout(t)
  }, [open])

  const habitLine =
    summary.habitsDue > 0
      ? `${summary.habitsDone}/${summary.habitsDue} habits`
      : summary.habitsDone > 0
        ? `${summary.habitsDone} habit${summary.habitsDone === 1 ? '' : 's'}`
        : null
  const bits = [
    habitLine,
    summary.waterGlasses > 0 ? `${summary.waterGlasses} glasses` : null,
    summary.parked > 0 ? `${summary.parked} parked` : 'Inbox clear',
  ].filter(Boolean)

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="day-closed"
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-closed-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[hsl(225_28%_8%)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-white"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,hsl(200_50%_40%/0.28),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_90%,hsl(172_45%_30%/0.2),transparent_45%)]" />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={springSoft}
            className="relative w-full max-w-sm text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...springSoft, delay: 0.08 }}
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <Moon className="h-7 w-7" />
            </motion.div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/55">
              Signature · Day card
            </p>
            <h2 id="day-closed-title" className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">
              Day closed
            </h2>
            <p className="mt-1 text-sm text-white/60">{summary.dateLabel}</p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springSoft, delay: 0.12 }}
              className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-white/15 bg-gradient-to-br from-[hsl(225_32%_14%)] via-[hsl(210_36%_20%)] to-[hsl(172_40%_16%)] p-6 text-left shadow-[0_24px_60px_hsl(220_40%_4%/0.45)]"
            >
              <Moon className="pointer-events-none absolute -right-1 top-5 h-24 w-24 text-white/[0.08]" aria-hidden />
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                Day closed
              </p>
              <p className="mt-2 font-display text-2xl tracking-tight sm:text-3xl">{summary.dateLabel}</p>
              <p className="mt-1 text-sm text-white/75">One next step. Then rest.</p>
              {bits.length > 0 ? (
                <p className="mt-4 text-sm font-medium text-white/95">{bits.join(' · ')}</p>
              ) : null}
              {summary.noteSnippet?.trim() ? (
                <p className="mt-4 border-t border-white/15 pt-3 text-sm italic text-white/80">
                  “{summary.noteSnippet.trim().slice(0, 120)}
                  {summary.noteSnippet.trim().length > 120 ? '…' : ''}”
                </p>
              ) : null}
            </motion.div>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                type="button"
                className="min-h-12 gap-2 bg-white text-[hsl(225_28%_12%)] hover:bg-white/90"
                onClick={onShare}
              >
                <Share2 className="h-4 w-4" />
                Share your day
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-12 border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={onDone}
              >
                Good night
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
