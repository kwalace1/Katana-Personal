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
import { Input } from '@/components/ui/input'
import { parseCapture, commitCapture } from '@/lib/capture'
import { todayKey } from '@/lib/dates'
import { offerEventCreatedShare, offerTaskCreatedShare } from '@/lib/social/share-win'
import { cn } from '@/lib/utils'
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

type Props = {
  userId: string
  onCreated: () => void
}

export function TodayQuickCreate({ userId, onCreated }: Props) {
  const navigate = useNavigate()
  const [kind, setKind] = useState<CreateKind>('task')
  const [title, setTitle] = useState('')

  const preview = useMemo(() => {
    const t = title.trim()
    if (!t) return null
    if (kind === 'task' || kind === 'event' || kind === 'note') {
      const raw = kind === 'note' ? `# ${t}` : kind === 'event' ? `@ ${t}` : t
      return parseCapture(raw)?.summary ?? null
    }
    return null
  }, [kind, title])

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
      onCreated()
      return
    }

    if (kind === 'habit') {
      const habit = habitsApi.create(userId, { title: t, schedule: 'daily' })
      toast.success('Habit added')
      setTitle('')
      onCreated()
      navigate(`/habits?id=${habit.id}`)
      return
    }

    if (kind === 'journal') {
      journalApi.upsert(userId, { mood: 'okay', body: t })
      toast.success('Journal updated')
      setTitle('')
      onCreated()
      navigate(`/journal?date=${todayKey()}`)
      return
    }

    if (kind === 'goal') {
      const goal = goalsApi.create(userId, { title: t })
      toast.success('Goal added')
      setTitle('')
      onCreated()
      navigate(`/goals?id=${goal.id}`)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-5 kp-surface p-4 sm:p-5">
      <p className="kp-section-label">Create</p>
      <p className="mt-1 font-display text-xl tracking-tight sm:text-2xl">What do you want to create?</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {KINDS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            className={cn(
              'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition',
              kind === id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/70 text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={PLACEHOLDERS[kind]}
          aria-label={`New ${kind}`}
          className="min-h-11 flex-1"
        />
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0" aria-label="Create" disabled={!title.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {preview && title.trim() ? (
        <p className="mt-2 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
          Will create: {preview}
        </p>
      ) : kind === 'task' || kind === 'event' ? (
        <p className="mt-2 px-0.5 text-[0.7rem] text-muted-foreground">
          Tip: tomorrow · fri · 3pm · ! priority
        </p>
      ) : null}
    </form>
  )
}
