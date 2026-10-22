import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { navSectionLabel } from '@/lib/nav'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { cn } from '@/lib/utils'
import { goalsApi } from '../api'
import { tasksApi } from '@/modules/tasks/api'
import { ShareWithFriendsButton } from '@/components/ShareWithFriendsButton'
import { burstConfetti } from '@/lib/celebrate'
import { offerGoalProgressShare } from '@/lib/social/share-win'
import type { GoalHorizon } from '../types'

const HORIZONS: GoalHorizon[] = ['annual', 'quarterly', 'monthly', 'daily']

function syncProgressFromTasks(userId: string, goalId: string) {
  const linked = tasksApi.forGoal(userId, goalId)
  if (linked.length === 0) return
  const goal = goalsApi.get(userId, goalId)
  const prev = goal?.progress ?? 0
  const done = linked.filter((t) => t.status === 'done').length
  const target = Math.max(linked.length * 10, 10)
  const progress = Math.round((done / linked.length) * target)
  goalsApi.update(userId, goalId, { target, progress })
  if (progress > prev) {
    if (prev < target && progress >= target) burstConfetti()
    offerGoalProgressShare({
      goalId,
      title: goal?.title || 'Goal',
      progress,
      target,
    })
  }
}

export default function GoalsPage() {
  const { user } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const [params, setParams] = useSearchParams()

  const goals = useMemo(() => {
    void tick
    return goalsApi.list(userId)
  }, [userId, tick])

  const roots = useMemo(() => goals.filter((g) => !g.parent_id), [goals])

  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [horizon, setHorizon] = useState<GoalHorizon>('monthly')
  const [targetDate, setTargetDate] = useState('')
  const [filter, setFilter] = useState<GoalHorizon | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'))
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('')

  useEffect(() => {
    const id = params.get('id')
    if (id) setSelectedId(id)
  }, [params])

  const selected = selectedId ? goals.find((g) => g.id === selectedId) ?? null : null
  const milestones = selected ? goalsApi.milestones(userId, selected.id) : []
  const linkedTasks = selected ? tasksApi.forGoal(userId, selected.id) : []

  useEffect(() => {
    setDescDraft(selected?.description ?? '')
    setTitleDraft(selected?.title ?? '')
  }, [selected?.id, selected?.description, selected?.title])
  const openTasks = useMemo(() => {
    void tick
    return tasksApi.listTasks(userId).filter((t) => t.status !== 'done' && !t.goal_id)
  }, [userId, tick])

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const goal = goalsApi.create(userId, {
      title,
      description,
      horizon,
      target_date: targetDate || null,
    })
    setTitle('')
    setDescription('')
    setTargetDate('')
    setHorizon('monthly')
    setCreating(false)
    setSelectedId(goal.id)
    setParams({ id: goal.id })
    refresh()
  }

  function cancelCreate() {
    setTitle('')
    setDescription('')
    setTargetDate('')
    setHorizon('monthly')
    setCreating(false)
  }

  const visible = roots.filter((g) => (filter === 'all' ? true : g.horizon === filter))
  const horizonCount = new Set(roots.map((goal) => goal.horizon)).size

  return (
    <motion.div {...pageEnterSubtle} className="kp-page !py-4 sm:!py-5">
      <PageHeader
        dense
        title="Goals"
        description="Where you’re headed — dated goals show on Calendar."
        eyebrow={navSectionLabel('/goals')}
        actions={
          roots.length > 0 && !creating ? (
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Add goal
            </Button>
          ) : null
        }
      />

      {creating ? (
        <form onSubmit={onCreate} className="kp-surface mb-3 space-y-2 p-3">
          <div className="flex gap-2">
            <Input
              className="h-9 flex-1"
              placeholder="Goal title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <Button type="submit" size="sm" className="h-9 gap-1.5 px-3" disabled={!title.trim()}>
              <Plus className="h-4 w-4" />
              Add goal
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_11rem]">
            <Input
              className="h-9"
              placeholder="Why this matters"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Select value={horizon} onValueChange={(v) => setHorizon(v as GoalHorizon)}>
              <SelectTrigger className="!h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HORIZONS.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-9"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              aria-label="Target date on calendar"
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={cancelCreate}>
            Cancel
          </Button>
        </form>
      ) : null}

      {roots.length === 0 && !creating ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No goals yet.</p>
          <Button type="button" size="sm" className="mt-3 gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Add goal
          </Button>
        </div>
      ) : null}

      {roots.length > 0 ? (
        <>
          {horizonCount > 1 ? (
            <Segmented
              className="mb-3"
              value={filter}
              onChange={setFilter}
              options={(['all', ...HORIZONS] as const).map((h) => ({ id: h, label: h }))}
            />
          ) : null}

          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">No {filter} goals.</p>
          ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
          <ul className="grid gap-2 sm:grid-cols-2">
            {visible.map((goal) => {
              const pct = Math.min(100, Math.round((goal.progress / Math.max(goal.target, 1)) * 100))
              return (
                <li key={goal.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedId === goal.id) {
                        setSelectedId(null)
                        setParams({})
                        return
                      }
                      setSelectedId(goal.id)
                      setParams({ id: goal.id })
                    }}
                    className={cn(
                      'kp-surface w-full p-3 text-left transition',
                      selectedId === goal.id && 'ring-2 ring-primary/30',
                    )}
                  >
                    <p className="kp-section-label">
                      {goal.horizon}
                      {goal.target_date ? ` · ${goal.target_date.slice(0, 10)}` : ''}
                    </p>
                    <h3 className="mt-1 font-semibold">{goal.title}</h3>
                    {goal.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{goal.description}</p>
                    ) : null}
                    <div className="mt-2">
                      <div className="mb-1 flex justify-between text-sm">
                        <span>Progress</span>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>

          {selected ? (
            <aside className="kp-surface h-fit space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="kp-section-label">Edit</p>
                <div className="flex gap-1">
                  <ShareWithFriendsButton
                    kind="goal"
                    title={selected.title}
                    body={selected.description}
                    data={{
                      progress: selected.progress,
                      target: selected.target,
                      horizon: selected.horizon,
                      localGoalId: selected.id,
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      goalsApi.remove(userId, selected.id)
                      setSelectedId(null)
                      setParams({})
                      refresh()
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Input
                value={titleDraft}
                onChange={(e) => {
                  const v = e.target.value
                  setTitleDraft(v)
                  goalsApi.update(userId, selected.id, { title: v })
                }}
                onBlur={() => refresh()}
              />
              <Textarea
                className="min-h-16"
                value={descDraft}
                onChange={(e) => {
                  const v = e.target.value
                  setDescDraft(v)
                  goalsApi.update(userId, selected.id, { description: v })
                }}
                onBlur={() => refresh()}
              />
              <Select
                value={selected.horizon}
                onValueChange={(v) => {
                  goalsApi.update(userId, selected.id, { horizon: v as GoalHorizon })
                  refresh()
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HORIZONS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Target date (shows on Calendar)</p>
                <Input
                  type="date"
                  value={selected.target_date?.slice(0, 10) || ''}
                  onChange={(e) => {
                    goalsApi.update(userId, selected.id, {
                      target_date: e.target.value || null,
                    })
                    refresh()
                  }}
                />
                {selected.target_date ? (
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to={`/calendar?date=${selected.target_date.slice(0, 10)}`}>View on calendar</Link>
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    goalsApi.update(userId, selected.id, {
                      progress: Math.max(0, selected.progress - 10),
                    })
                    refresh()
                  }}
                >
                  −10
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const prev = selected.progress
                    const next = Math.min(selected.target, selected.progress + 10)
                    goalsApi.update(userId, selected.id, { progress: next })
                    if (next > prev) {
                      if (prev < selected.target && next >= selected.target) burstConfetti()
                      offerGoalProgressShare({
                        goalId: selected.id,
                        title: selected.title,
                        progress: next,
                        target: selected.target,
                      })
                    }
                    refresh()
                  }}
                >
                  +10
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    syncProgressFromTasks(userId, selected.id)
                    refresh()
                  }}
                >
                  Sync from tasks
                </Button>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Milestones</p>
                <ul className="mb-2 divide-y border-t border-border">
                  {milestones.map((m) => (
                    <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{m.title}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          goalsApi.remove(userId, m.id)
                          refresh()
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!milestoneTitle.trim()) return
                    goalsApi.create(userId, {
                      title: milestoneTitle,
                      parent_id: selected.id,
                      horizon: selected.horizon,
                      target: 100,
                    })
                    setMilestoneTitle('')
                    refresh()
                  }}
                >
                  <Input
                    placeholder="Add milestone"
                    value={milestoneTitle}
                    onChange={(e) => setMilestoneTitle(e.target.value)}
                  />
                  <Button type="submit" size="icon" aria-label="Add milestone">
                    <Plus className="h-4 w-4" />
                  </Button>
                </form>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Linked tasks</p>
                <ul className="mb-2 divide-y border-t border-border">
                  {linkedTasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                      <Link to={`/tasks?id=${t.id}`} className={cn('hover:underline', t.status === 'done' && 'line-through')}>
                        {t.title}
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          tasksApi.updateTask(userId, t.id, { goal_id: null })
                          refresh()
                        }}
                      >
                        Unlink
                      </Button>
                    </li>
                  ))}
                </ul>
                {openTasks.length > 0 ? (
                  <Select
                    onValueChange={(taskId) => {
                      tasksApi.updateTask(userId, taskId, { goal_id: selected.id })
                      refresh()
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Link a task…" />
                    </SelectTrigger>
                    <SelectContent>
                      {openTasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground">No open unlinked tasks.</p>
                )}
              </div>
            </aside>
          ) : null}
        </div>
          )}
        </>
      ) : null}
    </motion.div>
  )
}
