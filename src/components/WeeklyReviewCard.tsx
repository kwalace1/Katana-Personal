import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { markWeekReviewed, reviewedThisWeek } from '@/lib/week-review'
import type { LifeSnapshot } from '@/modules/assistant/engine'

export function WeeklyReviewCard({
  snap,
  onDone,
}: {
  snap: LifeSnapshot
  onDone?: () => void
}) {
  const w = snap.week
  const sessions = w.workouts + w.lifts
  const [open, setOpen] = useState(false)
  const [reviewed, setReviewed] = useState(() => reviewedThisWeek())

  function finish() {
    markWeekReviewed()
    setReviewed(true)
    setOpen(false)
    onDone?.()
  }

  return (
    <section className="mb-6">
      <button
        type="button"
        className="mb-2 flex w-full items-center justify-between gap-2 px-0.5 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold tracking-tight">Weekly review</span>
        <ChevronRight
          className={cn('h-4 w-4 text-muted-foreground transition', open && 'rotate-90')}
        />
      </button>

      <div className="kp-surface">
        <button
          type="button"
          className="grid w-full grid-cols-3 divide-x py-4 text-center"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Stat value={w.tasksCompleted} label="Tasks finished" />
          <Stat value={w.habitCheckInDays} label="Habit days" />
          <Stat value={sessions} label="Sessions" />
        </button>

        {open ? (
          <div className="border-t px-4 py-4">
            <p className="text-sm text-muted-foreground">{w.label}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <span className="font-medium">{w.tasksCompleted}</span>
                <span className="text-muted-foreground">
                  {' '}
                  task{w.tasksCompleted === 1 ? '' : 's'} finished
                </span>
                {w.openTasks > 0 ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {w.openTasks} still open
                  </span>
                ) : null}
              </li>
              <li>
                <span className="font-medium">{w.habitCheckInDays}</span>
                <span className="text-muted-foreground">
                  {' '}
                  day{w.habitCheckInDays === 1 ? '' : 's'} with a habit check-in
                </span>
                {w.journalDays > 0 ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Journal on {w.journalDays} day{w.journalDays === 1 ? '' : 's'}
                  </span>
                ) : null}
              </li>
              <li>
                <span className="font-medium">{sessions}</span>
                <span className="text-muted-foreground">
                  {' '}
                  movement session{sessions === 1 ? '' : 's'} ({w.workouts} workout
                  {w.workouts === 1 ? '' : 's'}, {w.lifts} lift{w.lifts === 1 ? '' : 's'})
                </span>
                {snap.behindGoals.length > 0 ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Goals needing love: {snap.behindGoals.map((g) => g.title).join(', ')}
                  </span>
                ) : snap.activeGoals.length > 0 ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">Goals look steady.</span>
                ) : null}
              </li>
              {w.lookAhead ? <li className="text-sm text-foreground/90">{w.lookAhead}</li> : null}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" className="gap-1.5">
                <Link to="/ask?q=Review%20my%20week">
                  Ask for a review
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/goals">Goals</Link>
              </Button>
              {reviewed ? (
                <span className="inline-flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5" />
                  Reviewed
                </span>
              ) : (
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={finish}>
                  <Check className="h-3.5 w-3.5" />
                  Done for this week
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-2">
      <p className="font-display text-2xl tracking-tight text-primary">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
