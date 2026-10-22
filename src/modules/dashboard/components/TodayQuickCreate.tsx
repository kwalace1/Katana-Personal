import { FormEvent, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  Flame,
  NotebookPen,
  Plus,
  Target,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { parseCapture, commitCapture } from '@/lib/capture'
import { todayKey } from '@/lib/dates'
import { offerEventCreatedShare, offerTaskCreatedShare } from '@/lib/social/share-win'
import { calendarApi } from '@/modules/calendar/api'
import { goalsApi } from '@/modules/goals/api'
import { habitsApi } from '@/modules/habits/api'
import { journalApi } from '@/modules/journal/api'
import { notesApi } from '@/modules/notes/api'
import { tasksApi } from '@/modules/tasks/api'

export type CreateKind = 'task' | 'event' | 'note' | 'habit' | 'journal' | 'goal'

const KINDS: { id: CreateKind; label: string; Icon: typeof CheckSquare }[] = [
  { id: 'task', label: 'Task', Icon: CheckSquare },
  { id: 'event', label: 'Event', Icon: CalendarDays },
  { id: 'note', label: 'Note', Icon: NotebookPen },
  { id: 'habit', label: 'Habit', Icon: Flame },
  { id: 'journal', label: 'Journal', Icon: BookOpen },
  { id: 'goal', label: 'Goal', Icon: Target },
]

const PLACEHOLDERS: Record<CreateKind, string> = {
  task: 'Call Mom Friday 3pm',
  event: 'Dentist tomorrow 10am',
  note: 'Idea for the week…',
  habit: 'A habit worth keeping…',
  journal: 'One line about today…',
  goal: 'What you’re aiming for…',
}

const HINTS: Record<CreateKind, string> = {
  task: 'Tomorrow, Friday, 3pm, and ! for priority all work.',
  event: 'Tomorrow, Friday, and 3pm all work.',
  note: 'A title is enough. Open it afterward to write more.',
  habit: 'Starts as a daily habit.',
  journal: 'One line lands in today’s journal.',
  goal: 'Name what you’re aiming for.',
}

type Props = {
  userId: string
  onCreated: () => void
}

export function TodayQuickCreate({ userId, onCreated }: Props) {
  const navigate = useNavigate()
  const [kind, setKind] = useState<CreateKind>('task')
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState(false)

  const kindMeta = KINDS.find((item) => item.id === kind) ?? KINDS[0]

  const preview = useMemo(() => {
    const t = title.trim()
    if (!t) return null
    if (kind === 'task' || kind === 'event' || kind === 'note') {
      const raw = kind === 'note' ? `# ${t}` : kind === 'event' ? `@ ${t}` : t
      return parseCapture(raw)?.summary ?? null
    }
    return null
  }, [kind, title])

  function openComposer(next: CreateKind) {
    setKind(next)
    setTitle('')
    window.setTimeout(() => setOpen(true), 0)
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setTitle('')
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return

    if (kind === 'task' || kind === 'event' || kind === 'note') {
      const raw = kind === 'note' ? `# ${t}` : kind === 'event' ? `@ ${t}` : t
      const draft = parseCapture(raw)
      if (!draft) return
      const result = commitCapture(userId, draft)
      if (result.kind === 'task') offerTaskCreatedShare(result.title)
      else if (result.kind === 'event') offerEventCreatedShare(result.title, result.summary)
      toast.success(result.summary, {
        action: {
          label: 'Open',
          onClick: () => {
            navigate(result.to)
          },
        },
        cancel: {
          label: 'Undo',
          onClick: () => {
            if (result.kind === 'task') tasksApi.deleteTask(userId, result.id)
            else if (result.kind === 'note') notesApi.deleteNote(userId, result.id)
            else calendarApi.remove(userId, result.id)
            onCreated()
            toast.message('Undone')
          },
        },
      })
      setTitle('')
      setOpen(false)
      onCreated()
      return
    }

    if (kind === 'habit') {
      const habit = habitsApi.create(userId, { title: t, schedule: 'daily' })
      toast.success('Habit added')
      setTitle('')
      setOpen(false)
      onCreated()
      navigate(`/habits?id=${habit.id}`)
      return
    }

    if (kind === 'journal') {
      journalApi.upsert(userId, { mood: 'okay', body: t })
      toast.success('Journal updated')
      setTitle('')
      setOpen(false)
      onCreated()
      navigate(`/journal?date=${todayKey()}`)
      return
    }

    if (kind === 'goal') {
      const goal = goalsApi.create(userId, { title: t })
      toast.success('Goal added')
      setTitle('')
      setOpen(false)
      onCreated()
      navigate(`/goals?id=${goal.id}`)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="Create">
            <Plus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {KINDS.map(({ id, label, Icon }) => (
            <DropdownMenuItem
              key={id}
              className="min-h-11 gap-2"
              onSelect={() => openComposer(id)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>New {kindMeta.label.toLowerCase()}</DialogTitle>
            <DialogDescription>{HINTS[kind]}</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={PLACEHOLDERS[kind]}
              aria-label={`New ${kind}`}
              className="min-h-11"
              autoFocus
            />
            {preview && title.trim() ? (
              <p className="text-xs font-medium text-primary">Will create: {preview}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={!title.trim()}>
              Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
