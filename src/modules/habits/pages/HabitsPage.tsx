import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { CompleteToggle } from '@/components/CompleteToggle'
import { useAuth } from '@/contexts/AuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { todayKey } from '@/lib/dates'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { cn } from '@/lib/utils'
import { habitsApi } from '../api'
import { ShareWithFriendsButton } from '@/components/ShareWithFriendsButton'
import {
  WEEKDAY_OPTIONS,
  formatHabitSchedule,
  type Habit,
  type HabitSchedule,
  type Weekday,
} from '../types'

const SCHEDULE_CHIPS: { id: HabitSchedule; label: string }[] = [
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekends', label: 'Weekends' },
  { id: 'custom', label: 'Custom days' },
  { id: 'once', label: 'One time' },
]

function SchedulePicker({
  schedule,
  customDays,
  onceDate,
  onSchedule,
  onCustomDays,
  onOnceDate,
}: {
  schedule: HabitSchedule
  customDays: Weekday[]
  onceDate: string
  onSchedule: (s: HabitSchedule) => void
  onCustomDays: (days: Weekday[]) => void
  onOnceDate: (date: string) => void
}) {
  function toggleDay(day: Weekday) {
    if (customDays.includes(day)) {
      onCustomDays(customDays.filter((d) => d !== day))
    } else {
      onCustomDays([...customDays, day].sort((a, b) => a - b) as Weekday[])
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SCHEDULE_CHIPS.map((chip) => (
          <Button
            key={chip.id}
            type="button"
            size="sm"
            variant={schedule === chip.id ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => onSchedule(chip.id)}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {schedule === 'custom' ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Repeat on</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map((opt) => {
              const on = customDays.includes(opt.day)
              return (
                <Button
                  key={opt.day}
                  type="button"
                  size="sm"
                  variant={on ? 'default' : 'outline'}
                  className="min-w-[2.75rem] rounded-full px-2"
                  onClick={() => toggleDay(opt.day)}
                  aria-pressed={on}
                  title={opt.label}
                >
                  {opt.short}
                </Button>
              )
            })}
          </div>
          {customDays.length === 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">Pick at least one day.</p>
          ) : (
            <p className="text-xs text-muted-foreground">Repeats every {formatHabitSchedule({ schedule: 'custom', custom_days: customDays, once_date: null })}.</p>
          )}
        </div>
      ) : null}

      {schedule === 'once' ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Date</p>
          <Input
            type="date"
            value={onceDate}
            onChange={(e) => onOnceDate(e.target.value)}
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground">Shows once on that day — not a repeating habit.</p>
        </div>
      ) : null}
    </div>
  )
}

function Heatmap({ userId, habitId }: { userId: string; habitId: string }) {
  const cells = habitsApi.heatmap(userId, habitId, 84)
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">Last 12 weeks</p>
      <div className="grid grid-flow-col grid-rows-7 gap-0.5" style={{ width: 'fit-content' }}>
        {cells.map((c) => (
          <div
            key={c.date}
            title={`${c.date}${c.due ? (c.done ? ' · done' : ' · due') : ' · off'}`}
            className={cn(
              'h-2.5 w-2.5 rounded-[2px]',
              c.done ? 'bg-primary' : c.due ? 'bg-secondary' : 'bg-transparent ring-1 ring-border/40',
            )}
          />
        ))}
      </div>
    </div>
  )
}

export default function HabitsPage() {
  const { user } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const [params, setParams] = useSearchParams()

  const habits = useMemo(() => {
    void tick
    return habitsApi.list(userId)
  }, [userId, tick])

  const dueIds = useMemo(() => new Set(habitsApi.dueToday(userId).map((h) => h.id)), [userId, tick])

  const [title, setTitle] = useState('')
  const [schedule, setSchedule] = useState<HabitSchedule>('daily')
  const [customDays, setCustomDays] = useState<Weekday[]>([1, 2, 3, 4, 5])
  const [onceDate, setOnceDate] = useState(todayKey())
  const [filter, setFilter] = useState<'all' | 'due'>('due')
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'))

  useEffect(() => {
    const id = params.get('id')
    if (id) setSelectedId(id)
  }, [params])

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (schedule === 'custom' && customDays.length === 0) return
    if (schedule === 'once' && !onceDate) return
    const habit = habitsApi.create(userId, {
      title,
      schedule,
      custom_days: customDays,
      once_date: onceDate,
    })
    setTitle('')
    setSchedule('daily')
    setCustomDays([1, 2, 3, 4, 5])
    setOnceDate(todayKey())
    setSelectedId(habit.id)
    setParams({ id: habit.id })
    refresh()
  }

  const visible = habits.filter((h) => (filter === 'due' ? dueIds.has(h.id) : true))

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        title="Habits"
        description="Pick the days that fit — every day, custom weekdays, or one time."
        eyebrow="Life"
      />

      <form onSubmit={onCreate} className="kp-surface mb-6 space-y-3 p-4 sm:p-5">
        <div className="flex gap-2">
          <Input
            placeholder="A habit worth keeping…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" aria-label="Add">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <SchedulePicker
          schedule={schedule}
          customDays={customDays}
          onceDate={onceDate}
          onSchedule={setSchedule}
          onCustomDays={setCustomDays}
          onOnceDate={setOnceDate}
        />
      </form>

      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={filter === 'due' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter('due')}>
          Due today
        </Button>
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter('all')}>
          All
        </Button>
      </div>

      {habits.length === 0 ? (
        <EmptyState
          title="No habits yet"
          description="Start with one small thing. That’s enough."
          action={
            <Button asChild variant="outline">
              <Link to="/ask?q=What%20habits%20should%20I%20check%20in%3F">Ask about habits</Link>
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState title="Nothing due today" description="Enjoy the quiet, or switch to All." />
      ) : (
        <div>
          <ul className="space-y-2">
            {visible.map((habit) => {
              const done = habitsApi.isDoneToday(userId, habit.id)
              const streak = habitsApi.streak(userId, habit.id)
              const scheduleLabel = habitsApi.scheduleLabel(habit)
              const expanded = selectedId === habit.id
              return (
                <li
                  key={habit.id}
                  className={cn('kp-surface overflow-hidden p-0', expanded && 'ring-2 ring-primary/30')}
                >
                  <div className="flex items-center gap-3 p-4">
                    <CompleteToggle
                      done={done}
                      openLabel="To do"
                      doneLabel="Done"
                      onToggle={() => {
                        habitsApi.toggleToday(userId, habit.id)
                        refresh()
                      }}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        if (expanded) {
                          setSelectedId(null)
                          setParams({})
                        } else {
                          setSelectedId(habit.id)
                          setParams({ id: habit.id })
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold">{habit.title}</h3>
                        <ChevronDown
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition',
                            expanded && 'rotate-180',
                          )}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {scheduleLabel}
                        {habit.schedule !== 'once' && streak > 0
                          ? ` · ${streak} day${streak === 1 ? '' : 's'} in a row`
                          : ''}
                        <span className="text-primary/80"> · {expanded ? 'Hide edit' : 'Tap to edit'}</span>
                      </p>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        habitsApi.remove(userId, habit.id)
                        if (selectedId === habit.id) setSelectedId(null)
                        refresh()
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="px-4 pb-3">
                    <Heatmap userId={userId} habitId={habit.id} />
                  </div>
                  <AnimatePresence initial={false}>
                    {expanded ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-border/60"
                      >
                        <div className="space-y-3 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-muted-foreground">Edit habit</p>
                            <ShareWithFriendsButton
                              kind="habit"
                              title={habit.title}
                              data={{
                                schedule: habit.schedule,
                                custom_days: habit.custom_days,
                                once_date: habit.once_date,
                                localHabitId: habit.id,
                              }}
                            />
                          </div>
                          <Input
                            value={habit.title}
                            onChange={(e) => {
                              habitsApi.update(userId, habit.id, { title: e.target.value })
                              refresh()
                            }}
                          />
                          <SchedulePicker
                            schedule={habit.schedule}
                            customDays={habit.custom_days?.length ? habit.custom_days : [1, 2, 3, 4, 5]}
                            onceDate={habit.once_date || todayKey()}
                            onSchedule={(s) => {
                              habitsApi.update(userId, habit.id, {
                                schedule: s,
                                custom_days: s === 'custom' ? habit.custom_days?.length ? habit.custom_days : [1, 2, 3, 4, 5] : [],
                                once_date: s === 'once' ? habit.once_date || todayKey() : null,
                              })
                              refresh()
                            }}
                            onCustomDays={(days) => {
                              habitsApi.update(userId, habit.id, {
                                schedule: 'custom',
                                custom_days: days,
                                once_date: null,
                              })
                              refresh()
                            }}
                            onOnceDate={(date) => {
                              habitsApi.update(userId, habit.id, {
                                schedule: 'once',
                                once_date: date,
                                custom_days: [],
                              })
                              refresh()
                            }}
                          />
                          <div>
                            <p className="mb-1 text-xs text-muted-foreground">Reminder time</p>
                            <Input
                              type="time"
                              value={habit.reminder_time || ''}
                              onChange={(e) => {
                                habitsApi.update(userId, habit.id, {
                                  reminder_time: e.target.value || null,
                                })
                                refresh()
                              }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </motion.div>
  )
}
