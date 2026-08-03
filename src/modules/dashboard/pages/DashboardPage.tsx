import { FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CheckSquare,
  CalendarDays,
  Flame,
  NotebookPen,
  Target,
  Plus,
  BookOpen,
  X,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { format, formatTime, formatShortDate, todayKey } from '@/lib/dates'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { tasksApi } from '@/modules/tasks/api'
import { calendarApi } from '@/modules/calendar/api'
import { habitsApi } from '@/modules/habits/api'
import { notesApi } from '@/modules/notes/api'
import { goalsApi } from '@/modules/goals/api'
import { journalApi } from '@/modules/journal/api'
import { buildDailyBriefing, buildSnapshot } from '@/modules/assistant/engine'
import { toast } from 'sonner'

const QUICK = [
  { to: '/tasks', label: 'Task', icon: CheckSquare },
  { to: '/calendar', label: 'Event', icon: CalendarDays },
  { to: '/notes', label: 'Note', icon: NotebookPen },
  { to: '/habits', label: 'Habit', icon: Flame },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/goals', label: 'Goal', icon: Target },
] as const

function captureItem(userId: string, raw: string): { kind: string; to: string } {
  const text = raw.trim()
  if (text.startsWith('#')) {
    const note = notesApi.createNote(userId, { title: text.slice(1).trim() || 'Untitled' })
    return { kind: 'note', to: `/notes?id=${note.id}` }
  }
  if (text.startsWith('@')) {
    const title = text.slice(1).trim() || 'New event'
    const start = new Date()
    start.setMinutes(0, 0, 0)
    start.setHours(start.getHours() + 1)
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    const event = calendarApi.create(userId, {
      title,
      notes: '',
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: false,
      location: '',
      recurrence: 'none',
      reminder_minutes: 30,
    })
    return { kind: 'event', to: `/calendar?date=${todayKey()}&id=${event.id}` }
  }
  const lists = tasksApi.listLists(userId)
  const task = tasksApi.createTask(userId, {
    title: text,
    list_id: lists[0]?.id ?? null,
    due_at: new Date().toISOString(),
  })
  return { kind: 'task', to: `/tasks?id=${task.id}` }
}

export default function DashboardPage() {
  const { user, profile, onboardingDone, markOnboardingDone } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const [capture, setCapture] = useState('')

  const data = useMemo(() => {
    void tick
    const snap = buildSnapshot(userId, profile?.display_name || 'there')
    return {
      briefing: buildDailyBriefing(snap),
      priority: tasksApi.priorityTasks(userId),
      events: calendarApi.upcoming(userId),
      habits: habitsApi.dueToday(userId),
      notes: notesApi.recent(userId),
      goals: goalsApi.active(userId),
      hasTask: tasksApi.listTasks(userId).length > 0,
      hasHabit: habitsApi.list(userId).length > 0,
      hasJournal: Boolean(journalApi.forDate(userId)),
    }
  }, [userId, tick, profile?.display_name])

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  })()

  function onCapture(e: FormEvent) {
    e.preventDefault()
    if (!capture.trim()) return
    const result = captureItem(userId, capture)
    setCapture('')
    toast.success(
      result.kind === 'note' ? 'Note saved' : result.kind === 'event' ? 'Event added' : 'Task added',
    )
    refresh()
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        eyebrow={format(new Date(), 'EEEE · MMMM d')}
        title={`${greeting}, ${profile?.display_name || 'there'}`}
        description="Your day, gathered in one place."
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/ask">
              <Sparkles className="h-4 w-4" />
              Ask
            </Link>
          </Button>
        }
      />

      {!onboardingDone && (
        <div className="relative mb-6 kp-surface p-6">
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-3 top-3"
            onClick={markOnboardingDone}
            aria-label="Dismiss tips"
          >
            <X className="h-4 w-4" />
          </Button>
          <p className="kp-section-label">Getting started</p>
          <p className="mt-2 font-display text-xl tracking-tight">Three small steps</p>
          <p className="mt-1 text-sm text-muted-foreground">Make Today useful in under a minute.</p>
          <ul className="mt-5 space-y-2">
            {[
              { done: data.hasTask, label: 'Add a task', to: '/tasks' },
              { done: data.hasHabit, label: 'Start a habit', to: '/habits' },
              { done: data.hasJournal, label: 'Write today’s journal', to: '/journal' },
            ].map((step, i) => (
              <li
                key={step.to}
                className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 px-4 py-3"
              >
                <span className="text-sm font-medium">
                  <span className="mr-2 text-muted-foreground">{step.done ? '✓' : `${i + 1}.`}</span>
                  {step.label}
                </span>
                <Button asChild size="sm" variant={step.done ? 'secondary' : 'default'}>
                  <Link to={step.to}>{step.done ? 'Open' : 'Go'}</Link>
                </Button>
              </li>
            ))}
          </ul>
          {data.hasTask && data.hasHabit && data.hasJournal && (
            <Button className="mt-5" onClick={markOnboardingDone}>
              Looks good — hide tips
            </Button>
          )}
        </div>
      )}

      <form onSubmit={onCapture} className="mb-6 kp-surface p-3 sm:p-4">
        <div className="flex gap-2">
          <Input
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            placeholder="Capture a task…  # note  ·  @ event"
            aria-label="Quick capture"
            className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="icon" aria-label="Capture">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 px-1 text-[0.7rem] text-muted-foreground">
          Enter for a task · start with # for a note · @ for an event
        </p>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {QUICK.map(({ to, label, icon: Icon }) => (
          <Button key={to} asChild variant="outline" size="sm" className="gap-1.5">
            <Link to={to}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          </Button>
        ))}
      </div>

      <section className="relative mb-6 overflow-hidden kp-surface p-6 sm:p-7" aria-live="polite">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="kp-section-label">For you</p>
            <Link to="/ask" className="text-xs font-medium text-primary hover:underline">
              Ask more
            </Link>
          </div>
          <p className="max-w-3xl text-[0.98rem] leading-relaxed text-foreground/90 sm:text-base">
            {data.briefing}
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="kp-surface p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
              <CheckSquare className="h-4 w-4 text-primary" />
              Focus
            </h2>
            <Link to="/tasks" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              All tasks
            </Link>
          </div>
          {data.priority.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing urgent. Protect the calm.</p>
          ) : (
            <ul className="space-y-2">
              {data.priority.map((task) => (
                <li
                  key={task.id}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-secondary/55 px-3.5 py-3"
                >
                  <Link to={`/tasks?id=${task.id}`} className="min-w-0 flex-1 hover:underline">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {task.priority === 'high' ? 'Important' : task.priority === 'low' ? 'Whenever' : 'Normal'}
                      {task.due_at ? ` · ${formatShortDate(task.due_at)}` : ''}
                    </p>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      tasksApi.completeTask(userId, task.id)
                      refresh()
                    }}
                  >
                    Done
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="kp-surface p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
              <CalendarDays className="h-4 w-4 text-primary" />
              Coming up
            </h2>
            <Link to="/calendar" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Calendar
            </Link>
          </div>
          {data.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing on the calendar yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.events.map((event) => (
                <li key={event.id}>
                  <Link
                    to={`/calendar?date=${event.starts_at.slice(0, 10)}&id=${event.id}`}
                    className="block rounded-2xl bg-secondary/55 px-3.5 py-3 transition hover:bg-secondary/80"
                  >
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatShortDate(event.starts_at)}
                      {!event.all_day ? ` · ${formatTime(event.starts_at)}` : ' · All day'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="kp-surface p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
              <Flame className="h-4 w-4 text-primary" />
              Habits
            </h2>
            <Link to="/habits" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Manage
            </Link>
          </div>
          {data.habits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add one small habit to begin.</p>
          ) : (
            <ul className="space-y-2">
              {data.habits.map((habit) => {
                const done = habitsApi.isDoneToday(userId, habit.id)
                return (
                  <li
                    key={habit.id}
                    className="flex items-center justify-between rounded-2xl bg-secondary/55 px-3.5 py-3"
                  >
                    <Link to={`/habits?id=${habit.id}`} className="min-w-0 hover:underline">
                      <p className="text-sm font-medium">{habit.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {habitsApi.streak(userId, habit.id)} day streak
                      </p>
                    </Link>
                    <Button
                      size="sm"
                      variant={done ? 'secondary' : 'default'}
                      onClick={() => {
                        habitsApi.toggleToday(userId, habit.id)
                        refresh()
                      }}
                    >
                      {done ? 'Done' : 'Check in'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="kp-surface p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
              <Target className="h-4 w-4 text-primary" />
              Goals
            </h2>
            <Link to="/goals" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              View
            </Link>
          </div>
          {data.goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Set a direction when you’re ready.</p>
          ) : (
            <ul className="space-y-4">
              {data.goals.map((goal) => {
                const pct = Math.min(100, Math.round((goal.progress / Math.max(goal.target, 1)) * 100))
                return (
                  <li key={goal.id}>
                    <Link to={`/goals?id=${goal.id}`} className="block hover:opacity-90">
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span className="font-medium">{goal.title}</span>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="kp-surface p-5 sm:p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
              <NotebookPen className="h-4 w-4 text-primary" />
              Recent notes
            </h2>
            <Link to="/notes" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Open notes
            </Link>
          </div>
          {data.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Capture a thought when it shows up.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.notes.map((note) => (
                <Link
                  key={note.id}
                  to={`/notes?id=${note.id}`}
                  className="rounded-2xl border border-border/40 bg-secondary/40 p-4 transition hover:border-primary/25 hover:bg-secondary/70"
                >
                  <p className="truncate text-sm font-medium">{note.title}</p>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {note.body || 'Empty note'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  )
}
