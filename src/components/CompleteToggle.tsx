import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Obvious complete / check-in control — larger target, labeled, doesn’t blend into the row. */
export function CompleteToggle({
  done,
  onToggle,
  openLabel = 'Done',
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
      aria-label={done ? `Undo ${doneLabel.toLowerCase()}` : openLabel}
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
            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
            : 'border-primary bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)] group-hover:bg-primary/20',
        )}
      >
        <Check className={cn('h-5 w-5', !done && 'opacity-60')} strokeWidth={2.5} />
      </span>
      <span
        className={cn(
          'max-w-[3.5rem] text-center text-[0.65rem] font-semibold leading-tight tracking-wide',
          done ? 'text-primary' : 'text-foreground/70 group-hover:text-primary',
        )}
      >
        {done ? doneLabel : openLabel}
      </span>
    </button>
  )
}
