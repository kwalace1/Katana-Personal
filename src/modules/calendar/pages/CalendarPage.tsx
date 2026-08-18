import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
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
import { EVENT_CATEGORIES, PERSONAL_COLOR_SWATCHES, categoryColor } from '../categories'
import {
  agendaForDay,
  buildAgenda,
  DEFAULT_AGENDA_FILTER,
  type AgendaFilter,
  type AgendaItem,
} from '../agenda'
import { CalendarGrid, DayWeekStrip, dayTaskCount } from '../components/CalendarGrid'

type View = 'day' | 'week' | 'month'
type AddKind = 'event' | 'task' | 'goal'

function toLocalInput(iso: string) {
  const d = parseISO(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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

function AgendaChip({
  item,
  compact,
  selected,
  onSelect,
}: {
  item: AgendaItem
  compact?: boolean
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
        'w-full rounded-lg text-left transition',
        compact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm',
        selected && 'ring-2 ring-primary/40',
      )}
      style={{
        backgroundColor: `${item.color}22`,
        borderLeft: `3px solid ${item.color}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('font-medium leading-snug', compact && 'line-clamp-2')}>{item.title}</span>
        {!compact ? (
          <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {item.sourceLabel}
          </span>
        ) : null}
      </div>
      <p className={cn('text-muted-foreground', compact ? 'text-[0.65rem]' : 'mt-0.5 text-xs')}>
        {item.all_day ? 'All day' : formatTime(item.starts_at)}
        {compact ? ` · ${item.sourceLabel}` : item.kind === 'event' && !item.all_day ? ` – ${formatTime(item.ends_at)}` : ''}
      </p>
    </button>
  )
}

export default function CalendarPage() {
  const { user } = useAuth()
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
  const [addKind, setAddKind] = useState<AddKind>('event')
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState<EventCategory>('personal')
  const [eventColor, setEventColor] = useState<string | null>(null)
  const [location, setLocation] = useState('')
  const [recurrence, setRecurrence] = useState<CalendarEvent['recurrence']>('none')
  const [reminder, setReminder] = useState('30')

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

  const weekDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(selectedDay, { weekStartsOn: 0 }),
        end: endOfWeek(selectedDay, { weekStartsOn: 0 }),
      }),
    [selectedDay],
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
    setStartsAt(defaultStartLocal(day))
    setEndsAt('')
    setTitle('')
    setNotes('')
    setLocation('')
    setAllDay(false)
    setCategory('personal')
    setRecurrence('none')
    setReminder('30')
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
        color: eventColor,
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
  const selectedTaskCount = dayTaskCount(dayAgenda)

  function toggleFilter(key: keyof AgendaFilter) {
    setFilter((f) => ({ ...f, [key]: !f[key] }))
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        title="Calendar"
        description="Events, tasks, goals, and habits — one calendar."
        eyebrow="Plan"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => openAdd(selectedDay)}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
            <Button size="icon" variant="outline" onClick={() => shift(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => selectDay(new Date())}>
              Today
            </Button>
            <Button size="icon" variant="outline" onClick={() => shift(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {([
            ['day', 'Day'],
            ['week', 'Week'],
            ['month', 'Month'],
          ] as const).map(([v, label]) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => setView(v)}
            >
              {label}
            </Button>
          ))}
        </div>
        <p className="font-display text-lg tracking-tight sm:text-xl">
          {view === 'month'
            ? format(cursor, 'MMMM yyyy')
            : view === 'week'
              ? `${format(days[0] ?? selectedDay, 'MMM d')} – ${format(days[days.length - 1] ?? selectedDay, 'MMM d')}`
              : format(selectedDay, 'MMMM d, yyyy')}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['events', 'Events'],
            ['tasks', 'Tasks'],
            ['goals', 'Goals'],
            ['habits', 'Habits'],
            ...(cloudEnabled && circles.length > 0 ? ([['circles', 'Circles']] as const) : []),
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={filter[key] ? 'secondary' : 'outline'}
            className="rounded-full text-xs"
            onClick={() => toggleFilter(key)}
          >
            {filter[key] ? <Check className="mr-1 h-3 w-3" /> : null}
            {label}
          </Button>
        ))}
      </div>

      {circles.length > 0 && filter.circles ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {circles.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={circleEnabled[c.id] !== false ? 'outline' : 'ghost'}
              className="rounded-full text-xs"
              onClick={() =>
                setCircleEnabled((prev) => ({
                  ...prev,
                  [c.id]: prev[c.id] === false,
                }))
              }
            >
              {c.name}
            </Button>
          ))}
        </div>
      ) : null}

      <p className="mb-4 flex flex-wrap gap-3 text-[0.7rem] text-muted-foreground">
        {EVENT_CATEGORIES.slice(0, 4).map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Tasks
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          Goals
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-600" />
          Habits
        </span>
      </p>

      {view !== 'day' ? (
        <div className="kp-surface mb-4 p-3 sm:p-4">
          <CalendarGrid
            days={days}
            selectedDay={selectedDay}
            viewMonth={cursor}
            muteOutsideMonth={view === 'month'}
            compact={view === 'month'}
            agenda={agenda}
            onSelectDay={(day) => selectDay(day)}
          />
        </div>
      ) : (
        <DayWeekStrip
          days={weekDays}
          selectedDay={selectedDay}
          agenda={agenda}
          onSelectDay={(day) => selectDay(day)}
        />
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="kp-surface p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="kp-section-label">
                {isToday(selectedDay) ? 'Today' : format(selectedDay, 'EEEE')}
              </p>
              <h2 className="mt-1 font-display text-2xl tracking-tight">
                {format(selectedDay, 'MMMM d')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedTaskCount > 0
                  ? `${selectedTaskCount} ${selectedTaskCount === 1 ? 'task' : 'tasks'}`
                  : 'No tasks'}
                {dayAgenda.length - selectedTaskCount > 0
                  ? ` · ${dayAgenda.length - selectedTaskCount} other`
                  : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {view !== 'day' ? (
                <Button size="sm" variant="outline" onClick={() => setView('day')}>
                  Day view
                </Button>
              ) : null}
              <Button size="sm" variant="outline" className="gap-1" onClick={() => openAdd(selectedDay)}>
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </div>
          {dayAgenda.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nothing on this day yet.</p>
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
            <aside className="kp-surface h-fit space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="kp-section-label">Edit event</p>
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
              <Input
                value={selected.title}
                onChange={(e) => {
                  calendarApi.update(userId, selected.id, { title: e.target.value })
                  refresh()
                }}
              />
              <Select
                value={selected.category}
                onValueChange={(v) => {
                  calendarApi.update(userId, selected.id, {
                    category: v as EventCategory,
                    color: selected.color,
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
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Color</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    title="Use category default"
                    className={cn(
                      'h-7 w-7 rounded-full border-2 border-dashed border-border',
                      !selected.color && 'ring-2 ring-primary ring-offset-2',
                    )}
                    style={{ background: categoryColor(selected.category) }}
                    onClick={() => {
                      calendarApi.update(userId, selected.id, { color: null })
                      refresh()
                    }}
                  />
                  {PERSONAL_COLOR_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      title={hex}
                      className={cn(
                        'h-7 w-7 rounded-full border border-border/60',
                        selected.color === hex && 'ring-2 ring-primary ring-offset-2',
                      )}
                      style={{ background: hex }}
                      onClick={() => {
                        calendarApi.update(userId, selected.id, { color: hex })
                        refresh()
                      }}
                    />
                  ))}
                </div>
              </div>
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
              <Input
                placeholder="Location"
                value={selected.location}
                onChange={(e) => {
                  calendarApi.update(userId, selected.id, { location: e.target.value })
                  refresh()
                }}
              />
              <Textarea
                placeholder="Notes"
                value={selected.notes}
                onChange={(e) => {
                  calendarApi.update(userId, selected.id, { notes: e.target.value })
                  refresh()
                }}
              />
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
                  <SelectItem value="none">Once</SelectItem>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekly">Every week</SelectItem>
                  <SelectItem value="monthly">Every month</SelectItem>
                </SelectContent>
              </Select>
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
            <aside className="kp-surface h-fit space-y-3 p-4">
              <p className="kp-section-label">{selectedAgenda.sourceLabel}</p>
              <h3 className="font-display text-xl">{selectedAgenda.title}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedAgenda.all_day
                  ? 'All day'
                  : `${formatTime(selectedAgenda.starts_at)} – ${formatTime(selectedAgenda.ends_at)}`}
              </p>
              <Button asChild className="w-full">
                <Link to={selectedAgenda.href}>Open</Link>
              </Button>
            </aside>
          ) : null}
        </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add to calendar</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
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
                  className="rounded-full"
                  onClick={() => setAddKind(k)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Input
              autoFocus
              placeholder={
                addKind === 'event' ? 'What’s happening?' : addKind === 'task' ? 'Task title' : 'Goal title'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {addKind === 'goal' ? 'Target date' : 'Starts'}
                </Label>
                <Input
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
                    }
                  }}
                />
              </div>
              {addKind === 'event' && !allDay ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Ends</Label>
                  <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </div>
              ) : null}
            </div>
            {addKind !== 'goal' ? (
              <div className="flex items-center gap-2">
                <Switch checked={allDay} onCheckedChange={setAllDay} id="add-all-day" />
                <Label htmlFor="add-all-day">All day</Label>
              </div>
            ) : null}
            {addKind === 'event' ? (
              <>
                <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: categoryColor(c.id) }}
                          />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Color (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      title="Category default"
                      className={cn(
                        'h-7 w-7 rounded-full border-2 border-dashed border-border',
                        !eventColor && 'ring-2 ring-primary ring-offset-2',
                      )}
                      style={{ background: categoryColor(category) }}
                      onClick={() => setEventColor(null)}
                    />
                    {PERSONAL_COLOR_SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        className={cn(
                          'h-7 w-7 rounded-full border border-border/60',
                          eventColor === hex && 'ring-2 ring-primary ring-offset-2',
                        )}
                        style={{ background: hex }}
                        onClick={() => setEventColor(hex)}
                      />
                    ))}
                  </div>
                </div>
                <Input
                  placeholder="Location (optional)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <Select
                  value={recurrence}
                  onValueChange={(v) => setRecurrence(v as CalendarEvent['recurrence'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Repeat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Once</SelectItem>
                    <SelectItem value="daily">Every day</SelectItem>
                    <SelectItem value="weekly">Every week</SelectItem>
                    <SelectItem value="monthly">Every month</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  placeholder="Reminder (minutes)"
                  value={reminder}
                  onChange={(e) => setReminder(e.target.value)}
                />
              </>
            ) : null}
            <Textarea
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {addKind === 'event' ? (
              <p className="text-xs text-muted-foreground">
                Circle plans stay in Circles → Schedule so nothing private is shared by accident.
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={!title.trim() || !startsAt}>
              {addKind === 'event' ? 'Create event' : addKind === 'task' ? 'Add task' : 'Add goal'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
