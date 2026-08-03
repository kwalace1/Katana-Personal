import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/contexts/AuthContext'
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
import type { CalendarEvent } from '../types'

type View = 'day' | 'week' | 'month'

function toLocalInput(iso: string) {
  const d = parseISO(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function CalendarPage() {
  const { user } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const [params, setParams] = useSearchParams()

  const initialDate = params.get('date')
  const [cursor, setCursor] = useState(() => (initialDate ? parseISO(initialDate) : new Date()))
  const [view, setView] = useState<View>(params.get('date') ? 'day' : 'week')
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'))

  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [endsAt, setEndsAt] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [location, setLocation] = useState('')
  const [recurrence, setRecurrence] = useState<CalendarEvent['recurrence']>('none')
  const [reminder, setReminder] = useState('30')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const date = params.get('date')
    const id = params.get('id')
    if (date) {
      setCursor(parseISO(date))
      setView('day')
    }
    if (id) setSelectedId(id)
  }, [params])

  const events = useMemo(() => {
    void tick
    return calendarApi.list(userId)
  }, [userId, tick])

  const selected = selectedId ? events.find((e) => e.id === selectedId) ?? null : null
  const conflicts = useMemo(() => {
    void tick
    return calendarApi.conflicts(userId, cursor)
  }, [userId, cursor, tick])

  const days = useMemo(() => {
    if (view === 'day') return [cursor]
    if (view === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(cursor, { weekStartsOn: 0 }),
        end: endOfWeek(cursor, { weekStartsOn: 0 }),
      })
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const gridStart = startOfWeek(start, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(end, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [cursor, view])

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !startsAt) return
    const start = new Date(startsAt)
    const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 60 * 60 * 1000)
    const event = calendarApi.create(userId, {
      title: title.trim(),
      notes,
      starts_at: (allDay ? startOfDay(start) : start).toISOString(),
      ends_at: (allDay ? endOfDay(end) : end).toISOString(),
      all_day: allDay,
      location,
      recurrence,
      reminder_minutes: Number(reminder) || null,
    })
    setTitle('')
    setStartsAt('')
    setEndsAt('')
    setLocation('')
    setNotes('')
    setAllDay(false)
    setRecurrence('none')
    setReminder('30')
    setShowMore(false)
    setSelectedId(event.id)
    setParams({ date: event.starts_at.slice(0, 10), id: event.id })
    refresh()
  }

  function addForToday() {
    const start = new Date()
    start.setMinutes(0, 0, 0)
    start.setHours(start.getHours() + 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    setStartsAt(
      `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`,
    )
    setCursor(new Date())
    setView('day')
  }

  function shift(delta: number) {
    if (view === 'day') setCursor(addDays(cursor, delta))
    else if (view === 'week') setCursor(addDays(cursor, delta * 7))
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))
  }

  const dayAgenda = view === 'day' ? calendarApi.forDay(userId, cursor) : []

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        title="Calendar"
        description="Your days, at a glance."
        eyebrow="Plan"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={addForToday}>
              Add for today
            </Button>
            <Button size="icon" variant="outline" onClick={() => shift(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <Button size="icon" variant="outline" onClick={() => shift(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
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

      <form onSubmit={onCreate} className="kp-surface mb-6 space-y-3 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="flex-1"
            placeholder="What’s happening?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="sm:w-[220px]"
          />
          <Button type="submit" size="icon" aria-label="Add">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowMore((v) => !v)}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition', showMore && 'rotate-180')} />
          {showMore ? 'Less' : 'Details'}
        </button>
        {showMore && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ends</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Where</Label>
              <Input placeholder="Optional" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={allDay} onCheckedChange={setAllDay} id="all-day" />
              <Label htmlFor="all-day">All day</Label>
            </div>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as CalendarEvent['recurrence'])}>
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
            <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}
      </form>

      {view === 'day' ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="kp-surface p-4 sm:p-5">
            <p className="kp-section-label">{format(cursor, 'EEEE')}</p>
            <h2 className="mt-1 font-display text-2xl tracking-tight">{format(cursor, 'MMMM d')}</h2>
            {dayAgenda.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nothing on this day yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {dayAgenda.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(event.id)
                        setParams({ date: todayKey(cursor), id: event.id })
                      }}
                      className={cn(
                        'w-full rounded-2xl px-4 py-3 text-left transition',
                        conflicts.has(event.id) ? 'bg-destructive/10 ring-1 ring-destructive/30' : 'bg-secondary/60',
                        selectedId === event.id && 'ring-2 ring-primary/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{event.title}</span>
                        {conflicts.has(event.id) ? (
                          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-destructive">
                            Conflict
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {event.all_day ? 'All day' : `${formatTime(event.starts_at)} – ${formatTime(event.ends_at)}`}
                        {event.location ? ` · ${event.location}` : ''}
                      </p>
                    </button>
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
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-3',
            view === 'week' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-7',
            view === 'month' && 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7',
          )}
        >
          {days.map((day) => {
            const dayEvents = calendarApi.forDay(userId, day)
            const dayConflicts = calendarApi.conflicts(userId, day)
            return (
              <button
                type="button"
                key={day.toISOString()}
                onClick={() => {
                  setCursor(day)
                  setView('day')
                  setParams({ date: todayKey(day) })
                }}
                className={cn(
                  'kp-surface min-h-[120px] p-3 text-left transition hover:ring-1 hover:ring-primary/30',
                  isToday(day) && 'ring-1 ring-primary/40',
                  view === 'month' && day.getMonth() !== cursor.getMonth() && 'opacity-45',
                )}
              >
                <p className="text-xs font-semibold text-muted-foreground">
                  {format(day, view === 'month' ? 'd' : 'EEE d')}
                </p>
                <ul className="mt-2 space-y-1">
                  {dayEvents.map((event) => (
                    <li
                      key={event.id}
                      className={cn(
                        'rounded-lg px-2 py-1 text-xs',
                        dayConflicts.has(event.id) ? 'bg-destructive/15' : 'bg-secondary/60',
                      )}
                    >
                      <span className="font-medium leading-snug">{event.title}</span>
                      <div className="text-muted-foreground">
                        {event.all_day ? 'All day' : formatTime(event.starts_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      )}

      {events.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nothing planned" description="Add something above when you know what’s next." />
        </div>
      ) : null}
    </motion.div>
  )
}
