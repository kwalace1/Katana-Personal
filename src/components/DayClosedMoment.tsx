import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { springSoft } from '@/lib/motion-ui'

/** Full-bleed “Day closed” beat after evening close — then optional PWA nudge. */
export function DayClosedMoment({
  open,
  parkedCount,
  onDone,
}: {
  open: boolean
  parkedCount: number
  onDone: () => void
}) {
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => onDoneRef.current(), 3200)
    return () => window.clearTimeout(t)
  }, [open])

  return (
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
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,hsl(var(--primary)/0.18),transparent_55%)]" />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={springSoft}
            className="relative max-w-sm text-center"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Moon className="h-7 w-7" />
            </div>
            <h2 id="day-closed-title" className="font-display text-3xl tracking-tight sm:text-4xl">
              Day closed
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              {parkedCount > 0
                ? `Parked ${parkedCount} for tomorrow. Rest well.`
                : 'Nothing left to park. Rest well.'}
            </p>
            <Button type="button" className="mt-8 min-h-12 w-full sm:w-auto" onClick={onDone}>
              Good night
            </Button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
