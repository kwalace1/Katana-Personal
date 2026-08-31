import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, FolderPlus, Plus, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { CompleteToggle } from '@/components/CompleteToggle'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { todayKey } from '@/lib/dates'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { cn } from '@/lib/utils'
import { habitsApi } from '../api'
import { tasksApi } from '@/modules/tasks/api'
import { ShareWithFriendsButton } from '@/components/ShareWithFriendsButton'
import { offerHabitCheckedInShare } from '@/lib/social/share-win'
import {
  WEEKDAY_OPTIONS,
  formatHabitSchedule,
  formatReminderClock,
  normalizeReminderTimes,
  parseReminderClock,
  reminderTimesOf,
  type HabitSchedule,
  type Weekday,
  type HabitFolder,
} from '../types'

const REMINDER_PRESETS: { label: string; time: string }[] = [
  { label: 'Morning', time: '08:00' },
  { label: 'Midday', time: '13:00' },
  { label: 'Evening', time: '18:00' },
]

const SCHEDULE_CHIPS: { id: HabitSchedule; label: string }[] = [
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekends', label: 'Weekends' },
  { id: 'custom', label: 'Custom days' },
  { id: 'once', label: 'One time' },
]

function ReminderTimesPicker({
  times,
  nudgeUntilDone,
  onTimes,
  onNudge,
}: {
  times: string[]
  nudgeUntilDone: boolean
  onTimes: (times: string[]) => void
  onNudge: (value: boolean) => void
}) {
  const [draft, setDraft] = useState('')

  function addTime(raw: string) {
    const parsed = parseReminderClock(raw)
    if (!parsed) return
    onTimes(normalizeReminderTimes([...times, formatReminderClock(parsed.hh, parsed.mm)]))
    setDraft('')
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Reminders through the day</p>
      {times.length === 0 ? (
        <p className="text-xs text-muted-foreground">No pings yet. Add a time, or tap a preset.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {times.map((time) => (
            <span
              key={time}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm"
            >
              {time}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${time} reminder`}
                onClick={() => onTimes(times.filter((t) => t !== time))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {REMINDER_PRESETS.map((preset) => {
          const on = times.includes(preset.time)
          return (
            <Button
              key={preset.time}
              type="button"
              size="sm"
              variant={on ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => {
                if (on) onTimes(times.filter((t) => t !== preset.time))
                else onTimes(normalizeReminderTimes([...times, preset.time]))
              }}
            >
              {preset.label}
            </Button>
          )
        })}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (draft) addTime(draft)
        }}
      >
        <Input
          type="time"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="max-w-[9rem]"
          aria-label="Add reminder time"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!draft}>
          Add time
        </Button>
      </form>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Keep reminding until I check in</p>
          <p className="text-xs text-muted-foreground">
            Extra pings every few hours after the first reminder, stopping once this habit is done.
          </p>
        </div>
        <Switch checked={nudgeUntilDone} onCheckedChange={onNudge} disabled={times.length === 0} />
      </div>
    </div>
  )
}

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

  const folders = useMemo(() => {
    void tick
    return habitsApi.listFolders(userId)
  }, [userId, tick])

  const dueIds = useMemo(() => new Set(habitsApi.dueToday(userId).map((h) => h.id)), [userId, tick])

  const [title, setTitle] = useState('')
  const [schedule, setSchedule] = useState<HabitSchedule>('daily')
  const [customDays, setCustomDays] = useState<Weekday[]>([1, 2, 3, 4, 5])
  const [onceDate, setOnceDate] = useState(todayKey())
  const [filter, setFilter] = useState<'all' | 'due'>('due')
  const [folderId, setFolderId] = useState<string | 'all' | 'none'>('all')
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'))
  const [habitTaskTitle, setHabitTaskTitle] = useState('')

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
      folder_id: folderId !== 'all' && folderId !== 'none' ? folderId : null,
    })
    setTitle('')
    setSchedule('daily')
    setCustomDays([1, 2, 3, 4, 5])
    setOnceDate(todayKey())
    setSelectedId(habit.id)
    setParams({ id: habit.id })
    refresh()
  }

  const visible = habits.filter((h) => {
    if (filter === 'due' && !dueIds.has(h.id)) return false
    if (folderId === 'none') return !h.folder_id
    if (folderId !== 'all') return h.folder_id === folderId
    return true
  })

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        title="Habits"
        description="Pick the days that fit — and as many reminder times as you want."
        eyebrow="Life"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={folderId === 'all' ? 'default' : 'outline'}
          className="rounded-full"
          onClick={() => setFolderId('all')}
        >
          All folders
        </Button>
        <Button
          size="sm"
          variant={folderId === 'none' ? 'default' : 'outline'}
          className="rounded-full"
          onClick={() => setFolderId('none')}
        >
          Unfiled
        </Button>
        {folders.map((folder: HabitFolder) => (
          <div key={folder.id} className="flex items-center">
            <Button
              size="sm"
              variant={folderId === folder.id ? 'default' : 'outline'}
              className="rounded-full gap-1.5 pr-1"
              onClick={() => setFolderId(folder.id)}
            >
              {folder.name}
              <span className="text-[0.65rem] opacity-70">
                {habitsApi.habitsInFolder(userId, folder.id).length}
              </span>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              aria-label={`Remove ${folder.name}`}
              onClick={() => {
                if (
                  !window.confirm(
                    `Remove “${folder.name}”? Habits in this folder become unfiled.`,
                  )
                ) {
                  return
                }
                habitsApi.deleteFolder(userId, folder.id)
                if (folderId === folder.id) setFolderId('all')
                refresh()
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newFolderName.trim()) return
            const folder = habitsApi.createFolder(userId, newFolderName)
            setNewFolderName('')
            setFolderId(folder.id)
            refresh()
          }}
        >
          <Input
            className="h-8 w-28"
            placeholder="New folder"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
          />
          <Button type="submit" size="sm" variant="ghost" aria-label="Add folder">
            <FolderPlus className="h-4 w-4" />
          </Button>
        </form>
      </div>

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
              const linkedTasks = tasksApi.forHabit(userId, habit.id)
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
                      celebrateMessage="Checked in"
                      onToggle={() => {
                        const wasDone = habitsApi.isDoneToday(userId, habit.id)
                        habitsApi.toggleToday(userId, habit.id)
                        const nowDone = habitsApi.isDoneToday(userId, habit.id)
                        if (!wasDone && nowDone) {
                          offerHabitCheckedInShare(habit.title, habitsApi.streak(userId, habit.id))
                        }
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
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Folder</p>
                            <Select
                              value={habit.folder_id || 'none'}
                              onValueChange={(v) => {
                                habitsApi.update(userId, habit.id, {
                                  folder_id: v === 'none' ? null : v,
                                })
                                refresh()
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Folder" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Unfiled</SelectItem>
                                {folders.map((folder) => (
                                  <SelectItem key={folder.id} value={folder.id}>
                                    {folder.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
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
                          <ReminderTimesPicker
                            times={reminderTimesOf(habit)}
                            nudgeUntilDone={habit.nudge_until_done !== false}
                            onTimes={(times) => {
                              habitsApi.update(userId, habit.id, {
                                reminder_times: times,
                                reminder_time: times[0] ?? null,
                              })
                              refresh()
                            }}
                            onNudge={(value) => {
                              habitsApi.update(userId, habit.id, { nudge_until_done: value })
                              refresh()
                            }}
                          />
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Associated tasks</p>
                            {linkedTasks.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                No tasks on this habit yet. Add one below.
                              </p>
                            ) : (
                              <ul className="space-y-1.5">
                                {linkedTasks.map((task) => (
                                  <li
                                    key={task.id}
                                    className="flex items-center gap-2 rounded-xl bg-secondary/40 px-2.5 py-2"
                                  >
                                    <CompleteToggle
                                      done={task.status === 'done'}
                                      openLabel="To do"
                                      doneLabel="Done"
                                      onToggle={() => {
                                        if (task.status === 'done') {
                                          tasksApi.updateTask(userId, task.id, {
                                            status: 'todo',
                                            completed_at: null,
                                          })
                                        } else {
                                          tasksApi.completeTask(userId, task.id)
                                        }
                                        refresh()
                                      }}
                                    />
                                    <Link
                                      to={`/tasks?id=${task.id}`}
                                      className={cn(
                                        'min-w-0 flex-1 text-sm font-medium hover:underline',
                                        task.status === 'done' && 'text-muted-foreground line-through',
                                      )}
                                    >
                                      {task.title}
                                    </Link>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      aria-label={`Remove ${task.title}`}
                                      onClick={() => {
                                        tasksApi.updateTask(userId, task.id, { habit_id: null })
                                        refresh()
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <form
                              className="flex gap-2"
                              onSubmit={(e) => {
                                e.preventDefault()
                                if (!habitTaskTitle.trim()) return
                                tasksApi.createTask(userId, {
                                  title: habitTaskTitle,
                                  habit_id: habit.id,
                                })
                                setHabitTaskTitle('')
                                refresh()
                              }}
                            >
                              <Input
                                placeholder="Add a task for this habit…"
                                value={habitTaskTitle}
                                onChange={(e) => setHabitTaskTitle(e.target.value)}
                              />
                              <Button type="submit" size="icon" aria-label="Add task">
                                <Plus className="h-4 w-4" />
                              </Button>
                            </form>
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
