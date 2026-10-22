import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles,
  ArrowRight,
  AlertCircle,
  Moon,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { format, formatTime, formatShortDate, todayKey, addDays } from '@/lib/dates'
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
import { waterMl } from '@/modules/health/water'
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
import {
  TODAY_SECTIONS,
  isSectionVisible,
  toggleSection,
} from '@/modules/dashboard/today-layout'
import { FirstRitual } from '@/modules/dashboard/components/FirstRitual'
import { TodayDayList } from '@/modules/dashboard/components/TodayDayList'
import { TodayQuickCreate } from '@/modules/dashboard/components/TodayQuickCreate'
import { TodayRecentFeed } from '@/modules/dashboard/components/TodayRecentFeed'
import { WeatherGlance } from '@/components/WeatherGlance'
import { toast } from 'sonner'
import { listFriendships } from '@/lib/social/friends'
import { listMyCircles } from '@/lib/social/circles'
import { buildPickNextStepInput } from '@/lib/orchestration/build-input'
import {
  logFeedback,
  logNextStepDismissedIfNeeded,
  nextStepTrackingId,
  computeWeights,
} from '@/lib/orchestration/feedback'
import { pickNextStep, workoutLogTarget, type NextStep, type NextStepKind } from '@/lib/orchestration/next-step'

const CLOSE_KEY = 'katana-personal:day-close'

type NextControl = {
  key: string
  label: string
  to?: string
  onClick?: () => void
}

function NextStepActions({ primary, more }: { primary: NextControl; more: NextControl[] }) {
  const label = (
    <>
      {primary.label}
      <ArrowRight className="h-4 w-4" />
    </>
  )
  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary.to ? (
        <Button asChild className="gap-2">
          <Link to={primary.to} onClick={primary.onClick}>
            {label}
          </Link>
        </Button>
      ) : (
        <Button className="gap-2" onClick={primary.onClick}>
          {label}
        </Button>
      )}
      {more.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1.5">
              More
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            {more.map((item) =>
              item.to ? (
                <DropdownMenuItem key={item.key} asChild>
                  <Link to={item.to} onClick={item.onClick}>
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={item.key} onSelect={() => item.onClick?.()}>
                  {item.label}
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
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
  const [closeNote, setCloseNote] = useState('')
  const [closeOpen, setCloseOpen] = useState(false)
  const [dayClosed, setDayClosed] = useState(closedToday)
  const [spentBriefing, setSpentBriefing] = useState<Record<string, true>>({})
  const [togetherCue, setTogetherCue] = useState<{ label: string; to: string } | null>(null)
  const [closeMoment, setCloseMoment] = useState<{ open: boolean; summary: DayCloseSummary | null }>({
    open: false,
    summary: null,
  })
  const prefs = profile?.preferences
  const lastNextRef = useRef<{ kind: NextStepKind; id: string } | null>(null)

  function persistWeights() {
    const weights = computeWeights(userId)
    updatePreferences({
      orchestration_weights: { ...weights, updated_at: new Date().toISOString() },
    })
  }

  function logCompleted(kind: NextStepKind) {
    logFeedback(userId, 'next_step_completed', kind, persistWeights)
  }

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
    const next = pickNextStep(
      buildPickNextStepInput(userId, snap, {
        preferences: prefs,
        dayClosed: dayClosed,
      }),
    )

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
      unfinishedToday: tasksApi.todayTasks(userId),
    }
  }, [userId, tick, profile?.display_name, prefs, dayClosed])

  useEffect(() => {
    if (!onboardingDone || !data.next) return
    const id = nextStepTrackingId(data.next)
    const current = { kind: data.next.kind, id }
    logNextStepDismissedIfNeeded(userId, lastNextRef.current, current, persistWeights)
    logFeedback(userId, 'next_step_shown', data.next.kind, persistWeights)
    lastNextRef.current = current
  }, [data.next?.kind, data.next?.title, data.next?.taskId, data.next?.habitId, userId, onboardingDone])

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
      waterGlasses: Math.round(waterMl(healthApi.getWater(userId))),
      noteSnippet: note || undefined,
      dateLabel: format(new Date(), 'EEEE · MMM d'),
    }
    markClosed()
    setDayClosed(true)
    setCloseNote('')
    setCloseOpen(false)
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

  const dayList = useMemo(() => {
    const nextTaskId = data.next?.kind === 'task' ? data.next.taskId : undefined
    const nextHabitId = data.next?.habitId
    const nextEventId = data.next?.eventId
    const seen = new Set<string>()
    const tasks: { id: string; title: string; detail?: string; trailing?: string }[] = []
    for (const task of [...data.unfinishedToday, ...data.priority]) {
      if (seen.has(task.id) || task.id === nextTaskId) continue
      seen.add(task.id)
      const dueToday = task.due_at?.slice(0, 10) === todayKey()
      const parsed = task.due_at ? new Date(task.due_at) : null
      const hasTime = Boolean(parsed && (parsed.getHours() !== 0 || parsed.getMinutes() !== 0))
      tasks.push({
        id: task.id,
        title: task.title,
        detail: task.priority === 'high' ? 'Priority' : undefined,
        trailing:
          dueToday && hasTime && task.due_at
            ? formatTime(task.due_at)
            : !dueToday && task.due_at
              ? formatShortDate(task.due_at)
              : undefined,
      })
    }
    return {
      tasks,
      habits: data.openHabits
        .filter((habit) => habit.id !== nextHabitId)
        .map((habit) => ({
          id: habit.id,
          title: habit.title,
          detail: data.atRisk.some((item) => item.id === habit.id) ? 'Streak at risk' : undefined,
        })),
      events: data.todayEvents
        .filter((event) => event.id !== nextEventId)
        .map((event) => ({
          id: event.id,
          title: event.title,
          trailing: event.all_day ? 'All day' : formatTime(event.starts_at),
          to: `/calendar?date=${event.starts_at.slice(0, 10)}&id=${event.id}`,
        })),
    }
  }, [data])

  function nextControls(next: NextStep): NextControl[] {
    if (next.kind === 'task' && next.taskId) {
      const taskId = next.taskId
      return [
        {
          key: 'done',
          label: 'Mark done',
          onClick: () => {
            const task = tasksApi.getTask(userId, taskId)
            if (!task) return
            tasksApi.completeTask(userId, task.id)
            offerTaskCompleteShare(task.title)
            logCompleted('task')
            toast.success('Done')
            refresh()
          },
        },
        { key: 'open', label: 'Open', to: `/tasks?id=${taskId}` },
      ]
    }

    if (next.kind === 'event' && next.eventId) {
      const date =
        data.todayEvents.find((event) => event.id === next.eventId)?.starts_at.slice(0, 10) ?? todayKey()
      return [{ key: 'open', label: 'Open event', to: `/calendar?date=${date}&id=${next.eventId}` }]
    }

    if (next.kind === 'habit' && next.habitId) {
      const habitId = next.habitId
      return [
        {
          key: 'check',
          label: 'Check in',
          onClick: () => {
            const habit = habitsApi.get(userId, habitId)
            if (!habit) return
            habitsApi.toggleToday(userId, habit.id)
            offerHabitCheckedInShare(habit.title, habitsApi.streak(userId, habit.id))
            logCompleted('habit')
            toast.success('Checked in')
            cheerTogether()
            refresh()
          },
        },
      ]
    }

    if (next.kind === 'workout') {
      const log = workoutLogTarget(next.title)
      const controls: NextControl[] = [{ key: 'log', label: log.label, to: log.route }]
      if (next.habitId) {
        const habitId = next.habitId
        controls.push({
          key: 'check',
          label: 'Check in',
          onClick: () => {
            const habit = habitsApi.get(userId, habitId)
            if (!habit) return
            habitsApi.toggleToday(userId, habit.id)
            logCompleted('workout')
            toast.success('Checked in')
            cheerTogether()
            refresh()
          },
        })
      }
      for (const action of next.actions.filter((item) => item.kind === 'schedule_workout')) {
        controls.push({
          key: action.id,
          label: action.label,
          onClick: () => {
            const result = runAskAction(userId, action)
            if (result) {
              toast.success(result)
              refresh()
            }
          },
        })
      }
      return controls
    }

    if (next.kind === 'recovery') {
      return [
        {
          key: 'sleep',
          label: 'Log sleep',
          to: '/health?area=wellness&tab=sleep',
          onClick: () => logCompleted('recovery'),
        },
        { key: 'journal', label: 'Open journal', to: '/journal' },
      ]
    }

    if (next.kind === 'goal' && next.goalId) {
      const extras = next.actions
        .filter((action) => action.kind === 'adjust_goal')
        .map((action) => ({
          key: action.id,
          label: action.label,
          onClick: () => {
            const result = runAskAction(userId, action)
            if (result) {
              toast.success(result)
              refresh()
            }
          },
        }))
      return [{ key: 'open', label: 'Open goal', to: `/goals?id=${next.goalId}` }, ...extras]
    }

    if (next.kind === 'wind_down') {
      return [
        { key: 'close', label: 'Close day', onClick: parkUnfinished },
        { key: 'journal', label: 'Journal', to: '/journal' },
      ]
    }

    return []
  }

  const stepControls = data.next ? nextControls(data.next) : []
  const primaryStep = stepControls[0]

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <div className="mx-auto max-w-xl">
      <header className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="order-2 min-w-0 sm:order-1">
          <p className="kp-section-label uppercase tracking-wide">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
          <h1 className="mt-1 font-display text-2xl tracking-tight kp-text-balance">
            {greeting}, {profile?.display_name || 'there'}
          </h1>
        </div>
        {onboardingDone ? (
          <div className="order-1 -mr-2 flex shrink-0 items-center justify-end sm:order-2 sm:mr-0">
            <Button asChild variant="ghost" size="icon" aria-label="Ask">
              <Link to="/ask">
                <Sparkles className="h-4 w-4" />
              </Link>
            </Button>
            <TodayQuickCreate userId={userId} onCreated={refresh} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Today options">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Show on Today</DropdownMenuLabel>
                {TODAY_SECTIONS.map((section) => {
                  const on = isSectionVisible(prefs, section.id)
                  return (
                    <DropdownMenuCheckboxItem
                      key={section.id}
                      checked={on}
                      className="min-h-11"
                      onCheckedChange={(checked) => {
                        if ((checked === true) === on) return
                        updatePreferences({ todayLayout: toggleSection(prefs, section.id) })
                      }}
                      onSelect={(event) => event.preventDefault()}
                    >
                      {section.label}
                    </DropdownMenuCheckboxItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </header>

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

      {onboardingDone ? (
        <>
          <WeatherGlance variant="today" quiet />

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

          {isSectionVisible(prefs, 'do_this_next') && (
            <motion.section
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springSoft}
              className="relative mb-6 overflow-hidden kp-surface p-4"
            >
              <p className="kp-section-label uppercase tracking-wide">Next step</p>
              {data.next ? (
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg tracking-tight">{data.next.title}</h2>
                    <p className="mt-1 text-sm text-foreground/85">{data.next.reason}</p>
                    {data.next.meta ? (
                      <p className="mt-1 text-xs text-muted-foreground">{data.next.meta}</p>
                    ) : null}
                  </div>
                  {primaryStep ? (
                    <NextStepActions primary={primaryStep} more={stepControls.slice(1)} />
                  ) : null}
                </div>
              ) : (
                <div className="mt-2">
                  <h2 className="font-display text-lg tracking-tight">Nothing urgent</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Nothing urgent right now.</p>
                </div>
              )}
            </motion.section>
          )}

          {isSectionVisible(prefs, 'also_today') && (
            <TodayDayList
              tasks={dayList.tasks}
              habits={dayList.habits}
              events={dayList.events}
              onCompleteTask={(id) => {
                const task = tasksApi.getTask(userId, id)
                if (!task) return
                tasksApi.completeTask(userId, id)
                offerTaskCompleteShare(task.title)
                if (data.next?.kind === 'task' && data.next.taskId === id) logCompleted('task')
                refresh()
              }}
              onCheckHabit={(id) => {
                const habit = habitsApi.get(userId, id)
                if (!habit) return
                habitsApi.toggleToday(userId, id)
                offerHabitCheckedInShare(habit.title, habitsApi.streak(userId, id))
                if (data.next && data.next.habitId === id) {
                  logCompleted(data.next.kind === 'workout' ? 'workout' : 'habit')
                }
                cheerTogether()
                refresh()
              }}
            />
          )}

          {data.atRisk.length > 0 && !isSectionVisible(prefs, 'also_today') && (
            <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">
              Streak at risk: {data.atRisk.map((h) => h.title).join(', ')} — check in before the day
              ends.
            </p>
          )}

          <WeeklyReviewCard
            snap={data.snap}
            onDone={() => toast.success('Week reviewed')}
          />

          {isSectionVisible(prefs, 'together') && <TogetherTodayCard />}

          {isSectionVisible(prefs, 'for_you') && (
            <section className="relative mb-3 overflow-hidden kp-surface p-4" aria-live="polite">
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

          <TodayRecentFeed hideEmpty />

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
                  <h2 className="kp-section-label">
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
                  <h2 className="kp-section-label">
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
                  <h2 className="kp-section-label">
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

          {showEveningClose && (
            <>
              <button
                type="button"
                className="mt-2 flex w-full items-center gap-3 px-0.5 py-3 text-left"
                onClick={() => setCloseOpen(true)}
              >
                <Moon className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 text-sm font-medium">Close your day</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
                <DialogContent size="sm">
                  <DialogHeader>
                    <DialogTitle>Close your day</DialogTitle>
                    <DialogDescription>
                      Park unfinished work onto tomorrow
                      {data.openHabits.length > 0
                        ? `, with ${data.openHabits.length} habit${data.openHabits.length === 1 ? '' : 's'} still open`
                        : ''}
                      . One line for your journal is optional.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    className="min-h-11"
                    value={closeNote}
                    onChange={(e) => setCloseNote(e.target.value)}
                    placeholder="One line for your journal (optional)"
                  />
                  <Button className="w-full" onClick={parkUnfinished}>
                    Park unfinished and close day
                  </Button>
                </DialogContent>
              </Dialog>
            </>
          )}
        </>
      ) : null}
      </div>
    </motion.div>
  )
}
