import { FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  ArrowRight,
  AlertCircle,
  Moon,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { format, formatTime, formatShortDate, todayKey, addDays } from '@/lib/dates'
import { pageEnterSubtle, springSoft } from '@/lib/motion-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { parseCapture, commitCapture } from '@/lib/capture'
import { tasksApi } from '@/modules/tasks/api'
import { calendarApi } from '@/modules/calendar/api'
import { habitsApi } from '@/modules/habits/api'
import { notesApi } from '@/modules/notes/api'
import { goalsApi } from '@/modules/goals/api'
import { journalApi } from '@/modules/journal/api'
import {
  buildDailyBriefing,
  buildBriefingActions,
  buildSnapshot,
  runAskAction,
} from '@/modules/assistant/engine'
import { TogetherTodayCard } from '@/components/TogetherTodayCard'
import { WeeklyReviewCard } from '@/components/WeeklyReviewCard'
import { offerPwaNudge } from '@/components/PwaInstallNudge'
import { shouldOfferWeekReview } from '@/lib/week-review'
import {
  TODAY_SECTIONS,
  isSectionVisible,
  toggleSection,
} from '@/modules/dashboard/today-layout'
import { toast } from 'sonner'
import type { Task } from '@/modules/tasks/types'
import type { CalendarEvent } from '@/modules/calendar/types'
import type { Habit } from '@/modules/habits/types'
import { cn } from '@/lib/utils'

const QUICK = [
  { to: '/tasks', label: 'Task', icon: CheckSquare },
  { to: '/calendar', label: 'Event', icon: CalendarDays },
  { to: '/notes', label: 'Note', icon: NotebookPen },
  { to: '/habits', label: 'Habit', icon: Flame },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/goals', label: 'Goal', icon: Target },
] as const

const CLOSE_KEY = 'katana-personal:day-close'

type NextAction =
  | { type: 'task'; item: Task }
  | { type: 'event'; item: CalendarEvent }
  | { type: 'habit'; item: Habit }

function pickNextAction(
  overdue: Task[],
  priority: Task[],
  todayEvents: CalendarEvent[],
  openHabits: Habit[],
): NextAction | null {
  if (overdue[0]) return { type: 'task', item: overdue[0] }
  const now = Date.now()
  const soon = todayEvents.find((e) => new Date(e.starts_at).getTime() >= now - 5 * 60_000)
  if (soon && new Date(soon.starts_at).getTime() - now < 90 * 60_000) {
    return { type: 'event', item: soon }
  }
  if (priority[0]) return { type: 'task', item: priority[0] }
  if (openHabits[0]) return { type: 'habit', item: openHabits[0] }
  if (soon) return { type: 'event', item: soon }
  return null
}

function closedToday(): boolean {
  return localStorage.getItem(CLOSE_KEY) === todayKey()
}

function markClosed() {
  localStorage.setItem(CLOSE_KEY, todayKey())
}

export default function DashboardPage() {
  const { user, profile, onboardingDone, markOnboardingDone, updatePreferences } = useAuth()
  const { cloudEnabled, cloudUser } = useCloudAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const [capture, setCapture] = useState('')
  const [alsoOpen, setAlsoOpen] = useState(false)
  const [closeNote, setCloseNote] = useState('')
  const [dayClosed, setDayClosed] = useState(closedToday)
  const [weekCardVisible, setWeekCardVisible] = useState(() => shouldOfferWeekReview())
  const [spentBriefing, setSpentBriefing] = useState<Record<string, true>>({})
  const [editingLayout, setEditingLayout] = useState(false)
  const prefs = profile?.preferences

  const draft = useMemo(() => parseCapture(capture), [capture])

  const data = useMemo(() => {
    void tick
    const snap = buildSnapshot(userId, profile?.display_name || 'there')
    const overdue = tasksApi.overdue(userId)
    const priority = tasksApi.priorityTasks(userId, 8)
    const todayEvents = calendarApi.forDay(userId, new Date())
    const habits = habitsApi.dueToday(userId)
    const openHabits = habits.filter((h) => !habitsApi.isDoneToday(userId, h.id))
    const atRisk = habits.filter((h) => {
      const streak = habitsApi.streak(userId, h.id)
      return streak >= 3 && !habitsApi.isDoneToday(userId, h.id)
    })
    const next = pickNextAction(overdue, priority, todayEvents, openHabits)
    const alsoTasks = priority.filter((t) => !(next?.type === 'task' && next.item.id === t.id)).slice(0, 5)

    return {
      snap,
      briefing: buildDailyBriefing(snap),
      briefingActions: buildBriefingActions(snap),
      overdue,
      priority,
      events: calendarApi.upcoming(userId),
      todayEvents,
      habits,
      openHabits,
      atRisk,
      notes: notesApi.recent(userId),
      goals: goalsApi.active(userId),
      next,
      alsoTasks,
      hasTask: tasksApi.listTasks(userId).length > 0,
      hasHabit: habitsApi.list(userId).length > 0,
      hasJournal: Boolean(journalApi.forDate(userId)),
      hasCapture: Boolean(localStorage.getItem('katana-personal:captured-once')),
      unfinishedToday: tasksApi.todayTasks(userId),
    }
  }, [userId, tick, profile?.display_name])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const showEveningClose = hour >= 17 && !dayClosed

  function onCapture(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    const result = commitCapture(userId, draft)
    localStorage.setItem('katana-personal:captured-once', '1')
    setCapture('')
    toast.success(result.summary, {
      action: {
        label: 'Open',
        onClick: () => {
          window.location.href = result.to
        },
      },
      cancel: {
        label: 'Undo',
        onClick: () => {
          if (result.kind === 'task') tasksApi.deleteTask(userId, result.id)
          else if (result.kind === 'note') notesApi.deleteNote(userId, result.id)
          else calendarApi.remove(userId, result.id)
          refresh()
          toast.message('Undone')
        },
      },
    })
    refresh()
  }

  function parkUnfinished() {
    const tomorrow = addDays(new Date(), 1)
    tomorrow.setHours(17, 0, 0, 0)
    let n = 0
    for (const task of data.unfinishedToday) {
      tasksApi.updateTask(userId, task.id, { due_at: tomorrow.toISOString() })
      n += 1
    }
    if (closeNote.trim()) {
      journalApi.upsert(userId, {
        mood: 'okay',
        body: closeNote.trim(),
        reflection: 'Evening close',
      })
    }
    markClosed()
    setDayClosed(true)
    setCloseNote('')
    toast.success(n ? `Parked ${n} task${n === 1 ? '' : 's'} for tomorrow` : 'Day closed')
    offerPwaNudge()
    refresh()
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        eyebrow={format(new Date(), 'EEEE · MMMM d')}
        title={`${greeting}, ${profile?.display_name || 'there'}`}
        description="One next step. Everything else can wait."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={editingLayout ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setEditingLayout((v) => !v)}
            >
              <LayoutGrid className="h-4 w-4" />
              {editingLayout ? 'Done' : 'Edit layout'}
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/ask">
                <Sparkles className="h-4 w-4" />
                Ask
              </Link>
            </Button>
          </div>
        }
      />

      {editingLayout && (
        <section className="mb-6 kp-surface p-5 sm:p-6">
          <p className="kp-section-label">Today layout</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn sections on or off. Capture and quick add always stay.
          </p>
          <ul className="mt-4 space-y-1">
            {TODAY_SECTIONS.map((section) => {
              const on = isSectionVisible(prefs, section.id)
              return (
                <li
                  key={section.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5"
                >
                  <label htmlFor={`today-section-${section.id}`} className="text-sm font-medium">
                    {section.label}
                  </label>
                  <Switch
                    id={`today-section-${section.id}`}
                    checked={on}
                    onCheckedChange={() => {
                      updatePreferences({ todayLayout: toggleSection(prefs, section.id) })
                    }}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      )}

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
          <p className="mt-2 font-display text-xl tracking-tight">Make Today yours</p>
          <p className="mt-1 text-sm text-muted-foreground">A few small steps — under a minute.</p>
          <ul className="mt-5 space-y-2">
            {(
              [
                { done: data.hasCapture || data.hasTask, label: 'Capture something above', to: null as string | null },
                { done: data.hasHabit, label: 'Start a habit', to: '/habits' },
                { done: data.hasJournal, label: 'Write today’s journal', to: '/journal' },
                ...(cloudEnabled
                  ? [
                      {
                        done: Boolean(cloudUser),
                        label: cloudUser ? 'Cloud connected — try Friends' : 'Connect Cloud (optional)',
                        to: cloudUser ? '/friends' : '/settings',
                      },
                    ]
                  : []),
              ] as { done: boolean; label: string; to: string | null }[]
            ).map((step, i) => (
              <li
                key={`${step.label}-${i}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 px-4 py-3"
              >
                <span className="text-sm font-medium">
                  <span className="mr-2 text-muted-foreground">{step.done ? '✓' : `${i + 1}.`}</span>
                  {step.label}
                </span>
                {step.to ? (
                  <Button asChild size="sm" variant={step.done ? 'secondary' : 'default'}>
                    <Link to={step.to}>{step.done ? 'Open' : 'Go'}</Link>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{step.done ? 'Done' : 'Use the bar'}</span>
                )}
              </li>
            ))}
          </ul>
          {(data.hasCapture || data.hasTask) && data.hasHabit && data.hasJournal && (
            <Button className="mt-5" onClick={markOnboardingDone}>
              Looks good — hide tips
            </Button>
          )}
        </div>
      )}

      {weekCardVisible && (
        <WeeklyReviewCard
          snap={data.snap}
          onDone={() => {
            setWeekCardVisible(false)
            toast.success('Week reviewed — back to today')
          }}
        />
      )}

      <form onSubmit={onCapture} className="mb-4 kp-surface p-3 sm:p-4">
        <div className="flex gap-2">
          <Input
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            placeholder="Call Mom Friday 3pm ·  # idea  ·  @ dentist tomorrow"
            aria-label="Quick capture"
            className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="icon" aria-label="Capture" disabled={!draft}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <AnimatePresence>
          {draft && capture.trim() && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
            >
              Will create: {draft.summary}
            </motion.p>
          )}
        </AnimatePresence>
        {!capture.trim() && (
          <p className="mt-1 px-1 text-[0.7rem] text-muted-foreground">
            tomorrow · fri · 3pm · ! priority · # note · @ event
          </p>
        )}
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

      {data.overdue.length > 0 && (
        <section className="mb-4 flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-destructive">
              {data.overdue.length} overdue
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {data.overdue
                .slice(0, 3)
                .map((t) => t.title)
                .join(' · ')}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/tasks?filter=overdue">Review</Link>
          </Button>
        </section>
      )}

      {data.atRisk.length > 0 && (
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">
          Streak at risk: {data.atRisk.map((h) => h.title).join(', ')} — check in before the day ends.
        </p>
      )}

      {/* Hero: Do this next */}
      {isSectionVisible(prefs, 'do_this_next') && (
      <motion.section
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
        className="relative mb-4 overflow-hidden kp-surface p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
        <p className="kp-section-label relative">Do this next</p>
        {data.next ? (
          <div className="relative mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
                {data.next.type === 'task' && data.next.item.title}
                {data.next.type === 'event' && data.next.item.title}
                {data.next.type === 'habit' && data.next.item.title}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {data.next.type === 'task' && (
                  <>
                    Task
                    {data.next.item.due_at ? ` · ${formatShortDate(data.next.item.due_at)}` : ''}
                    {data.next.item.priority === 'high' ? ' · Important' : ''}
                  </>
                )}
                {data.next.type === 'event' && (
                  <>
                    Event · {formatShortDate(data.next.item.starts_at)}
                    {!data.next.item.all_day ? ` · ${formatTime(data.next.item.starts_at)}` : ' · All day'}
                  </>
                )}
                {data.next.type === 'habit' && (
                  <>Habit · {habitsApi.streak(userId, data.next.item.id)} day streak</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.next.type === 'task' && (
                <>
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={() => {
                      tasksApi.completeTask(userId, data.next!.item.id)
                      toast.success('Done')
                      refresh()
                    }}
                  >
                    Mark done
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to={`/tasks?id=${data.next.item.id}`}>Open</Link>
                  </Button>
                </>
              )}
              {data.next.type === 'event' && (
                <Button asChild size="lg" className="gap-2">
                  <Link
                    to={`/calendar?date=${data.next.item.starts_at.slice(0, 10)}&id=${data.next.item.id}`}
                  >
                    Open event
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              {data.next.type === 'habit' && (
                <Button
                  size="lg"
                  className="gap-2"
                  onClick={() => {
                    habitsApi.toggleToday(userId, data.next!.item.id)
                    toast.success('Checked in')
                    refresh()
                  }}
                >
                  Check in
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative mt-3">
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">Nothing urgent</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Protect the calm — or capture what’s next.</p>
          </div>
        )}
      </motion.section>
      )}

      {isSectionVisible(prefs, 'together') && <TogetherTodayCard />}

      {/* Also today — collapsed */}
      {isSectionVisible(prefs, 'also_today') &&
        (data.alsoTasks.length > 0 || data.openHabits.length > 0 || data.todayEvents.length > 0) && (
        <section className="mb-6 kp-surface">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-3.5 text-left"
            onClick={() => setAlsoOpen((v) => !v)}
            aria-expanded={alsoOpen}
          >
            <span className="text-sm font-semibold tracking-tight">Also today</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {data.alsoTasks.length + data.openHabits.length} items
              {alsoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>
          {alsoOpen && (
            <div className="space-y-2 border-t border-border/40 px-4 pb-4 pt-2">
              {data.alsoTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2.5"
                >
                  <Link to={`/tasks?id=${task.id}`} className="min-w-0 truncate text-sm hover:underline">
                    {task.title}
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
                </div>
              ))}
              {data.openHabits
                .filter((h) => !(data.next?.type === 'habit' && data.next.item.id === h.id))
                .map((habit) => (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2.5"
                  >
                    <span className="truncate text-sm">{habit.title}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        habitsApi.toggleToday(userId, habit.id)
                        refresh()
                      }}
                    >
                      Check in
                    </Button>
                  </div>
                ))}
              {data.todayEvents
                .filter((e) => !(data.next?.type === 'event' && data.next.item.id === e.id))
                .map((event) => (
                  <Link
                    key={event.id}
                    to={`/calendar?date=${event.starts_at.slice(0, 10)}&id=${event.id}`}
                    className="block rounded-xl bg-secondary/50 px-3 py-2.5 text-sm hover:bg-secondary/80"
                  >
                    {event.title}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {!event.all_day ? formatTime(event.starts_at) : 'All day'}
                    </span>
                  </Link>
                ))}
            </div>
          )}
        </section>
      )}

      {isSectionVisible(prefs, 'for_you') && (
      <section className="relative mb-6 overflow-hidden kp-surface p-5 sm:p-6" aria-live="polite">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="kp-section-label">For you</p>
          <Link to="/ask" className="text-xs font-medium text-primary hover:underline">
            Ask more
          </Link>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-foreground/90 sm:text-[0.95rem]">
          {data.briefing}
        </p>
        {data.briefingActions.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.briefingActions.map((action) => {
              const used = Boolean(spentBriefing[action.id])
              return (
                <Button
                  key={action.id}
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={used}
                  className="h-8 rounded-full text-xs"
                  onClick={() => {
                    if (action.kind === 'open_route' && action.route) {
                      window.location.href = action.route
                      return
                    }
                    const result = runAskAction(userId, action)
                    if (result) {
                      toast.success(result)
                      setSpentBriefing((s) => ({ ...s, [action.id]: true }))
                      refresh()
                    }
                  }}
                >
                  {used ? 'Done' : action.label}
                </Button>
              )
            })}
          </div>
        ) : null}
      </section>
      )}

      {isSectionVisible(prefs, 'evening_close') && showEveningClose && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
          className="relative mb-6 overflow-hidden kp-surface border border-primary/20 p-5 sm:p-6"
        >
          <div className="pointer-events-none absolute -right-6 -top-10 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative mb-3 flex items-center gap-2">
            <Moon className="h-4 w-4 text-primary" />
            <p className="kp-section-label">Evening close</p>
          </div>
          <p className="relative font-display text-xl tracking-tight sm:text-2xl">Close the day in a minute</p>
          <p className="relative mt-1 text-sm text-muted-foreground">
            Park unfinished work for tomorrow
            {data.openHabits.length > 0
              ? ` · ${data.openHabits.length} habit${data.openHabits.length === 1 ? '' : 's'} still open`
              : ''}
            .
          </p>
          {data.openHabits.length > 0 && (
            <ul className="relative mt-3 space-y-1.5">
              {data.openHabits.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm">
                  <span>{h.title}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      habitsApi.toggleToday(userId, h.id)
                      refresh()
                    }}
                  >
                    Check in
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Input
            className="relative mt-3"
            value={closeNote}
            onChange={(e) => setCloseNote(e.target.value)}
            placeholder="One line for your journal (optional)"
          />
          <Button className="relative mt-4" onClick={parkUnfinished}>
            Park unfinished & close day
          </Button>
        </motion.section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {isSectionVisible(prefs, 'coming_up') && (
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
              {data.events.slice(0, 4).map((event) => (
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
        )}

        {isSectionVisible(prefs, 'goals') && (
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
              {data.goals.slice(0, 3).map((goal) => {
                const pct = Math.min(100, Math.round((goal.progress / Math.max(goal.target, 1)) * 100))
                return (
                  <li key={goal.id}>
                    <Link to={`/goals?id=${goal.id}`} className="block hover:opacity-90">
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span className="font-medium">{goal.title}</span>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn('h-full rounded-full bg-primary transition-all')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        )}

        {isSectionVisible(prefs, 'recent_notes') && (
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
        )}
      </div>
    </motion.div>
  )
}
