import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** Wordmark-first brand — no letter tile. */
export function BrandMark({
  className,
  to,
  compact = false,
}: {
  className?: string
  to?: string
  compact?: boolean
}) {
  const inner = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className="relative flex h-8 w-8 shrink-0 items-center justify-center"
      >
        <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none">
          <defs>
            <linearGradient id="kpBlade" x1="6" y1="28" x2="26" y2="4" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(174 42% 28%)" />
              <stop offset="1" stopColor="hsl(190 35% 42%)" />
            </linearGradient>
          </defs>
          <path
            d="M8.5 26.5c1.2-6.5 5.2-12.8 11.8-18.2.4-.3.9 0 .8.5-1.2 5.8-4.6 11.6-10.4 16.8-.4.4-1 .4-1.3.1-.4-.3-.5-.8-.9-.9z"
            fill="url(#kpBlade)"
            opacity="0.95"
          />
          <path
            d="M9.2 25.2c4.8-4.4 8.2-9.4 9.8-14.6"
            stroke="hsl(0 0% 100% / 0.35)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="22.5" cy="7.5" r="1.6" fill="hsl(174 30% 55%)" opacity="0.7" />
        </svg>
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[1.35rem] tracking-tight text-foreground">Katana</span>
          <span className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Personal
          </span>
        </span>
      ) : (
        <span className="font-display text-lg tracking-tight">Katana</span>
      )}
    </span>
  )

  if (to) {
    return (
      <Link to={to} className="outline-none transition-opacity hover:opacity-80 focus-visible:opacity-80">
        {inner}
      </Link>
    )
  }
  return inner
}
