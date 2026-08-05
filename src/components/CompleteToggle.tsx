import { useRef, useState, type MouseEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Frown, Smile } from 'lucide-react'
import { toast } from 'sonner'
import { burstConfetti } from '@/lib/celebrate'
import { cn } from '@/lib/utils'

/** Complete / check-in control — frown = open, smile = done, with confetti on complete. */
export function CompleteToggle({
  done,
  onToggle,
  openLabel = 'To do',
  doneLabel = 'Done',
  celebrateMessage,
  className,
}: {
  done: boolean
  onToggle: () => void
  /** Label when not yet completed */
  openLabel?: string
  /** Label when completed */
  doneLabel?: string
  /** Toast copy when completing (defaults from doneLabel) */
  celebrateMessage?: string
  className?: string
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [celebrating, setCelebrating] = useState(false)
  const showDone = done || celebrating

  function handleClick(e: MouseEvent) {
    e.stopPropagation()
    if (celebrating) return

    // Undo — instant
    if (done) {
      onToggle()
      return
    }

    // Complete — smile + confetti, then commit so the row can move to Done
    setCelebrating(true)
    burstConfetti(btnRef.current)
    toast.success(celebrateMessage || `${doneLabel}!`, {
      description: 'Nice work.',
      duration: 2200,
    })
    window.setTimeout(() => {
      onToggle()
      setCelebrating(false)
    }, 520)
  }

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={handleClick}
      aria-label={showDone ? `Undo — mark as ${openLabel.toLowerCase()}` : openLabel}
      aria-pressed={showDone}
      disabled={celebrating}
      className={cn(
        'group flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-0.5 py-0.5 transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        celebrating && 'pointer-events-none',
        className,
      )}
    >
      <motion.span
        layout
        animate={
          celebrating
            ? { scale: [1, 1.28, 1.08], rotate: [0, -8, 6, 0] }
            : { scale: 1, rotate: 0 }
        }
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors',
          showDone
            ? 'border-emerald-600 bg-emerald-500 text-white shadow-sm'
            : 'border-amber-500/80 bg-amber-500/15 text-amber-700 shadow-[inset_0_0_0_1px_rgb(245_158_11/0.25)] group-hover:bg-amber-500/25 dark:text-amber-400',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {showDone ? (
            <motion.span
              key="smile"
              initial={{ scale: 0.4, opacity: 0, y: 4 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            >
              <Smile className="h-5 w-5" strokeWidth={2.25} />
            </motion.span>
          ) : (
            <motion.span
              key="frown"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Frown className="h-5 w-5" strokeWidth={2.25} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
      <span
        className={cn(
          'max-w-[3.5rem] text-center text-[0.65rem] font-semibold leading-tight tracking-wide',
          showDone ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground/70 group-hover:text-amber-700',
        )}
      >
        {showDone ? doneLabel : openLabel}
      </span>
    </button>
  )
}
