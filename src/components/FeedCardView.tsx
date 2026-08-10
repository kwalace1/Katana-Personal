import { BookOpen, CalendarDays, CheckSquare, Dumbbell, Flame, Moon, Target } from 'lucide-react'
import type { FeedCard } from '@/lib/social/feed'
import { cn } from '@/lib/utils'

const KIND_META = {
  goal: {
    Icon: Target,
    label: 'Goal',
    wash: 'from-[hsl(172_42%_26%)] via-[hsl(168_38%_32%)] to-[hsl(200_36%_24%)]',
    glow: 'bg-[radial-gradient(ellipse_at_20%_0%,hsl(168_50%_70%/0.35),transparent_55%)]',
  },
  habit: {
    Icon: Flame,
    label: 'Habit',
    wash: 'from-[hsl(168_45%_28%)] via-[hsl(172_40%_30%)] to-[hsl(190_35%_22%)]',
    glow: 'bg-[radial-gradient(ellipse_at_80%_10%,hsl(45_80%_70%/0.28),transparent_50%)]',
  },
  workout: {
    Icon: Dumbbell,
    label: 'Lift',
    wash: 'from-[hsl(200_32%_22%)] via-[hsl(172_38%_28%)] to-[hsl(168_42%_24%)]',
    glow: 'bg-[radial-gradient(ellipse_at_50%_0%,hsl(172_45%_65%/0.3),transparent_55%)]',
  },
  day: {
    Icon: Moon,
    label: 'Day',
    wash: 'from-[hsl(225_32%_12%)] via-[hsl(210_36%_18%)] to-[hsl(172_40%_16%)]',
    glow: 'bg-[radial-gradient(ellipse_at_40%_0%,hsl(200_55%_65%/0.32),transparent_55%)]',
  },
  task: {
    Icon: CheckSquare,
    label: 'Task',
    wash: 'from-[hsl(210_38%_24%)] via-[hsl(195_36%_28%)] to-[hsl(172_34%_22%)]',
    glow: 'bg-[radial-gradient(ellipse_at_25%_0%,hsl(190_55%_70%/0.3),transparent_55%)]',
  },
  event: {
    Icon: CalendarDays,
    label: 'Event',
    wash: 'from-[hsl(200_36%_22%)] via-[hsl(185_34%_28%)] to-[hsl(168_38%_24%)]',
    glow: 'bg-[radial-gradient(ellipse_at_70%_0%,hsl(175_50%_65%/0.28),transparent_50%)]',
  },
  journal: {
    Icon: BookOpen,
    label: 'Journal',
    wash: 'from-[hsl(220_30%_18%)] via-[hsl(200_32%_22%)] to-[hsl(172_36%_20%)]',
    glow: 'bg-[radial-gradient(ellipse_at_40%_0%,hsl(210_50%_70%/0.28),transparent_55%)]',
  },
} as const

/**
 * Celebratory achievement card for Feed posts and the share-win preview.
 * `hero` = large poster in the share sheet; `feed` = in-timeline size.
 * Day cards get a taller night poster — the signature Social clip.
 */
export function FeedCardView({
  card,
  variant = 'feed',
  className,
}: {
  card: FeedCard
  variant?: 'feed' | 'hero'
  className?: string
}) {
  const meta = KIND_META[card.kind]
  const Icon = meta.Icon
  const badge = card.badge || meta.label
  const hero = variant === 'hero'
  const isDay = card.kind === 'day'
  const showQuote = Boolean(card.quote?.trim()) && (isDay || card.kind === 'journal')

  return (
    <div
      className={cn(
        'relative overflow-hidden text-white shadow-[0_12px_40px_hsl(200_25%_10%/0.18)]',
        hero
          ? isDay
            ? 'rounded-[1.75rem] px-6 py-8 sm:px-8 sm:py-10'
            : 'rounded-[1.75rem] p-6 sm:p-7'
          : isDay
            ? 'mx-4 mt-3 min-h-[11.5rem] rounded-2xl p-5 sm:mx-5 sm:p-6'
            : 'mx-4 mt-3 rounded-2xl p-4 sm:mx-5 sm:p-5',
        `bg-gradient-to-br ${meta.wash}`,
        className,
      )}
    >
      <div className={cn('pointer-events-none absolute inset-0', meta.glow)} aria-hidden />
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-black/10 blur-2xl"
        aria-hidden
      />
      {isDay ? (
        <Moon
          className={cn(
            'pointer-events-none absolute text-white/[0.07]',
            hero ? '-right-2 top-6 h-28 w-28' : '-right-1 top-4 h-20 w-20',
          )}
          aria-hidden
        />
      ) : null}

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full bg-white/15 font-semibold uppercase tracking-[0.14em] text-white/95 backdrop-blur-sm',
              hero ? 'px-3 py-1.5 text-[0.7rem]' : 'px-2.5 py-1 text-[0.62rem]',
            )}
          >
            <Icon className={hero ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
            {badge}
          </span>
          <span className={cn('font-display tracking-tight text-white/55', hero ? 'text-sm' : 'text-xs')}>
            Katana
          </span>
        </div>

        <p
          className={cn(
            'mt-4 font-display leading-[1.1] tracking-tight text-white',
            hero ? (isDay ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl') : isDay ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl',
          )}
        >
          {card.title}
        </p>

        {card.subtitle ? (
          <p className={cn('mt-2 text-white/80', hero ? 'text-base' : 'text-sm')}>{card.subtitle}</p>
        ) : null}

        {card.stats ? (
          <p
            className={cn(
              'mt-3 font-semibold tabular-nums text-white/95',
              hero ? 'text-lg' : 'text-sm',
            )}
          >
            {card.stats}
          </p>
        ) : null}

        {showQuote ? (
          <p
            className={cn(
              'mt-4 border-t border-white/15 pt-3 italic text-white/85',
              hero ? 'text-base' : 'text-sm',
            )}
          >
            “{card.quote!.trim()}
            {card.quote!.trim().length >= 140 ? '…' : ''}”
          </p>
        ) : null}
      </div>
    </div>
  )
}
