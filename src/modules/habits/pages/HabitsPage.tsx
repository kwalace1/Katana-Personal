import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/contexts/AuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { cn } from '@/lib/utils'
import { habitsApi } from '../api'
import { ShareWithFriendsButton } from '@/components/ShareWithFriendsButton'
import type { Habit } from '../types'

const SCHEDULE_CHIPS: { id: Habit['schedule']; label: string }[] = [
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekends', label: 'Weekends' },
]

function Heatmap({ userId, habitId }: { userId: string; habitId: string }) {
  const cells = habitsApi.heatmap(userId, habitId, 84)
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">Last 12 weeks</p>
      <div className="grid grid-flow-col grid-rows-7 gap-0.5" style={{ width: 'fit-content' }}>
        {cells.map((c) => (
          <div
            key={c.date}
            title={`${c.date}${c.done ? ' · done' : ''}`}
            className={cn('h-2.5 w-2.5 rounded-[2px]', c.done ? 'bg-primary' : 'bg-secondary')}
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
  const [schedule, setSchedule] = useState<Habit['schedule']>('daily')
  const [filter, setFilter] = useState<'all' | 'due'>('due')
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'))

  useEffect(() => {
    const id = params.get('id')
    if (id) setSelectedId(id)
  }, [params])

  const selected = selectedId ? habits.find((h) => h.id === selectedId) ?? null : null

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const habit = habitsApi.create(userId, { title, schedule })
    setTitle('')
    setSchedule('daily')
    setSelectedId(habit.id)
    setParams({ id: habit.id })
    refresh()
  }

  const visible = habits.filter((h) => (filter === 'due' ? dueIds.has(h.id) : true))

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader title="Habits" description="Small things, done often — also on your calendar by schedule." eyebrow="Life" />

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
        <div className="flex flex-wrap gap-2">
          {SCHEDULE_CHIPS.map((chip) => (
            <Button
              key={chip.id}
              type="button"
              size="sm"
              variant={schedule === chip.id ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => setSchedule(chip.id)}
            >
              {chip.label}
            </Button>
          ))}
        </div>
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
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <ul className="space-y-2">
            {visible.map((habit) => {
              const done = habitsApi.isDoneToday(userId, habit.id)
              const streak = habitsApi.streak(userId, habit.id)
              const scheduleLabel =
                habit.schedule === 'daily'
                  ? 'Every day'
                  : habit.schedule === 'weekdays'
                    ? 'Weekdays'
                    : 'Weekends'
              return (
                <li
                  key={habit.id}
                  className={cn(
                    'kp-surface p-4',
                    selectedId === habit.id && 'ring-2 ring-primary/30',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={done ? 'Undo today' : 'Check in'}
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition',
                        done
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary',
                      )}
                      onClick={() => {
                        habitsApi.toggleToday(userId, habit.id)
                        refresh()
                      }}
                    >
                      {done ? <Check className="h-4 w-4" /> : null}
                    </button>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setSelectedId(habit.id)
                        setParams({ id: habit.id })
                      }}
                    >
                      <h3 className="font-semibold">{habit.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {scheduleLabel}
                        {streak > 0 ? ` · ${streak} day${streak === 1 ? '' : 's'} in a row` : ''}
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
                  <Heatmap userId={userId} habitId={habit.id} />
                </li>
              )
            })}
          </ul>

          {selected ? (
            <aside className="kp-surface h-fit space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="kp-section-label">Edit</p>
                <ShareWithFriendsButton
                  kind="habit"
                  title={selected.title}
                  data={{ schedule: selected.schedule, localHabitId: selected.id }}
                />
              </div>
              <Input
                value={selected.title}
                onChange={(e) => {
                  habitsApi.update(userId, selected.id, { title: e.target.value })
                  refresh()
                }}
              />
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_CHIPS.map((chip) => (
                  <Button
                    key={chip.id}
                    type="button"
                    size="sm"
                    variant={selected.schedule === chip.id ? 'default' : 'outline'}
                    className="rounded-full"
                    onClick={() => {
                      habitsApi.update(userId, selected.id, { schedule: chip.id })
                      refresh()
                    }}
                  >
                    {chip.label}
                  </Button>
                ))}
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Reminder time</p>
                <Input
                  type="time"
                  value={selected.reminder_time || ''}
                  onChange={(e) => {
                    habitsApi.update(userId, selected.id, {
                      reminder_time: e.target.value || null,
                    })
                    refresh()
                  }}
                />
              </div>
            </aside>
          ) : null}
        </div>
      )}
    </motion.div>
  )
}
