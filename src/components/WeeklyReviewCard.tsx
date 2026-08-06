import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarRange, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { springSoft } from '@/lib/motion-ui'
import { markWeekReviewed } from '@/lib/week-review'
import type { LifeSnapshot } from '@/modules/assistant/engine'

export function WeeklyReviewCard({
  snap,
  onDone,
}: {
  snap: LifeSnapshot
  onDone?: () => void
}) {
  const w = snap.week

  function finish() {
    markWeekReviewed()
    onDone?.()
  }

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="relative mb-4 overflow-hidden kp-surface border border-primary/15 p-5 sm:p-6"
    >
      <div className="pointer-events-none absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative mb-2 flex items-center gap-2">
        <CalendarRange className="h-4 w-4 text-primary" />
        <p className="kp-section-label">Weekly review</p>
      </div>
      <h2 className="relative font-display text-xl tracking-tight sm:text-2xl">
        Look back, then look ahead
      </h2>
      <p className="relative mt-1 text-sm text-muted-foreground">{w.label}</p>

      <ul className="relative mt-4 space-y-2 text-sm">
        <li className="rounded-2xl bg-secondary/55 px-3.5 py-2.5">
          <span className="font-medium">{w.tasksCompleted}</span>
          <span className="text-muted-foreground">
            {' '}
            task{w.tasksCompleted === 1 ? '' : 's'} finished this week
          </span>
          {w.openTasks > 0 ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {w.openTasks} still open
            </span>
          ) : null}
        </li>
        <li className="rounded-2xl bg-secondary/55 px-3.5 py-2.5">
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
        <li className="rounded-2xl bg-secondary/55 px-3.5 py-2.5">
          <span className="font-medium">{w.workouts + w.lifts}</span>
          <span className="text-muted-foreground">
            {' '}
            movement session{(w.workouts + w.lifts) === 1 ? '' : 's'} ({w.workouts} workout
            {w.workouts === 1 ? '' : 's'}, {w.lifts} lift{w.lifts === 1 ? '' : 's'})
          </span>
          {snap.behindGoals.length > 0 ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              Goals needing love: {snap.behindGoals.map((g) => g.title).join(', ')}
            </span>
          ) : snap.activeGoals.length > 0 ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">Goals look steady.</span>
          ) : null}
        </li>
        {w.lookAhead ? (
          <li className="rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-sm">
            {w.lookAhead}
          </li>
        ) : null}
      </ul>

      <div className="relative mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" className="gap-1.5">
          <Link to="/ask?q=Review%20my%20week">
            Ask for a review
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/goals">Goals</Link>
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={finish}>
          <Check className="h-3.5 w-3.5" />
          Done for this week
        </Button>
      </div>
    </motion.section>
  )
}
