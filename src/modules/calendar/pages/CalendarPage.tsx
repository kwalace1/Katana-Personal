import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Segmented } from '@/components/ui/segmented'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  formatTime,
  isToday,
  parseISO,
  startOfWeek,
  startOfDay,
  endOfDay,
  todayKey,
} from '@/lib/dates'
import { cn } from '@/lib/utils'
import { calendarApi } from '../api'
import { ShareWithFriendsButton } from '@/components/ShareWithFriendsButton'
import { offerEventCreatedShare, offerTaskCreatedShare } from '@/lib/social/share-win'
import { tasksApi } from '@/modules/tasks/api'
import { goalsApi } from '@/modules/goals/api'
import { habitsApi } from '@/modules/habits/api'
import { listMyCircles } from '@/lib/social/circles'
import { listCircleEventsForCircles } from '@/lib/social/circle-events'
import type { CircleEvent, CircleGroup } from '@/lib/social/types'
import type { CalendarEvent } from '../types'
import type { EventCategory } from '../categories'
import { EVENT_CATEGORIES } from '../categories'
import { calendarColorPreferencePatch, resolveCalendarItemColors } from '../item-colors'
import { CalendarColorLegend, CalendarColorSettings } from '../components/CalendarColorSettings'
import {
  agendaForDay,
  buildAgenda,
  DEFAULT_AGENDA_FILTER,
  type AgendaFilter,
  type AgendaItem,
} from '../agenda'
import { CalendarGrid } from '../components/CalendarGrid'
import { IntegrationStatusStrip } from '@/modules/settings/components/IntegrationStatusStrip'

type View = 'day' | 'week' | 'month'
type AddKind = 'event' | 'task' | 'goal'

function formatLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toLocalInput(iso: string) {
  return formatLocal(parseISO(iso))
}

function plusOneHourLocal(local: string) {
  const start = new Date(local)
  if (Number.isNaN(start.getTime())) return ''
  return formatLocal(new Date(start.getTime() + 60 * 60 * 1000))
}

function defaultStartLocal(day?: Date) {
  const start = day ? new Date(day) : new Date()
  if (!day) {
    start.setMinutes(0, 0, 0)
    start.setHours(start.getHours() + 1)
  } else {
    start.setHours(9, 0, 0, 0)
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`
}

function agendaSummary(items: AgendaItem[]) {
  const labels: Record<AgendaItem['kind'], [string, string]> = {
    event: ['event', 'events'],
    task: ['task', 'tasks'],
    goal: ['goal', 'goals'],
    habit: ['habit', 'habits'],
    circle: ['circle event', 'circle events'],
  }
  return (Object.keys(labels) as AgendaItem['kind'][])
    .map((kind) => {
      const count = items.filter((item) => item.kind === kind).length
      if (count === 0) return null
      const [one, many] = labels[kind]
      return `${count} ${count === 1 ? one : many}`
    })
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

function entryType(item: AgendaItem) {
  if (item.kind === 'circle') return item.sourceLabel || 'Circle'
  if (item.kind === 'event') return 'Event'
  if (item.kind === 'task') return 'Task'
  if (item.kind === 'goal') return 'Goal'
  return 'Habit'
}

function entryDetail(item: AgendaItem) {
  const type = entryType(item)
  const when = item.all_day
    ? 'All day'
    : item.kind === 'event'
      ? `${formatTime(item.starts_at)} – ${formatTime(item.ends_at)}`
      : formatTime(item.starts_at)
  const extra =
    item.kind !== 'circle' && item.sourceLabel && item.sourceLabel !== type ? item.sourceLabel : null
  return [type, extra, when].filter(Boolean).join(' · ')
}

function AgendaChip({
  item,
  selected,
  onSelect,
}: {
  item: AgendaItem
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
      className={cn(
        'w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition',
        selected && 'ring-2 ring-primary/40',
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: item.color }}
    >
      <span className="block font-medium leading-snug">{item.title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{entryDetail(item)}</span>
    </button>
  )
}

export default function CalendarPage() {
  const { user, profile, updatePreferences } = useAuth()
  const { cloudEnabled, cloudUser } = useCloudAuth()
  const navigate = useNavigate()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const [params, setParams] = useSearchParams()

  const initialDate = params.get('date')
  const [selectedDay, setSelectedDay] = useState(() => (initialDate ? parseISO(initialDate) : new Date()))
  const [cursor, setCursor] = useState(() => (initialDate ? parseISO(initialDate) : new Date()))
  const [view, setView] = useState<View>(() => {
    const v = params.get('view')
    if (v === 'day' || v === 'week' || v === 'month') return v
    return 'month'
  })

  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'))
  const [filter, setFilter] = useState<AgendaFilter>(DEFAULT_AGENDA_FILTER)
  const [addOpen, setAddOpen] = useState(false)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  const [addKind, setAddKind] = useState<AddKind>('event')
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState<EventCategory>('personal')
  const [location, setLocation] = useState('')
  const [recurrence, setRecurrence] = useState<CalendarEvent['recurrence']>('none')
  const [reminder, setReminder] = useState('30')
  const [moreOpen, setMoreOpen] = useState(false)
  const [endsTouched, setEndsTouched] = useState(false)

  const [circles, setCircles] = useState<CircleGroup[]>([])
  const [circleEvents, setCircleEvents] = useState<CircleEvent[]>([])
  const [circleEnabled, setCircleEnabled] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const date = params.get('date')
    const id = params.get('id')
    const v = params.get('view')
    if (date) {
      const parsed = parseISO(date)
      setSelectedDay(parsed)
      setCursor(parsed)
    }
    if (id) setSelectedId(id)
    if (v === 'day' || v === 'week' || v === 'month') setView(v)
  }, [params])

  useEffect(() => {
    if (!cloudEnabled || !cloudUser) {
      setCircles([])
      setCircleEvents([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const list = await listMyCircles(cloudUser.uid)
        if (cancelled) return
        setCircles(list)
        setCircleEnabled((prev) => {
          const next = { ...prev }
          for (const c of list) {
            if (next[c.id] === undefined) next[c.id] = true
          }
          return next
        })
        const events = await listCircleEventsForCircles(list.map((c) => c.id))
        if (!cancelled) setCircleEvents(events)
      } catch {
        // optional overlay
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cloudEnabled, cloudUser?.uid])

  const events = useMemo(() => {
    void tick
    return calendarApi.list(userId)
  }, [userId, tick])

  const tasks = useMemo(() => {
    void tick
    return tasksApi.listTasks(userId)
  }, [userId, tick])

  const goals = useMemo(() => {
    void tick
    return goalsApi.list(userId)
  }, [userId, tick])

  const habits = useMemo(() => {
    void tick
    return habitsApi.list(userId)
  }, [userId, tick])

  const lists = useMemo(() => {
    void tick
    return tasksApi.listLists(userId)
  }, [userId, tick])

  const circleIdsEnabled = useMemo(() => {
    const set = new Set<string>()
    for (const c of circles) {
      if (circleEnabled[c.id] !== false) set.add(c.id)
    }
    return set
  }, [circles, circleEnabled])

  const days = useMemo(() => {
    const focus = view === 'day' ? selectedDay : cursor
    if (view === 'day') return [focus]
    if (view === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(focus, { weekStartsOn: 0 }),
        end: endOfWeek(focus, { weekStartsOn: 0 }),
      })
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const gridStart = startOfWeek(start, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(end, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [cursor, selectedDay, view])

  const itemColors = useMemo(
    () => resolveCalendarItemColors(profile?.preferences),
    [profile?.preferences],
  )

  const agenda = useMemo(() => {
    const rangeStart = days[0] ?? cursor
    const rangeEnd = days[days.length - 1] ?? cursor
    return buildAgenda({
      events,
      tasks,
      goals,
      habits,
      rangeStart,
      rangeEnd,
      habitDone: (habitId, dateKey) => habitsApi.isDoneToday(userId, habitId, dateKey),
      lists,
      filter,
      circleEvents: circleEvents.map((event) => ({
        event,
        circleName: circles.find((c) => c.id === event.circleId)?.name || 'Circle',
      })),
      circleIdsEnabled,
      colors: itemColors,
    })
  }, [
    events,
    tasks,
    goals,
    habits,
    lists,
    filter,
    circleEvents,
    circles,
    circleIdsEnabled,
    days,
    cursor,
    itemColors,
    userId,
    tick,
  ])

  const selected = selectedId ? events.find((e) => e.id === selectedId) ?? null : null
  const selectedAgenda =
    selectedId && !selected
      ? agenda.find((a) => a.id === selectedId) ?? null
      : selected
        ? agenda.find((a) => a.kind === 'event' && a.id === selectedId) ?? null
        : null

  const conflicts = useMemo(() => {
    void tick
    return calendarApi.conflicts(userId, selectedDay)
  }, [userId, selectedDay, tick])

  function selectDay(day: Date, extra?: { id?: string | null }) {
    setSelectedDay(day)
    setCursor(day)
    const next: Record<string, string> = { date: todayKey(day) }
    if (extra?.id) {
      next.id = extra.id
      setSelectedId(extra.id)
    } else {
      setSelectedId(null)
    }
    setParams(next)
  }

  function openAdd(day?: Date) {
    const start = defaultStartLocal(day)
    setStartsAt(start)
    setEndsAt(plusOneHourLocal(start))
    setEndsTouched(false)
    setTitle('')
    setNotes('')
    setLocation('')
    setAllDay(false)
    setCategory('personal')
    setRecurrence('none')
    setReminder('30')
    setMoreOpen(false)
    setAddKind('event')
    setAddOpen(true)
  }

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !startsAt) return
    const start = new Date(startsAt)
    const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 60 * 60 * 1000)

    if (addKind === 'event') {
      const event = calendarApi.create(userId, {
        title: title.trim(),
        notes,
        starts_at: (allDay ? startOfDay(start) : start).toISOString(),
        ends_at: (allDay ? endOfDay(end) : end).toISOString(),
        all_day: allDay,
        location,
        recurrence,
        reminder_minutes: Number(reminder) || null,
        category,
        color: null,
      })
      setSelectedId(event.id)
      setParams({ date: event.starts_at.slice(0, 10), id: event.id })
      setSelectedDay(parseISO(event.starts_at))
      setCursor(parseISO(event.starts_at))
      const whenLabel = allDay
        ? format(start, 'MMM d') + ' · All day'
        : format(start, 'MMM d · h:mm a')
      offerEventCreatedShare(event.title, whenLabel)
    } else if (addKind === 'task') {
      const task = tasksApi.createTask(userId, {
        title: title.trim(),
        notes,
        due_at: (allDay ? startOfDay(start) : start).toISOString(),
        list_id: lists[0]?.id ?? null,
      })
      setParams({ date: (task.due_at || startsAt).slice(0, 10) })
      setSelectedDay(start)
      setCursor(start)
      setSelectedId(null)
      offerTaskCreatedShare(task.title)
    } else {
      const goal = goalsApi.create(userId, {
        title: title.trim(),
        description: notes,
        target_date: todayKey(start),
      })
      setParams({ date: todayKey(start) })
      setSelectedDay(start)
      setCursor(start)
      navigate(`/goals?id=${goal.id}`)
    }

    setAddOpen(false)
    refresh()
  }

  function shift(delta: number) {
    if (view === 'day') {
      selectDay(addDays(selectedDay, delta))
      return
    }
    if (view === 'week') {
      selectDay(addDays(selectedDay, delta * 7))
      return
    }
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1)
    const last = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()
    const day = Math.min(selectedDay.getDate(), last)
    selectDay(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day))
  }

  function selectItem(item: AgendaItem) {
    if (item.kind === 'event') {
      setSelectedId(item.id)
      setParams({ date: item.starts_at.slice(0, 10), id: item.id })
      return
    }
    setSelectedId(item.id)
    if (item.kind === 'task' || item.kind === 'goal' || item.kind === 'circle' || item.kind === 'habit') {
      navigate(item.href)
    }
  }

  const dayAgenda = agendaForDay(agenda, selectedDay)
  const daySummary = agendaSummary(dayAgenda)
  const periodLabel =
    view === 'month'
      ? format(cursor, 'MMMM yyyy')
      : view === 'week'
        ? `${format(days[0] ?? selectedDay, 'MMM d')} – ${format(days[days.length - 1] ?? selectedDay, 'MMM d')}`
        : format(selectedDay, 'MMMM d, yyyy')
  const shiftLabel = view === 'month' ? 'month' : view === 'week' ? 'week' : 'day'

  function toggleFilter(key: keyof AgendaFilter) {
    setFilter((f) => ({ ...f, [key]: !f[key] }))
  }

  function commitItemColors(next: typeof itemColors) {
    updatePreferences(calendarColorPreferencePatch(next))
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page overflow-visible">
      <PageHeader title="Calendar" className="mb-2" />

      <div className="sticky top-[calc(4rem+max(0.5rem,env(safe-area-inset-top))+0.25rem)] z-10 -mx-4 mb-3 flex flex-col gap-2 bg-background px-4 py-2 sm:-mx-6 sm:px-6 md:top-0 md:flex-row md:flex-wrap md:items-center lg:-mx-8 lg:px-8">
        <div className="flex min-w-0 items-center gap-1 md:flex-1">
          <Button
            size="icon"
            variant="outline"
            aria-label={`Previous ${shiftLabel}`}
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-0 flex-1 truncate text-center font-display text-base tracking-tight">
            {periodLabel}
          </p>
          <Button
            size="icon"
            variant="outline"
            aria-label={`Next ${shiftLabel}`}
            onClick={() => shift(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="ml-1 shrink-0" onClick={() => selectDay(new Date())}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2 md:contents">
          <Segmented
            full
            value={view}
            onChange={setView}
            className="min-w-0 flex-1 md:w-auto md:flex-none"
            options={[
              { id: 'day', label: 'Day' },
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
            ]}
          />
          <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="shrink-0">
              Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="max-h-[min(32rem,var(--radix-popover-content-available-height))] space-y-3 overflow-y-auto"
            onFocusOutside={(event) => event.preventDefault()}
          >
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['events', 'Events'],
                  ['tasks', 'Tasks'],
                  ['goals', 'Goals'],
                  ['habits', 'Habits'],
                  ...(cloudEnabled && circles.length > 0 ? ([['circles', 'Circles']] as const) : []),
                ] as const
              ).map(([key, label]) => {
                const mark =
                  key === 'events'
                    ? 'event'
                    : key === 'tasks'
                      ? 'task'
                      : key === 'goals'
                        ? 'goal'
                        : key === 'habits'
                          ? 'habit'
                          : null
                return (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={filter[key] ? 'secondary' : 'outline'}
                    className="rounded-full text-xs"
                    onClick={() => toggleFilter(key)}
                  >
                    {filter[key] ? <Check className="h-3 w-3" /> : null}
                    {mark ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'kp-type-mark h-2 w-2 shrink-0',
                          mark === 'task' && 'rounded-[2px]',
                          mark === 'goal' && 'rotate-45 rounded-[2px]',
                          mark === 'habit' && 'rounded-full border',
                          mark === 'event' && 'rounded-full',
                        )}
                        style={
                          mark === 'habit'
                            ? { borderColor: itemColors[mark] }
                            : { background: itemColors[mark] }
                        }
                      />
                    ) : null}
                    {label}
                  </Button>
                )
              })}
            </div>
            {circles.length > 0 && filter.circles ? (
              <div className="flex flex-wrap gap-2">
                {circles.map((circle) => (
                  <Button
                    key={circle.id}
                    type="button"
                    size="sm"
                    variant={circleEnabled[circle.id] !== false ? 'outline' : 'ghost'}
                    className="rounded-full text-xs"
                    onClick={() =>
                      setCircleEnabled((prev) => ({
                        ...prev,
                        [circle.id]: prev[circle.id] === false,
                      }))
                    }
                  >
                    {circle.name}
                  </Button>
                ))}
              </div>
            ) : null}
            <CalendarColorLegend colors={itemColors} />
            <CalendarColorSettings colors={itemColors} onChange={commitItemColors} />
          </PopoverContent>
          </Popover>
        </div>
      </div>

      {view === 'day' ? null : (
        <CalendarGrid
          days={days}
          selectedDay={selectedDay}
          viewMonth={cursor}
          muteOutsideMonth={view === 'month'}
          compact={view === 'month'}
          agenda={agenda}
          onSelectDay={(day) => selectDay(day)}
        />
      )}

      <div className="mt-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-lg tracking-tight">
                {isToday(selectedDay) ? `Today, ${format(selectedDay, 'MMMM d')}` : format(selectedDay, 'EEEE, MMMM d')}
              </h2>
              {daySummary ? <p className="mt-1 text-sm text-muted-foreground">{daySummary}</p> : null}
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => openAdd(selectedDay)}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {dayAgenda.length === 0 ? (
            <EmptyState
              compact
              plain
              title="Nothing scheduled"
              description="Use Add to put something on this date."
            />
          ) : (
            <ul className="mt-4 space-y-2">
              {dayAgenda.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <AgendaChip
                    item={item}
                    selected={selectedId === item.id}
                    onSelect={() => selectItem(item)}
                  />
                  {item.kind === 'event' && conflicts.has(item.id) ? (
                    <p className="mt-1 px-1 text-[0.65rem] font-semibold uppercase tracking-wide text-destructive">
                      Time conflict
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
          {selected ? (
            <aside className="kp-surface mt-4 space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg tracking-tight">Edit event</h3>
                <ShareWithFriendsButton
                  kind="event"
                  title={selected.title}
                  body={selected.notes}
                  data={{
                    starts_at: selected.starts_at,
                    ends_at: selected.ends_at,
                    all_day: selected.all_day,
                    location: selected.location,
                    localEventId: selected.id,
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={selected.title}
                onChange={(e) => {
                  calendarApi.update(userId, selected.id, { title: e.target.value })
                  refresh()
                }}
              />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
              <Select
                value={selected.category}
                onValueChange={(v) => {
                  calendarApi.update(userId, selected.id, {
                    category: v as EventCategory,
                  })
                  refresh()
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                    {EVENT_CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              </div>
              <div className="space-y-1">
                <Label>Start</Label>
                <Input
                type="datetime-local"
                value={toLocalInput(selected.starts_at)}
                onChange={(e) => {
                  calendarApi.update(userId, selected.id, {
                    starts_at: new Date(e.target.value).toISOString(),
                  })
                  refresh()
                }}
              />
              </div>
              <div className="space-y-1">
                <Label>End</Label>
                <Input
                type="datetime-local"
                value={toLocalInput(selected.ends_at)}
                onChange={(e) => {
                  calendarApi.update(userId, selected.id, {
                    ends_at: new Date(e.target.value).toISOString(),
                  })
                  refresh()
                }}
              />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                id="edit-location"
                placeholder="Location"
                value={selected.location}
                onChange={(e) => {
                  calendarApi.update(userId, selected.id, { location: e.target.value })
                  refresh()
                }}
              />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                id="edit-notes"
                placeholder="Notes"
                value={selected.notes}
                onChange={(e) => {
                  calendarApi.update(userId, selected.id, { notes: e.target.value })
                  refresh()
                }}
              />
              </div>
              <div className="space-y-1">
                <Label>Repeat</Label>
              <Select
                value={selected.recurrence}
                onValueChange={(v) => {
                  calendarApi.update(userId, selected.id, {
                    recurrence: v as CalendarEvent['recurrence'],
                  })
                  refresh()
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Doesn't repeat</SelectItem>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekly">Every week</SelectItem>
                  <SelectItem value="monthly">Every month</SelectItem>
                </SelectContent>
              </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={selected.all_day}
                  onCheckedChange={(v) => {
                    calendarApi.update(userId, selected.id, { all_day: v })
                    refresh()
                  }}
                  id="edit-all-day"
                />
                <Label htmlFor="edit-all-day">All day</Label>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  calendarApi.remove(userId, selected.id)
                  setSelectedId(null)
                  setParams({})
                  refresh()
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </aside>
          ) : selectedAgenda ? (
            <aside className="kp-surface mt-4 space-y-3 p-4">
              <p className="text-xs font-medium text-muted-foreground">{entryDetail(selectedAgenda)}</p>
              <h3 className="font-display text-lg">{selectedAgenda.title}</h3>
              <Button asChild className="w-full">
                <Link to={selectedAgenda.href}>Open</Link>
              </Button>
            </aside>
          ) : null}
        </div>

      <div className="mt-6">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-expanded={integrationsOpen}
          onClick={() => setIntegrationsOpen((open) => !open)}
        >
          Integrations
        </Button>
        {integrationsOpen ? <IntegrationStatusStrip userId={userId} tick={tick} /> : null}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[min(92dvh,900px)] gap-3 overflow-hidden pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-display text-lg">Add to calendar</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['event', 'Event'],
                  ['task', 'Task due'],
                  ['goal', 'Goal target'],
                ] as const
              ).map(([k, label]) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={addKind === k ? 'default' : 'outline'}
                  className="min-h-11 rounded-full"
                  onClick={() => setAddKind(k)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-title">
                {addKind === 'event' ? 'Event name' : addKind === 'task' ? 'Task title' : 'Goal title'}
              </Label>
              <Input
                id="add-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="add-start">
                  {addKind === 'goal' ? 'Target date' : addKind === 'task' ? 'Due' : 'Start'}
                </Label>
                <Input
                  id="add-start"
                  type={addKind === 'goal' || allDay ? 'date' : 'datetime-local'}
                  value={
                    addKind === 'goal' || allDay ? startsAt.slice(0, 10) : startsAt
                  }
                  onChange={(e) => {
                    const v = e.target.value
                    if (addKind === 'goal' || allDay) {
                      setStartsAt(`${v}T09:00`)
                    } else {
                      setStartsAt(v)
                      if (!endsTouched) setEndsAt(plusOneHourLocal(v))
                    }
                  }}
                />
              </div>
              {addKind === 'event' && !allDay ? (
                <div className="space-y-1">
                  <Label htmlFor="add-end">End</Label>
                  <Input
                    id="add-end"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => {
                      setEndsTouched(true)
                      setEndsAt(e.target.value)
                    }}
                  />
                </div>
              ) : null}
            </div>
            {addKind !== 'goal' ? (
              <div className="flex min-h-11 items-center gap-2">
                <Switch checked={allDay} onCheckedChange={setAllDay} id="add-all-day" />
                <Label htmlFor="add-all-day">All day</Label>
              </div>
            ) : null}
            {addKind === 'event' ? (
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {addKind === 'event' ? (
              <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-1.5 px-2">
                    <ChevronDown className={cn('h-4 w-4 transition', moreOpen && 'rotate-180')} />
                    More options
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label htmlFor="add-location">Location</Label>
                    <Input
                      id="add-location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Repeat</Label>
                    <Select
                      value={recurrence}
                      onValueChange={(v) => setRecurrence(v as CalendarEvent['recurrence'])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Doesn't repeat</SelectItem>
                        <SelectItem value="daily">Every day</SelectItem>
                        <SelectItem value="weekly">Every week</SelectItem>
                        <SelectItem value="monthly">Every month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="add-reminder">Reminder</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="add-reminder"
                        type="number"
                        min={0}
                        className="w-24"
                        value={reminder}
                        onChange={(e) => setReminder(e.target.value)}
                      />
                      <span className="text-sm text-muted-foreground">minutes before</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="add-notes">Notes</Label>
                    <Textarea
                      id="add-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Circle plans stay in Circles → Schedule so nothing private is shared by accident.
                  </p>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="add-notes">Notes</Label>
                <Textarea
                  id="add-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            )}
            </div>
            <Button type="submit" className="min-h-11 w-full shrink-0" disabled={!title.trim() || !startsAt}>
              {addKind === 'event' ? 'Create event' : addKind === 'task' ? 'Add task' : 'Add goal'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
