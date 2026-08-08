import { Dumbbell, Flame, Target } from 'lucide-react'
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
} as const

/**
 * Celebratory achievement card for Feed posts and the share-win preview.
 * `hero` = large poster in the share sheet; `feed` = in-timeline size.
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

  return (
    <div
      className={cn(
        'relative overflow-hidden text-white shadow-[0_12px_40px_hsl(200_25%_10%/0.18)]',
        hero ? 'rounded-[1.75rem] p-6 sm:p-7' : 'mx-4 mt-3 rounded-2xl p-4 sm:mx-5 sm:p-5',
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
            hero ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl',
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
      </div>
    </div>
  )
}
