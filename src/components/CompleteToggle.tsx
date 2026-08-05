import { Frown, Smile } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Complete / check-in control — frown = open, smile = done. */
export function CompleteToggle({
  done,
  onToggle,
  openLabel = 'To do',
  doneLabel = 'Done',
  className,
}: {
  done: boolean
  onToggle: () => void
  /** Label when not yet completed */
  openLabel?: string
  /** Label when completed */
  doneLabel?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-label={done ? `Undo — mark as ${openLabel.toLowerCase()}` : openLabel}
      aria-pressed={done}
      className={cn(
        'group flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-0.5 py-0.5 transition active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full border-2 transition',
          done
            ? 'border-emerald-600 bg-emerald-500 text-white shadow-sm'
            : 'border-amber-500/80 bg-amber-500/15 text-amber-700 shadow-[inset_0_0_0_1px_rgb(245_158_11/0.25)] group-hover:bg-amber-500/25 dark:text-amber-400',
        )}
      >
        {done ? (
          <Smile className="h-5 w-5" strokeWidth={2.25} />
        ) : (
          <Frown className="h-5 w-5" strokeWidth={2.25} />
        )}
      </span>
      <span
        className={cn(
          'max-w-[3.5rem] text-center text-[0.65rem] font-semibold leading-tight tracking-wide',
          done ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground/70 group-hover:text-amber-700',
        )}
      >
        {done ? doneLabel : openLabel}
      </span>
    </button>
  )
}
