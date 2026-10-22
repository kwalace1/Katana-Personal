import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
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
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { navSectionLabel } from '@/lib/nav'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { Segmented } from '@/components/ui/segmented'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CompleteToggle } from '@/components/CompleteToggle'
import { ShareAudiencePicker, type ShareAudienceSelection } from '@/components/ShareAudiencePicker'
import { ShareWithFriendsButton } from '@/components/ShareWithFriendsButton'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { formatShortDate, formatShortWhen, todayKey } from '@/lib/dates'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { cn } from '@/lib/utils'
import { shareSuccessMessage, shareWithAudience } from '@/lib/social/share-with-audience'
import { offerTaskCompleteShare, offerTaskCreatedShare } from '@/lib/social/share-win'
import { tasksApi } from '../api'
import { goalsApi } from '@/modules/goals/api'
import { EVENT_CATEGORIES, categoryColor, categoryLabel, type EventCategory } from '@/modules/calendar/categories'
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
        ) : null}
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
              if (value && task.status !== 'done') offerTaskCompleteShare(task.title)
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
          <p className="text-xs font-medium text-muted-foreground">Folder</p>
          <Select
            value={task.list_id || lists[0]?.id || ''}
            onValueChange={(v) => {
              tasksApi.updateTask(userId, task.id, { list_id: v })
              refresh()
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Folder" />
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
              const status = v as TaskStatus
              tasksApi.updateTask(userId, task.id, { status })
              if (status === 'done' && task.status !== 'done') offerTaskCompleteShare(task.title)
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
        <p className="text-xs font-medium text-muted-foreground">Category</p>
        <Select
          value={(EVENT_CATEGORIES.some((c) => c.id === task.category) ? task.category : 'personal') as EventCategory}
          onValueChange={(v) => {
            tasksApi.updateTask(userId, task.id, { category: v })
            refresh()
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_CATEGORIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  {c.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      <div className="space-y-1.5">
        <ShareWithFriendsButton
          kind="task"
          title={task.title}
          body={task.notes}
          data={{
            due_at: task.due_at,
            priority: task.priority,
            category: task.category || 'personal',
            recurrence: task.recurrence || 'none',
            localTaskId: task.id,
          }}
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
            <span className="mr-1 inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: categoryColor(task.category) }}
              />
              {categoryLabel(task.category)}
            </span>
            · {task.priority === 'high' ? 'Important' : task.priority === 'low' ? 'Whenever' : 'Normal'}
            {task.due_at ? ` · due ${formatShortWhen(task.due_at)}` : ''}
            {task.completed_at ? ` · done ${formatShortDate(task.completed_at)}` : ''}
            {overdue ? ' · Overdue' : ''}
            {task.recurrence !== 'none'
              ? ` · ${task.recurrence === 'daily' ? 'every day' : task.recurrence === 'weekly' ? 'every week' : 'every month'}`
              : ''}
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
  const { cloudUser, cloudProfile } = useCloudAuth()
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
  const [category, setCategory] = useState<EventCategory>('personal')
  const [shareFriends, setShareFriends] = useState<Record<string, boolean>>({})
  const [shareCircles, setShareCircles] = useState<Record<string, boolean>>({})
  const [shareAudience, setShareAudience] = useState<ShareAudienceSelection>({
    friendIds: [],
    circles: [],
    hasAny: false,
  })
  const onShareAudienceChange = useCallback((sel: ShareAudienceSelection) => {
    setShareAudience(sel)
  }, [])
  const [filter, setFilter] = useState<'open' | 'done' | 'all' | 'overdue'>(() => {
    const f = params.get('filter')
    return f === 'overdue' || f === 'done' || f === 'all' || f === 'open' ? f : 'open'
  })
  const [listId, setListId] = useState<string | 'all'>(() => {
    const id = params.get('list')
    return id && id !== 'all' ? id : 'all'
  })
  const [createFolderId, setCreateFolderId] = useState<string>('')
  const [newListName, setNewListName] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'))

  useEffect(() => {
    const id = params.get('id')
    if (id) setSelectedId(id)
    const list = params.get('list')
    if (list) setListId(list)
    const f = params.get('filter')
    if (f === 'overdue' || f === 'done' || f === 'all' || f === 'open') setFilter(f)
  }, [params])

  useEffect(() => {
    if (createFolderId && lists.some((l) => l.id === createFolderId)) return
    if (listId !== 'all' && lists.some((l) => l.id === listId)) {
      setCreateFolderId(listId)
      return
    }
    if (lists[0]?.id) setCreateFolderId(lists[0].id)
  }, [lists, listId, createFolderId])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (shareAudience.hasAny && shareAudience.circles.length > 0 && !dueAt) {
      toast.error('Set a due date if you want to share this to a circle calendar')
      return
    }
    const targetList = createFolderId || lists[0]?.id
    const dueIso = dueAt ? new Date(dueAt).toISOString() : null
    const task = tasksApi.createTask(userId, {
      title,
      priority,
      due_at: dueIso,
      recurrence,
      category,
      list_id: targetList || null,
    })

    if (shareAudience.hasAny && cloudUser) {
      try {
        const result = await shareWithAudience({
          kind: 'task',
          title: task.title,
          body: task.notes,
          data: {
            due_at: task.due_at,
            priority: task.priority,
            category: task.category,
            recurrence: task.recurrence || 'none',
            localTaskId: task.id,
          },
          ownerId: cloudUser.uid,
          friendIds: shareAudience.friendIds,
          circles: shareAudience.circles,
          activityFeed: cloudProfile?.sharePrefs?.activityFeed,
        })
        if (!result.ok) {
          toast.error(result.error)
        } else {
          toast.success(shareSuccessMessage(result))
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Task saved, but sharing failed')
      }
    }

    setTitle('')
    setDueAt('')
    setRecurrence('none')
    setPriority('medium')
    setCategory('personal')
    setShareFriends({})
    setShareCircles({})
    setShareAudience({ friendIds: [], circles: [], hasAny: false })
    setCreating(false)
    offerTaskCreatedShare(task.title)
    refresh()
  }

  function closeCreate() {
    setTitle('')
    setDueAt('')
    setRecurrence('none')
    setPriority('medium')
    setCategory('personal')
    setShareFriends({})
    setShareCircles({})
    setShareAudience({ friendIds: [], circles: [], hasAny: false })
    setCreating(false)
  }

  const overdue = tasks.filter((t) => t.status !== 'done' && t.due_at && t.due_at.slice(0, 10) < todayKey())
  const selectedList = listId === 'all' ? null : lists.find((l) => l.id === listId) || null
  const listed = listId === 'all' ? tasks : tasksApi.tasksOnList(userId, listId)

  const visible = listed.filter((t) => {
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
      <PageHeader
        dense
        title="Tasks"
        eyebrow={navSectionLabel('/tasks')}
        actions={
          tasks.length > 0 && !creating ? (
            <Button className="gap-2" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New task
            </Button>
          ) : null
        }
      />

      {tasks.length > 0 || lists.length > 1 || addingFolder ? (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterChip selected={listId === 'all'} onClick={() => setListId('all')}>
          All folders
        </FilterChip>
        {lists.map((list) => (
          <div key={list.id} className="flex items-center">
            <FilterChip
              selected={listId === list.id}
              className="gap-1.5 pr-1"
              onClick={() => {
                setListId(list.id)
                setCreateFolderId(list.id)
                setFilter('all')
              }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: list.color }} />
              {list.name}
              <span className="text-[0.65rem] opacity-70">{tasksApi.tasksOnList(userId, list.id).length}</span>
            </FilterChip>
            {lists.length > 1 ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground"
                aria-label={`Remove ${list.name}`}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Remove “${list.name}”? Tasks in this folder move to another folder.`,
                    )
                  ) {
                    return
                  }
                  const ok = tasksApi.deleteList(userId, list.id)
                  if (!ok) {
                    toast.error('Keep at least one folder')
                    return
                  }
                  if (listId === list.id) setListId('all')
                  toast.message(`Removed ${list.name}`)
                  refresh()
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ))}
        {addingFolder ? (
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newListName.trim()) return
              const list = tasksApi.createList(userId, newListName)
              setNewListName('')
              setAddingFolder(false)
              setListId(list.id)
              setCreateFolderId(list.id)
              setFilter('all')
              refresh()
            }}
          >
            <Input
              className="h-8 w-28"
              placeholder="New folder"
              value={newListName}
              autoFocus
              onChange={(e) => setNewListName(e.target.value)}
            />
            <Button type="submit" size="sm" variant="ghost" aria-label="Add folder">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => setAddingFolder(true)}>
            <Plus className="h-4 w-4" />
            Folder
          </Button>
        )}
      </div>
      ) : null}

      {creating ? (
      <form onSubmit={onCreate} className="kp-surface mb-3 space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">New task</p>
          <Button type="button" size="sm" variant="ghost" onClick={closeCreate}>
            Close
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add something…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 flex-1"
          />
          <Button type="submit" size="sm" className="h-9 gap-1.5 px-3" aria-label="Add task">
            <Plus className="h-4 w-4" />
            {shareAudience.hasAny ? 'Add & share' : 'Add'}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={cn('h-9 w-full', !dueAt && 'text-transparent')}
              aria-label="Set due date"
            />
            {!dueAt ? (
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                Due date
              </span>
            ) : null}
          </div>
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

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Folder</p>
            <Select value={createFolderId} onValueChange={setCreateFolderId}>
              <SelectTrigger className="!h-9 w-full">
                <SelectValue placeholder="Choose folder" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                      {l.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Priority</p>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="!h-9 w-full">
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
            <p className="text-xs font-medium text-muted-foreground">Category</p>
            <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
              <SelectTrigger className="!h-9 w-full">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      {c.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Repeat</p>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
              <SelectTrigger className="!h-9 w-full">
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

        <div className="flex flex-wrap items-center gap-2">
          {cloudUser ? (
            <ShareAudiencePicker
              uid={cloudUser.uid}
              selectedFriends={shareFriends}
              selectedCircles={shareCircles}
              onFriendsChange={setShareFriends}
              onCirclesChange={setShareCircles}
              onAudienceChange={onShareAudienceChange}
              compact
            />
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to="/settings">Connect to share</Link>
            </Button>
          )}
        </div>
      </form>
      ) : null}

      {tasks.length > 0 ? (
        <Segmented
          className="mb-3"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'open', label: 'Open' },
            { id: 'overdue', label: overdue.length ? `Overdue (${overdue.length})` : 'Overdue' },
            { id: 'done', label: 'Done' },
            { id: 'all', label: 'All' },
          ]}
        />
      ) : null}

      <div>
        {tasks.length === 0 && !creating ? (
          <div>
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
            <Button type="button" size="sm" className="mt-3 gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New task
            </Button>
          </div>
        ) : visible.length === 0 && !creating ? (
          <p className="text-sm text-muted-foreground">
            {selectedList ? `Nothing in ${selectedList.name}.` : 'Nothing here.'}
          </p>
        ) : visible.length === 0 ? null : (
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
                        offerTaskCompleteShare(task.title)
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
