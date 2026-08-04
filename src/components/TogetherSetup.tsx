import { Link } from 'react-router-dom'
import { Users, Share2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    n: 1,
    title: 'Friends',
    body: 'People you trust — invite with a link or code.',
    to: '/friends',
    icon: Users,
  },
  {
    n: 2,
    title: 'Shared',
    body: 'Plans from Tasks, Calendar, Habits — shared with friends.',
    to: '/shared',
    icon: Share2,
  },
  {
    n: 3,
    title: 'Circles',
    body: 'Streak boards and optional 7-day challenges — cheer habits and health together.',
    to: '/circles',
    icon: Trophy,
  },
] as const

/** One mental model for Friends / Shared / Circles empty & intro surfaces. */
export function TogetherSetup({
  highlight,
  className,
  compact,
  cloudConnected = false,
}: {
  /** Which chapter this page is — dims the others slightly */
  highlight?: 'friends' | 'shared' | 'circles'
  className?: string
  compact?: boolean
  /** When true, don’t push “Connect cloud” — they’re already signed in */
  cloudConnected?: boolean
}) {
  return (
    <div className={cn('kp-surface p-5 sm:p-6', className)}>
      <p className="kp-section-label">How Together works</p>
      <p className="mt-2 font-display text-xl tracking-tight">Three clear jobs — no overlap</p>
      {!compact ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Private life stays on your device. Together is opt-in accountability.
        </p>
      ) : null}
      <ol className="mt-5 space-y-2">
        {STEPS.map((step) => {
          const key = step.title.toLowerCase() as 'friends' | 'shared' | 'circles'
          const active = !highlight || highlight === key
          const Icon = step.icon
          return (
            <li key={step.n}>
              <Link
                to={step.to}
                className={cn(
                  'flex items-start gap-3 rounded-2xl px-3.5 py-3 transition',
                  active ? 'bg-primary/10' : 'bg-secondary/40 opacity-70 hover:opacity-100',
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-background text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">{step.n}</span>
                    <span className="text-sm font-semibold">{step.title}</span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {step.body}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
      {highlight === 'circles' ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Tip: turn on streak sharing in{' '}
          <Link to="/settings" className="text-primary underline">
            Settings
          </Link>{' '}
          so friends can see your board.
        </p>
      ) : null}
      {highlight === 'friends' && !cloudConnected ? (
        <Button asChild size="sm" className="mt-4 min-h-11">
          <Link to="/">Sign in to Cloud to invite</Link>
        </Button>
      ) : null}
      {highlight === 'friends' && cloudConnected ? (
        <p className="mt-4 text-xs text-muted-foreground">
          You’re connected — share your code or invite link below to add people.
        </p>
      ) : null}
    </div>
  )
}
