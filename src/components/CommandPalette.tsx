import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  CheckSquare,
  FileText,
  Flame,
  NotebookPen,
  Plus,
  Search,
  Target,
  BookOpen,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useAuth } from '@/contexts/AuthContext'
import { searchWorkspace, type SearchHit } from '@/lib/search'
import { tasksApi } from '@/modules/tasks/api'
import { notesApi } from '@/modules/notes/api'
import { calendarApi } from '@/modules/calendar/api'
import { todayKey } from '@/lib/dates'
import { toast } from 'sonner'

const KIND_ICON: Record<SearchHit['kind'], React.ComponentType<{ className?: string }>> = {
  task: CheckSquare,
  note: NotebookPen,
  event: CalendarDays,
  goal: Target,
  habit: Flame,
  journal: BookOpen,
  file: FileText,
  nav: Search,
}

export function CommandPalette({
  open: controlledOpen,
  onOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
} = {}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [internalOpen, setInternalOpen] = useState(false)
  const [query, setQuery] = useState('')

  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!(controlledOpen ?? internalOpen))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [controlledOpen, internalOpen, setOpen])

  const hits = useMemo(() => {
    if (!user) return []
    return searchWorkspace(user.id, query)
  }, [user, query])

  function go(to: string) {
    setOpen(false)
    setQuery('')
    navigate(to)
  }

  function createTask(title: string) {
    if (!user) return
    const lists = tasksApi.listLists(user.id)
    const task = tasksApi.createTask(user.id, {
      title: title || 'New task',
      list_id: lists[0]?.id ?? null,
      due_at: new Date().toISOString(),
    })
    toast.success('Task added')
    go(`/tasks?id=${task.id}`)
  }

  function createNote(title: string) {
    if (!user) return
    const note = notesApi.createNote(user.id, { title: title || 'Untitled' })
    toast.success('Note created')
    go(`/notes?id=${note.id}`)
  }

  function createEvent(title: string) {
    if (!user) return
    const start = new Date()
    start.setMinutes(0, 0, 0)
    start.setHours(start.getHours() + 1)
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    const event = calendarApi.create(user.id, {
      title: title || 'New event',
      notes: '',
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: false,
      location: '',
      recurrence: 'none',
      reminder_minutes: 30,
    })
    toast.success('Event added')
    go(`/calendar?date=${todayKey()}&id=${event.id}`)
  }

  const createLabel = query.trim() || 'Untitled'

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setQuery('')
      }}
      title="Search"
      description="Find anything in your workspace"
      showCloseButton={false}
    >
      <CommandInput placeholder="Search or create…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nothing matched.</CommandEmpty>
        <CommandGroup heading="Create">
          <CommandItem onSelect={() => createTask(createLabel)}>
            <Plus className="h-4 w-4" />
            New task{query.trim() ? `: ${createLabel}` : ''}
          </CommandItem>
          <CommandItem onSelect={() => createNote(createLabel)}>
            <Plus className="h-4 w-4" />
            New note{query.trim() ? `: ${createLabel}` : ''}
          </CommandItem>
          <CommandItem onSelect={() => createEvent(createLabel)}>
            <Plus className="h-4 w-4" />
            New event{query.trim() ? `: ${createLabel}` : ''}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={query.trim() ? 'Results' : 'Go to'}>
          {hits.map((hit) => {
            const Icon = KIND_ICON[hit.kind]
            return (
              <CommandItem
                key={hit.id}
                value={`${hit.kind} ${hit.title} ${hit.subtitle || ''}`}
                onSelect={() => go(hit.to)}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{hit.title}</span>
                {hit.subtitle ? (
                  <span className="ml-auto truncate text-xs text-muted-foreground">{hit.subtitle}</span>
                ) : null}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
