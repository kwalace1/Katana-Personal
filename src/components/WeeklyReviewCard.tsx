import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarRange, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { springSoft } from '@/lib/motion-ui'
import { weekLabel, markWeekReviewed } from '@/lib/week-review'
import type { LifeSnapshot } from '@/modules/assistant/engine'

export function WeeklyReviewCard({
  snap,
  onDone,
}: {
  snap: LifeSnapshot
  onDone?: () => void
}) {
  const openHabitsLeft = snap.habitsDue.length - snap.habitsDoneIds.length

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
      <p className="relative mt-1 text-sm text-muted-foreground">{weekLabel()}</p>

      <ul className="relative mt-4 space-y-2 text-sm">
        <li className="rounded-2xl bg-secondary/55 px-3.5 py-2.5">
          <span className="font-medium">{snap.openTasks.length}</span>
          <span className="text-muted-foreground"> open task{snap.openTasks.length === 1 ? '' : 's'}</span>
          {snap.priorityTasks[0] ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              Next: {snap.priorityTasks[0].title}
            </span>
          ) : null}
        </li>
        <li className="rounded-2xl bg-secondary/55 px-3.5 py-2.5">
          <span className="font-medium">{snap.habitsDoneIds.length}</span>
          <span className="text-muted-foreground">
            {' '}
            of {snap.habitsDue.length} habits done today
            {openHabitsLeft > 0 ? ` · ${openHabitsLeft} still open` : ''}
          </span>
        </li>
        <li className="rounded-2xl bg-secondary/55 px-3.5 py-2.5">
          <span className="font-medium">{snap.recentWorkouts}</span>
          <span className="text-muted-foreground"> workout{snap.recentWorkouts === 1 ? '' : 's'} this week</span>
          {snap.behindGoals.length > 0 ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              Goals needing love: {snap.behindGoals.map((g) => g.title).join(', ')}
            </span>
          ) : snap.activeGoals.length > 0 ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">Goals look steady.</span>
          ) : null}
        </li>
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
