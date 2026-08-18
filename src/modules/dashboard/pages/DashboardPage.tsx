import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
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
import { format, formatTime, formatShortDate, formatShortWhen, todayKey, addDays } from '@/lib/dates'
import { pageEnterSubtle, springSoft } from '@/lib/motion-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { DayClosedMoment } from '@/components/DayClosedMoment'
import { tasksApi } from '@/modules/tasks/api'
import { calendarApi } from '@/modules/calendar/api'
import { habitsApi } from '@/modules/habits/api'
import { notesApi } from '@/modules/notes/api'
import { goalsApi } from '@/modules/goals/api'
import { journalApi } from '@/modules/journal/api'
import { healthApi } from '@/modules/health/api'
import {
  buildDayCloseShareCard,
  offerHabitCheckedInShare,
  offerShareWin,
  offerTaskCompleteShare,
} from '@/lib/social/share-win'
import { takeDayCloseMoment, type DayCloseSummary } from '@/lib/ritual-path'
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
import { FirstRitual } from '@/modules/dashboard/components/FirstRitual'
import { TodayQuickCreate } from '@/modules/dashboard/components/TodayQuickCreate'
import { TodayRecentFeed } from '@/modules/dashboard/components/TodayRecentFeed'
import { toast } from 'sonner'
import { listFriendships } from '@/lib/social/friends'
import { listMyCircles } from '@/lib/social/circles'
import type { Task } from '@/modules/tasks/types'
import type { CalendarEvent } from '@/modules/calendar/types'
import type { Habit } from '@/modules/habits/types'

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
  const [alsoOpen, setAlsoOpen] = useState(false)
  const [closeNote, setCloseNote] = useState('')
  const [dayClosed, setDayClosed] = useState(closedToday)
  const [weekCardVisible, setWeekCardVisible] = useState(() => shouldOfferWeekReview())
  const [spentBriefing, setSpentBriefing] = useState<Record<string, true>>({})
  const [editingLayout, setEditingLayout] = useState(false)
  const [togetherCue, setTogetherCue] = useState<{ label: string; to: string } | null>(null)
  const [closeMoment, setCloseMoment] = useState<{ open: boolean; summary: DayCloseSummary | null }>({
    open: false,
    summary: null,
  })
  const prefs = profile?.preferences

  function cheerTogether() {
    if (!cloudEnabled || !cloudUser) return
    toast.message('Logged for your day', {
      description: 'Optional: cheer it in Circles with friends',
      action: {
        label: 'Circles',
        onClick: () => {
          window.location.href = '/circles'
        },
      },
    })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!cloudEnabled || !cloudUser) {
        setTogetherCue(null)
        return
      }
      try {
        const friendships = await listFriendships(cloudUser.uid)
        const pending = friendships.filter(
          (f) => f.status === 'pending' && f.requestedBy !== cloudUser.uid,
        )
        if (pending.length > 0) {
          if (!cancelled)
            setTogetherCue({
              label:
                pending.length === 1
                  ? 'Friend request waiting'
                  : `${pending.length} friend requests`,
              to: '/social?tab=friends',
            })
          return
        }
        const circles = await listMyCircles(cloudUser.uid)
        const live = circles.find((c) => {
          const ch = c.challenge
          if (!ch) return false
          const now = Date.now()
          return new Date(ch.startsAt).getTime() <= now && new Date(ch.endsAt).getTime() >= now
        })
        if (live?.challenge) {
          if (!cancelled)
            setTogetherCue({
              label: `Challenge: ${live.challenge.title}`,
              to: `/circles?id=${live.id}`,
            })
          return
        }
        if (!cancelled) setTogetherCue(null)
      } catch {
        if (!cancelled) setTogetherCue(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cloudEnabled, cloudUser?.uid, tick])

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
      unfinishedToday: tasksApi.todayTasks(userId),
    }
  }, [userId, tick, profile?.display_name])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const showEveningClose =
    onboardingDone && !dayClosed && isSectionVisible(prefs, 'evening_close') && hour >= 17

  useEffect(() => {
    const parked = takeDayCloseMoment()
    if (!parked) return
    setDayClosed(true)
    setCloseMoment({ open: true, summary: parked })
  }, [])

  function parkUnfinished() {
    const tomorrow = addDays(new Date(), 1)
    tomorrow.setHours(17, 0, 0, 0)
    let n = 0
    for (const task of data.unfinishedToday) {
      tasksApi.updateTask(userId, task.id, { due_at: tomorrow.toISOString() })
      n += 1
    }
    const note = closeNote.trim()
    if (note) {
      journalApi.upsert(userId, {
        mood: 'okay',
        body: note,
        reflection: 'Evening close',
      })
    }
    const due = habitsApi.dueToday(userId)
    const habitsDone = due.filter((h) => habitsApi.isDoneToday(userId, h.id)).length
    const summary: DayCloseSummary = {
      parked: n,
      habitsDone,
      habitsDue: due.length,
      waterGlasses: healthApi.getWater(userId).glasses,
      noteSnippet: note || undefined,
      dateLabel: format(new Date(), 'EEEE · MMM d'),
    }
    markClosed()
    setDayClosed(true)
    setCloseNote('')
    setCloseMoment({ open: true, summary })
    refresh()
  }

  function shareDayCard() {
    const summary = closeMoment.summary
    setCloseMoment({ open: false, summary: null })
    if (summary) {
      offerShareWin(
        buildDayCloseShareCard({
          dateLabel: summary.dateLabel,
          parked: summary.parked,
          habitsDone: summary.habitsDone,
          habitsDue: summary.habitsDue,
          waterGlasses: summary.waterGlasses,
          noteSnippet: summary.noteSnippet,
        }),
        280,
        { force: true },
      )
    }
  }

  function finishCloseMoment() {
    setCloseMoment({ open: false, summary: null })
    offerPwaNudge()
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        eyebrow={format(new Date(), 'EEEE · MMMM d')}
        title={`${greeting}, ${profile?.display_name || 'there'}`}
        description={
          onboardingDone
            ? 'Create something, cheer a win, do the next step.'
            : 'One quiet minute to start the day.'
        }
        actions={
          onboardingDone ? (
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
          ) : null
        }
      />

      {onboardingDone && editingLayout && (
        <section className="mb-6 kp-surface p-5 sm:p-6">
          <p className="kp-section-label">Today layout</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn sections on or off. Create and recent feed always stay.
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

      {!onboardingDone ? (
        <FirstRitual
          tick={tick}
          onRefresh={refresh}
          onFinished={() => {
            markOnboardingDone()
            toast.success('Today is yours')
          }}
        />
      ) : null}

      {onboardingDone && weekCardVisible && (
        <WeeklyReviewCard
          snap={data.snap}
          onDone={() => {
            setWeekCardVisible(false)
            toast.success('Week reviewed — back to today')
          }}
        />
      )}

      {onboardingDone ? (
        <>
          <TodayQuickCreate userId={userId} onCreated={refresh} />
          <TodayRecentFeed />

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
              Streak at risk: {data.atRisk.map((h) => h.title).join(', ')} — check in before the day
              ends.
            </p>
          )}

          {isSectionVisible(prefs, 'do_this_next') && (
            <motion.section
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springSoft}
              className="relative mb-5 overflow-hidden kp-surface p-5"
            >
              <p className="kp-section-label">Do this next</p>
              {data.next ? (
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-display text-xl tracking-tight sm:text-2xl">
                      {data.next.type === 'task' && data.next.item.title}
                      {data.next.type === 'event' && data.next.item.title}
                      {data.next.type === 'habit' && data.next.item.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.next.type === 'task' && (
                        <>
                          Task
                          {data.next.item.due_at ? ` · ${formatShortWhen(data.next.item.due_at)}` : ''}
                          {data.next.item.priority === 'high' ? ' · Important' : ''}
                        </>
                      )}
                      {data.next.type === 'event' && (
                        <>
                          Event · {formatShortDate(data.next.item.starts_at)}
                          {!data.next.item.all_day
                            ? ` · ${formatTime(data.next.item.starts_at)}`
                            : ' · All day'}
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
                          className="gap-2"
                          onClick={() => {
                            const task = data.next!.item
                            tasksApi.completeTask(userId, task.id)
                            offerTaskCompleteShare(task.title)
                            toast.success('Done')
                            refresh()
                          }}
                        >
                          Mark done
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button asChild variant="outline">
                          <Link to={`/tasks?id=${data.next.item.id}`}>Open</Link>
                        </Button>
                      </>
                    )}
                    {data.next.type === 'event' && (
                      <Button asChild className="gap-2">
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
                        className="gap-2"
                        onClick={() => {
                          const habit = data.next!.item
                          habitsApi.toggleToday(userId, habit.id)
                          offerHabitCheckedInShare(habit.title, habitsApi.streak(userId, habit.id))
                          toast.success('Checked in')
                          cheerTogether()
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
                <div className="mt-2">
                  <h2 className="font-display text-xl tracking-tight">Nothing urgent</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Capture above, or open Tasks when you’re ready.
                  </p>
                </div>
              )}
            </motion.section>
          )}

          {isSectionVisible(prefs, 'together') && <TogetherTodayCard />}

          {isSectionVisible(prefs, 'also_today') &&
            (data.alsoTasks.length > 0 ||
              data.openHabits.length > 0 ||
              data.todayEvents.length > 0) && (
              <section className="mb-5 kp-surface">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left"
                  onClick={() => setAlsoOpen((v) => !v)}
                  aria-expanded={alsoOpen}
                >
                  <span className="text-sm font-semibold tracking-tight">Also today</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {data.alsoTasks.length + data.openHabits.length} more
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
                        <Link
                          to={`/tasks?id=${task.id}`}
                          className="min-w-0 truncate text-sm hover:underline"
                        >
                          {task.title}
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            tasksApi.completeTask(userId, task.id)
                            offerTaskCompleteShare(task.title)
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
                              offerHabitCheckedInShare(
                                habit.title,
                                habitsApi.streak(userId, habit.id),
                              )
                              cheerTogether()
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
            <section className="relative mb-5 overflow-hidden kp-surface p-5" aria-live="polite">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="kp-section-label">For you</p>
                <Link to="/ask" className="text-xs font-medium text-primary hover:underline">
                  Ask more
                </Link>
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-foreground/90">
                {data.briefing}
              </p>
              {data.briefingActions.length > 0 || togetherCue ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {togetherCue ? (
                    <Button asChild size="sm" variant="default" className="min-h-10 rounded-full px-4 text-xs">
                      <Link to={togetherCue.to}>{togetherCue.label}</Link>
                    </Button>
                  ) : null}
                  {data.briefingActions.map((action) => {
                    const used = Boolean(spentBriefing[action.id])
                    return (
                      <Button
                        key={action.id}
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={used}
                        className="min-h-10 rounded-full px-4 text-xs"
                        onClick={() => {
                          if (action.kind === 'open_route' && action.route) {
                            window.location.href = action.route
                            return
                          }
                          const result = runAskAction(userId, action)
                          if (result) {
                            toast.success(result)
                            if (action.kind === 'toggle_habit' || action.kind === 'log_water') {
                              cheerTogether()
                            }
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

          {showEveningClose && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springSoft}
              className="relative mb-5 overflow-hidden kp-surface border border-primary/15 p-4 sm:p-5"
            >
              <div className="relative mb-2 flex items-center gap-2">
                <Moon className="h-4 w-4 text-primary" />
                <p className="kp-section-label">Evening close</p>
              </div>
              <p className="relative font-display text-lg tracking-tight">Close the day</p>
              <p className="relative mt-1 text-sm text-muted-foreground">
                Park unfinished work, note one line, rest.
                {data.openHabits.length > 0
                  ? ` · ${data.openHabits.length} habit${data.openHabits.length === 1 ? '' : 's'} open`
                  : ''}
              </p>
              <Input
                className="relative mt-3 min-h-11"
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                placeholder="One line for your journal (optional)"
              />
              <Button className="relative mt-3 min-h-11 w-full sm:w-auto" onClick={parkUnfinished}>
                Park unfinished & close day
              </Button>
            </motion.section>
          )}

          <DayClosedMoment
            open={closeMoment.open}
            summary={
              closeMoment.summary ?? {
                parked: 0,
                habitsDone: 0,
                habitsDue: 0,
                waterGlasses: 0,
                dateLabel: format(new Date(), 'EEEE · MMM d'),
              }
            }
            onShare={shareDayCard}
            onDone={finishCloseMoment}
          />

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {isSectionVisible(prefs, 'coming_up') && data.events.length > 0 && (
              <section className="px-1 py-2 sm:px-0">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Coming up
                  </h2>
                  <Link to="/calendar" className="text-xs font-medium text-primary hover:underline">
                    Calendar
                  </Link>
                </div>
                <ul className="space-y-1.5">
                  {data.events.slice(0, 4).map((event) => (
                    <li key={event.id}>
                      <Link
                        to={`/calendar?date=${event.starts_at.slice(0, 10)}&id=${event.id}`}
                        className="flex items-baseline justify-between gap-3 rounded-xl py-1.5 text-sm transition hover:text-primary"
                      >
                        <span className="min-w-0 truncate font-medium">{event.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatShortDate(event.starts_at)}
                          {!event.all_day ? ` · ${formatTime(event.starts_at)}` : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {isSectionVisible(prefs, 'goals') && data.goals.length > 0 && (
              <section className="px-1 py-2 sm:px-0">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Goals
                  </h2>
                  <Link to="/goals" className="text-xs font-medium text-primary hover:underline">
                    View
                  </Link>
                </div>
                <ul className="space-y-3">
                  {data.goals.slice(0, 3).map((goal) => {
                    const pct = Math.min(
                      100,
                      Math.round((goal.progress / Math.max(goal.target, 1)) * 100),
                    )
                    return (
                      <li key={goal.id}>
                        <Link to={`/goals?id=${goal.id}`} className="block hover:opacity-90">
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="font-medium">{goal.title}</span>
                            <span className="text-muted-foreground">{pct}%</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {isSectionVisible(prefs, 'recent_notes') && data.notes.length > 0 && (
              <section className="px-1 py-2 sm:px-0 lg:col-span-2">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Recent notes
                  </h2>
                  <Link to="/notes" className="text-xs font-medium text-primary hover:underline">
                    Notes
                  </Link>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {data.notes.slice(0, 4).map((note) => (
                    <Link
                      key={note.id}
                      to={`/notes?id=${note.id}`}
                      className="max-w-[14rem] truncate text-sm font-medium hover:text-primary hover:underline"
                    >
                      {note.title}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      ) : null}
    </motion.div>
  )
}
