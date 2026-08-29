import { Link } from 'react-router-dom'
import { Users, Share2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    n: 1,
    title: 'Friends',
    key: 'friends' as const,
    body: 'People you trust — invite with a link or code.',
    to: '/social?tab=friends',
    icon: Users,
  },
  {
    n: 2,
    title: 'Plans',
    key: 'shared' as const,
    body: 'Inbox of tasks/goals friends send you — copy into your day.',
    to: '/shared',
    icon: Share2,
  },
  {
    n: 3,
    title: 'Circles',
    key: 'circles' as const,
    body: 'Group streak boards — not a plans inbox.',
    to: '/circles',
    icon: Trophy,
  },
] as const

/** Compact mental model for Friends / Plans / Circles. */
export function TogetherSetup({
  highlight,
  className,
  compact,
  cloudConnected = false,
}: {
  highlight?: 'friends' | 'shared' | 'circles'
  className?: string
  compact?: boolean
  cloudConnected?: boolean
}) {
  return (
    <div className={cn('kp-surface p-4 sm:p-5', className)}>
      <p className="kp-section-label">How Together works</p>
      <p className="mt-1 font-display text-lg tracking-tight sm:text-xl">
        Friends · Plans · Circles
      </p>
      {!compact ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Private life stays on this device. Together is opt-in.
        </p>
      ) : null}
      <ol className={cn('mt-4 space-y-1.5', compact && 'mt-3')}>
        {STEPS.map((step) => {
          const active = !highlight || highlight === step.key
          const Icon = step.icon
          return (
            <li key={step.n}>
              <Link
                to={step.to}
                className={cn(
                  'flex items-start gap-3 rounded-xl px-3 py-2.5 transition',
                  active ? 'bg-primary/10' : 'bg-secondary/40 opacity-70 hover:opacity-100',
                )}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-semibold">{step.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {step.body}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
      {highlight === 'friends' && !cloudConnected ? (
        <Button asChild size="sm" className="mt-3 min-h-11">
          <Link to="/settings/together">Connect cloud to invite</Link>
        </Button>
      ) : null}
    </div>
  )
}
