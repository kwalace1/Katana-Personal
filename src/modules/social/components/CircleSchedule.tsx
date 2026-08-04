import { FormEvent, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  endOfWeek,
  format,
  formatTime,
  isToday,
  parseISO,
  startOfDay,
  startOfWeek,
  todayKey,
} from '@/lib/dates'
import { cn } from '@/lib/utils'
import {
  createCircleEvent,
  deleteCircleEvent,
  subscribeCircleEvents,
  updateCircleEvent,
} from '@/lib/social/circle-events'
import type { CircleEvent, CircleGroup, CloudProfile } from '@/lib/social/types'
import { EVENT_CATEGORIES, circleCategoryColor, type EventCategory } from '@/modules/calendar/categories'

function defaultStartLocal(day?: Date) {
  const start = day ? new Date(day) : new Date()
  if (!day) {
    start.setMinutes(0, 0, 0)
    start.setHours(start.getHours() + 1)
  } else {
    start.setHours(10, 0, 0, 0)
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`
}

function memberName(
  uid: string | null | undefined,
  friends: CloudProfile[],
  selfUid: string,
  selfName?: string,
) {
  if (!uid) return null
  if (uid === selfUid) return selfName || 'You'
  return friends.find((f) => f.uid === uid)?.displayName || 'Member'
}

export function CircleSchedule({
  circle,
  selfUid,
  selfName,
  friends,
}: {
  circle: CircleGroup
  selfUid: string
  selfName?: string
  friends: CloudProfile[]
}) {
  const [events, setEvents] = useState<CircleEvent[]>([])
  const [cursor, setCursor] = useState(() => new Date())
  const [addOpen, setAddOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState<EventCategory>('errand')
  const [assigneeId, setAssigneeId] = useState<string>('none')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeCircleEvents(
      circle.id,
      setEvents,
      (err) => toast.error(err.message || 'Couldn’t load schedule'),
    )
    return () => unsub()
  }, [circle.id])

  const weekDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(cursor, { weekStartsOn: 0 }),
        end: endOfWeek(cursor, { weekStartsOn: 0 }),
      }),
    [cursor],
  )

  const selected = selectedId ? events.find((e) => e.id === selectedId) ?? null : null

  const members = useMemo(() => {
    return circle.memberIds.map((uid) => ({
      uid,
      name: memberName(uid, friends, selfUid, selfName) || 'Member',
    }))
  }, [circle.memberIds, friends, selfUid, selfName])

  function openAdd(day?: Date) {
    setTitle('')
    setNotes('')
    setAllDay(false)
    setCategory('errand')
    setAssigneeId('none')
    setStartsAt(defaultStartLocal(day))
    setEndsAt('')
    setAddOpen(true)
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !startsAt) return
    try {
      const start = new Date(startsAt)
      const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 60 * 60 * 1000)
      const created = await createCircleEvent({
        circleId: circle.id,
        title: title.trim(),
        notes,
        startsAt: (allDay ? startOfDay(start) : start).toISOString(),
        endsAt: (allDay ? endOfDay(end) : end).toISOString(),
        allDay,
        category,
        color: circleCategoryColor(category),
        createdBy: selfUid,
        assigneeId: assigneeId === 'none' ? null : assigneeId,
      })
      setAddOpen(false)
      setSelectedId(created.id)
      toast.success('Added to circle schedule')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t add')
    }
  }

  function eventsForDay(day: Date) {
    return events.filter((ev) => {
      const s = parseISO(ev.startsAt)
      if (ev.allDay) return s.toDateString() === day.toDateString()
      return s.toDateString() === day.toDateString()
    })
  }

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm">
        <p className="font-medium">Shared schedule</p>
        <p className="mt-0.5 text-muted-foreground">
          Everyone in this circle can see and edit these plans — groceries, pickups, daily schedules.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCursor(addDays(cursor, -7))}>
            Prev
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>
            This week
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(addDays(cursor, 7))}>
            Next
          </Button>
          <p className="text-sm text-muted-foreground">
            {format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d')}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => openAdd()}>
          <Plus className="h-3.5 w-3.5" />
          Add plan
        </Button>
      </div>

      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {weekDays.map((day) => {
          const dayEvents = eventsForDay(day)
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'kp-surface min-h-[140px] p-3',
                isToday(day) && 'ring-1 ring-primary/40',
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-1">
                <p className="text-xs font-semibold text-muted-foreground">{format(day, 'EEE d')}</p>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={() => openAdd(day)}
                  aria-label={`Add on ${todayKey(day)}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <ul className="space-y-1.5">
                {dayEvents.map((ev) => {
                  const who = memberName(ev.assigneeId, friends, selfUid, selfName)
                  return (
                    <li key={ev.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(ev.id)}
                        className={cn(
                          'w-full rounded-lg px-2 py-1.5 text-left text-xs transition',
                          selectedId === ev.id && 'ring-2 ring-primary/40',
                        )}
                        style={{
                          backgroundColor: `${circleCategoryColor(ev.category)}22`,
                          borderLeft: `3px solid ${circleCategoryColor(ev.category)}`,
                        }}
                      >
                        <p className="font-medium leading-snug">{ev.title}</p>
                        <p className="text-muted-foreground">
                          {ev.allDay ? 'All day' : formatTime(ev.startsAt)}
                          {who ? ` · ${who}` : ''}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      {selected ? (
        <aside className="kp-surface mb-6 space-y-3 p-4">
          <p className="kp-section-label">Edit plan</p>
          <Input
            value={selected.title}
            onChange={(e) => {
              void updateCircleEvent(selected.id, { title: e.target.value }).catch((err) =>
                toast.error(err instanceof Error ? err.message : 'Update failed'),
              )
            }}
          />
          <Select
            value={selected.category}
            onValueChange={(v) => {
              void updateCircleEvent(selected.id, {
                category: v,
                color: circleCategoryColor(v),
              }).catch((err) => toast.error(err instanceof Error ? err.message : 'Update failed'))
            }}
          >
            <SelectTrigger>
              <SelectValue />
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
          <p className="text-[0.7rem] text-muted-foreground">
            Circle colors are shared — everyone sees the same category colors.
          </p>
          <Select
            value={selected.assigneeId || 'none'}
            onValueChange={(v) => {
              void updateCircleEvent(selected.id, {
                assigneeId: v === 'none' ? null : v,
              }).catch((err) => toast.error(err instanceof Error ? err.message : 'Update failed'))
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Anyone / unassigned</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.uid} value={m.uid}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={selected.notes}
            placeholder="Notes"
            onChange={(e) => {
              void updateCircleEvent(selected.id, { notes: e.target.value }).catch((err) =>
                toast.error(err instanceof Error ? err.message : 'Update failed'),
              )
            }}
          />
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={async () => {
              try {
                await deleteCircleEvent(selected.id)
                setSelectedId(null)
                toast.message('Removed from schedule')
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Couldn’t delete')
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </aside>
      ) : null}

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No shared plans yet"
          description="Add groceries, pickups, or who’s free — everyone in the circle sees it live."
          action={
            <Button onClick={() => openAdd()}>
              <Plus className="mr-1 h-4 w-4" />
              Add first plan
            </Button>
          }
        />
      ) : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add to {circle.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void onCreate(e)} className="space-y-4">
            <Input
              autoFocus
              placeholder="e.g. Pick up groceries"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Starts</Label>
                <Input
                  type={allDay ? 'date' : 'datetime-local'}
                  value={allDay ? startsAt.slice(0, 10) : startsAt}
                  onChange={(e) => {
                    const v = e.target.value
                    setStartsAt(allDay ? `${v}T10:00` : v)
                  }}
                />
              </div>
              {!allDay ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Ends</Label>
                  <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={allDay} onCheckedChange={setAllDay} id="circle-all-day" />
              <Label htmlFor="circle-all-day">All day</Label>
            </div>
            <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
              <SelectTrigger>
                <SelectValue />
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
            <p className="text-[0.7rem] text-muted-foreground">Standard colors for everyone in the circle.</p>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Who’s on it?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Anyone / unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.uid} value={m.uid}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button type="submit" className="w-full" disabled={!title.trim() || !startsAt}>
              Add to schedule
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
