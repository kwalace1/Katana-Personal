import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { CompleteToggle } from '@/components/CompleteToggle'
import { useAuth } from '@/contexts/AuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { formatShortDate, todayKey } from '@/lib/dates'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { cn } from '@/lib/utils'
import { tasksApi } from '../api'
import { goalsApi } from '@/modules/goals/api'
import { ShareWithFriendsButton } from '@/components/ShareWithFriendsButton'
import type { Recurrence, Task, TaskPriority, TaskStatus } from '../types'
import type { Goal } from '@/modules/goals/types'
import type { TaskList } from '../types'

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function TaskEditFields({
  task,
  userId,
  lists,
  goals,
  refresh,
}: {
  task: Task
  userId: string
  lists: TaskList[]
  goals: Goal[]
  refresh: () => void
}) {
  return (
    <div className="space-y-3 border-t border-border/60 px-3 pb-3 pt-3 sm:px-4">
      <p className="text-xs font-medium text-muted-foreground">Edit task</p>
      <Input
        value={task.title}
        onChange={(e) => {
          tasksApi.updateTask(userId, task.id, { title: e.target.value })
          refresh()
        }}
      />
      <Textarea
        placeholder="Notes"
        value={task.notes}
        onChange={(e) => {
          tasksApi.updateTask(userId, task.id, { notes: e.target.value })
          refresh()
        }}
      />
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Due date</p>
        <Input
          type="datetime-local"
          value={toLocalInput(task.due_at)}
          onChange={(e) => {
            tasksApi.updateTask(userId, task.id, {
              due_at: e.target.value ? new Date(e.target.value).toISOString() : null,
            })
            refresh()
          }}
        />
        {task.due_at ? (
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link to={`/calendar?date=${task.due_at.slice(0, 10)}`}>View on calendar</Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Set a due date to show this on Calendar.</p>
        )}
      </div>
      {task.status === 'done' || task.completed_at ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Completed on</p>
          <Input
            type="datetime-local"
            value={toLocalInput(task.completed_at)}
            onChange={(e) => {
              const value = e.target.value ? new Date(e.target.value).toISOString() : null
              tasksApi.updateTask(userId, task.id, {
                completed_at: value,
                ...(value && task.status !== 'done' ? { status: 'done' as const } : {}),
              })
              refresh()
            }}
          />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Priority</p>
          <Select
            value={task.priority}
            onValueChange={(v) => {
              tasksApi.updateTask(userId, task.id, { priority: v as TaskPriority })
              refresh()
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">Important</SelectItem>
              <SelectItem value="medium">Normal</SelectItem>
              <SelectItem value="low">Whenever</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Repeat</p>
          <Select
            value={task.recurrence}
            onValueChange={(v) => {
              tasksApi.updateTask(userId, task.id, { recurrence: v as Recurrence })
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
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">List</p>
          <Select
            value={task.list_id || lists[0]?.id || ''}
            onValueChange={(v) => {
              tasksApi.updateTask(userId, task.id, { list_id: v })
              refresh()
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="List" />
            </SelectTrigger>
            <SelectContent>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Status</p>
          <Select
            value={task.status}
            onValueChange={(v) => {
              tasksApi.updateTask(userId, task.id, { status: v as TaskStatus })
              refresh()
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To do</SelectItem>
              <SelectItem value="doing">Doing</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Linked goal</p>
        <Select
          value={task.goal_id || 'none'}
          onValueChange={(v) => {
            tasksApi.updateTask(userId, task.id, { goal_id: v === 'none' ? null : v })
            refresh()
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Goal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No linked goal</SelectItem>
            {goals.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs font-medium text-muted-foreground">Share with a circle or friends</p>
        <p className="text-xs text-muted-foreground">
          Send this task to everyone in a Circle, or pick individual friends. It shows up under Shared.
        </p>
        <ShareWithFriendsButton
          kind="task"
          title={task.title}
          body={task.notes}
          data={{ due_at: task.due_at, priority: task.priority, localTaskId: task.id }}
          label="Share with circle or friends"
          fullWidth
        />
      </div>
    </div>
  )
}

function SortableTask({
  task,
  expanded,
  onSelect,
  onToggle,
  onDelete,
  userId,
  lists,
  goals,
  refresh,
}: {
  task: Task
  expanded: boolean
  onSelect: () => void
  onToggle: () => void
  onDelete: () => void
  userId: string
  lists: TaskList[]
  goals: Goal[]
  refresh: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const overdue = task.due_at && task.status !== 'done' && task.due_at.slice(0, 10) < todayKey()

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'kp-surface overflow-hidden p-0',
        task.status === 'done' && 'opacity-80',
        expanded && 'ring-2 ring-primary/30',
        isDragging && 'z-10 opacity-90 shadow-lg',
        overdue && 'border-destructive/30',
      )}
    >
      <div className="flex items-start gap-2 p-3 sm:p-4">
        <button
          type="button"
          className="mt-2 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <CompleteToggle
          done={task.status === 'done'}
          onToggle={onToggle}
          openLabel="To do"
          doneLabel="Done"
          celebrateMessage="Done"
        />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
          <div className="flex items-start justify-between gap-2">
            <p className={cn('font-medium', task.status === 'done' && 'line-through')}>{task.title}</p>
            <ChevronDown
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition',
                expanded && 'rotate-180',
              )}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {task.priority === 'high' ? 'Important' : task.priority === 'low' ? 'Whenever' : 'Normal'}
            {task.due_at ? ` · due ${formatShortDate(task.due_at)}` : ''}
            {task.completed_at ? ` · done ${formatShortDate(task.completed_at)}` : ''}
            {overdue ? ' · Overdue' : ''}
            {task.recurrence !== 'none'
              ? ` · ${task.recurrence === 'daily' ? 'every day' : task.recurrence === 'weekly' ? 'every week' : 'every month'}`
              : ''}
            <span className="text-primary/80"> · {expanded ? 'Hide edit' : 'Tap to edit'}</span>
          </p>
        </button>
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete task">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TaskEditFields task={task} userId={userId} lists={lists} goals={goals} refresh={refresh} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  )
}

export default function TasksPage() {
  const { user } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const [params, setParams] = useSearchParams()

  const lists = useMemo(() => {
    void tick
    return tasksApi.listLists(userId)
  }, [userId, tick])

  const goals = useMemo(() => {
    void tick
    return goalsApi.roots(userId)
  }, [userId, tick])

  const tasks = useMemo(() => {
    void tick
    return tasksApi.listTasks(userId)
  }, [userId, tick])

  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueAt, setDueAt] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>('none')
  const [filter, setFilter] = useState<'open' | 'done' | 'all' | 'overdue'>(() => {
    const f = params.get('filter')
    return f === 'overdue' || f === 'done' || f === 'all' || f === 'open' ? f : 'open'
  })
  const [listId, setListId] = useState<string | 'all'>('all')
  const [newListName, setNewListName] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'))

  useEffect(() => {
    const id = params.get('id')
    if (id) setSelectedId(id)
    const f = params.get('filter')
    if (f === 'overdue' || f === 'done' || f === 'all' || f === 'open') setFilter(f)
  }, [params])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const targetList = listId === 'all' ? lists[0]?.id : listId
    const task = tasksApi.createTask(userId, {
      title,
      priority,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      recurrence,
      list_id: targetList || null,
    })
    setTitle('')
    setDueAt('')
    setRecurrence('none')
    setPriority('medium')
    setSelectedId(task.id)
    setParams({ id: task.id })
    refresh()
  }

  const overdue = tasks.filter((t) => t.status !== 'done' && t.due_at && t.due_at.slice(0, 10) < todayKey())

  const visible = tasks.filter((t) => {
    if (listId !== 'all' && t.list_id !== listId) return false
    if (filter === 'open') return t.status !== 'done'
    if (filter === 'done') return t.status === 'done'
    if (filter === 'overdue') return t.status !== 'done' && !!t.due_at && t.due_at.slice(0, 10) < todayKey()
    return true
  })

  const openIds = visible.filter((t) => t.status !== 'done').map((t) => t.id)

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = openIds.indexOf(String(active.id))
    const newIndex = openIds.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(openIds, oldIndex, newIndex)
    tasksApi.reorder(userId, next)
    refresh()
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader title="Tasks" description="What needs attention — dated tasks show on Calendar." eyebrow="Plan" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={listId === 'all' ? 'default' : 'outline'}
          className="rounded-full"
          onClick={() => setListId('all')}
        >
          All lists
        </Button>
        {lists.map((list) => (
          <Button
            key={list.id}
            size="sm"
            variant={listId === list.id ? 'default' : 'outline'}
            className="rounded-full gap-1.5"
            onClick={() => setListId(list.id)}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: list.color }} />
            {list.name}
          </Button>
        ))}
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newListName.trim()) return
            const list = tasksApi.createList(userId, newListName)
            setNewListName('')
            setListId(list.id)
            refresh()
          }}
        >
          <Input
            className="h-8 w-28"
            placeholder="New list"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
          />
          <Button type="submit" size="sm" variant="ghost" aria-label="Add list">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <form onSubmit={onCreate} className="kp-surface mb-6 space-y-4 p-4 sm:p-5">
        <div className="flex gap-2">
          <Input
            placeholder="Add something…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" aria-label="Add">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Due date</p>
          <div className="relative">
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={cn('w-full min-h-11', !dueAt && 'text-transparent')}
              aria-label="Set due date"
            />
            {!dueAt ? (
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                Set due date here
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                const d = new Date()
                d.setHours(9, 0, 0, 0)
                const pad = (n: number) => String(n).padStart(2, '0')
                setDueAt(
                  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
                )
              }}
            >
              Today
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() + 1)
                d.setHours(9, 0, 0, 0)
                const pad = (n: number) => String(n).padStart(2, '0')
                setDueAt(
                  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
                )
              }}
            >
              Tomorrow
            </Button>
            {dueAt ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-full text-muted-foreground"
                onClick={() => setDueAt('')}
              >
                Clear
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {dueAt ? 'This task will show on your calendar.' : 'Optional — add a date to place it on the calendar.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Priority</p>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="min-h-11">
                <SelectValue placeholder="Choose priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Important</SelectItem>
                <SelectItem value="medium">Normal</SelectItem>
                <SelectItem value="low">Whenever</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Repeat</p>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
              <SelectTrigger className="min-h-11">
                <SelectValue placeholder="Does it repeat?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Once</SelectItem>
                <SelectItem value="daily">Every day</SelectItem>
                <SelectItem value="weekly">Every week</SelectItem>
                <SelectItem value="monthly">Every month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['open', 'Open'],
            ['overdue', `Overdue${overdue.length ? ` (${overdue.length})` : ''}`],
            ['done', 'Done'],
            ['all', 'All'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div>
        {visible.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description="Add a task above — or ask Katana what to work on."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline">
                  <Link to="/ask?q=What%20should%20I%20work%20on%20today%3F">Ask for focus</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/settings">Load demo day</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={openIds} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {visible.map((task) =>
                  task.status === 'done' ? (
                    <li
                      key={task.id}
                      className={cn(
                        'kp-surface overflow-hidden p-0 opacity-80',
                        selectedId === task.id && 'ring-2 ring-primary/30',
                      )}
                    >
                      <div className="flex items-center gap-3 p-3 sm:p-4">
                        <CompleteToggle
                          done
                          onToggle={() => {
                            tasksApi.updateTask(userId, task.id, { status: 'todo', completed_at: null })
                            refresh()
                          }}
                          openLabel="To do"
                          doneLabel="Done"
                        />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            setSelectedId((id) => (id === task.id ? null : task.id))
                            setParams(selectedId === task.id ? {} : { id: task.id })
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium line-through">{task.title}</p>
                            <ChevronDown
                              className={cn(
                                'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition',
                                selectedId === task.id && 'rotate-180',
                              )}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {task.completed_at ? `Completed ${formatShortDate(task.completed_at)}` : 'Completed'}
                            <span className="text-primary/80">
                              {' '}
                              · {selectedId === task.id ? 'Hide edit' : 'Tap to edit'}
                            </span>
                          </p>
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            tasksApi.deleteTask(userId, task.id)
                            if (selectedId === task.id) setSelectedId(null)
                            refresh()
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <AnimatePresence initial={false}>
                        {selectedId === task.id ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <TaskEditFields
                              task={task}
                              userId={userId}
                              lists={lists}
                              goals={goals}
                              refresh={refresh}
                            />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </li>
                  ) : (
                    <SortableTask
                      key={task.id}
                      task={task}
                      expanded={selectedId === task.id}
                      userId={userId}
                      lists={lists}
                      goals={goals}
                      refresh={refresh}
                      onSelect={() => {
                        if (selectedId === task.id) {
                          setSelectedId(null)
                          setParams({})
                        } else {
                          setSelectedId(task.id)
                          setParams({ id: task.id })
                        }
                      }}
                      onToggle={() => {
                        tasksApi.completeTask(userId, task.id)
                        refresh()
                      }}
                      onDelete={() => {
                        tasksApi.deleteTask(userId, task.id)
                        if (selectedId === task.id) setSelectedId(null)
                        refresh()
                      }}
                    />
                  ),
                )}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </motion.div>
  )
}
