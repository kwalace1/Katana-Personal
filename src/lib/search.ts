import { tasksApi } from '@/modules/tasks/api'
import { calendarApi } from '@/modules/calendar/api'
import { habitsApi } from '@/modules/habits/api'
import { goalsApi } from '@/modules/goals/api'
import { journalApi } from '@/modules/journal/api'
import { notesApi } from '@/modules/notes/api'
import { documentsApi } from '@/modules/documents/api'
import { formatShortDate, formatTime } from '@/lib/dates'

export type SearchKind = 'task' | 'note' | 'event' | 'goal' | 'habit' | 'journal' | 'file' | 'nav'

export interface SearchHit {
  id: string
  kind: SearchKind
  title: string
  subtitle?: string
  to: string
}

const NAV: SearchHit[] = [
  { id: 'nav-today', kind: 'nav', title: 'Today', to: '/dashboard' },
  { id: 'nav-ask', kind: 'nav', title: 'Ask', to: '/ask' },
  { id: 'nav-tasks', kind: 'nav', title: 'Tasks', to: '/tasks' },
  { id: 'nav-calendar', kind: 'nav', title: 'Calendar', to: '/calendar' },
  { id: 'nav-goals', kind: 'nav', title: 'Goals', to: '/goals' },
  { id: 'nav-habits', kind: 'nav', title: 'Habits', to: '/habits' },
  { id: 'nav-journal', kind: 'nav', title: 'Journal', to: '/journal' },
  { id: 'nav-health', kind: 'nav', title: 'Health', to: '/health' },
  { id: 'nav-notes', kind: 'nav', title: 'Notes', to: '/notes' },
  { id: 'nav-files', kind: 'nav', title: 'Files', to: '/documents' },
  { id: 'nav-friends', kind: 'nav', title: 'Friends', to: '/friends' },
  { id: 'nav-shared', kind: 'nav', title: 'Shared', to: '/shared' },
  { id: 'nav-circles', kind: 'nav', title: 'Circles', to: '/circles' },
  { id: 'nav-settings', kind: 'nav', title: 'Settings', to: '/settings' },
]

export function searchWorkspace(userId: string, query: string, limit = 24): SearchHit[] {
  const q = query.trim().toLowerCase()
  const hits: SearchHit[] = []

  if (!q) {
    return NAV.slice(0, 8)
  }

  for (const nav of NAV) {
    if (nav.title.toLowerCase().includes(q)) hits.push(nav)
  }

  for (const task of tasksApi.listTasks(userId)) {
    if (task.title.toLowerCase().includes(q) || task.notes.toLowerCase().includes(q)) {
      hits.push({
        id: `task-${task.id}`,
        kind: 'task',
        title: task.title,
        subtitle: task.status === 'done' ? 'Done' : task.due_at ? `Due ${formatShortDate(task.due_at)}` : 'Task',
        to: `/tasks?id=${task.id}`,
      })
    }
  }

  for (const note of notesApi.listNotes(userId)) {
    if (
      note.title.toLowerCase().includes(q) ||
      note.body.toLowerCase().includes(q) ||
      note.tags.some((t) => t.toLowerCase().includes(q))
    ) {
      hits.push({
        id: `note-${note.id}`,
        kind: 'note',
        title: note.title,
        subtitle: note.pinned ? 'Pinned note' : 'Note',
        to: `/notes?id=${note.id}`,
      })
    }
  }

  for (const event of calendarApi.list(userId)) {
    if (event.title.toLowerCase().includes(q) || event.notes.toLowerCase().includes(q) || event.location.toLowerCase().includes(q)) {
      hits.push({
        id: `event-${event.id}`,
        kind: 'event',
        title: event.title,
        subtitle: event.all_day ? formatShortDate(event.starts_at) : `${formatShortDate(event.starts_at)} · ${formatTime(event.starts_at)}`,
        to: `/calendar?date=${event.starts_at.slice(0, 10)}&id=${event.id}`,
      })
    }
  }

  for (const goal of goalsApi.list(userId)) {
    if (goal.title.toLowerCase().includes(q) || goal.description.toLowerCase().includes(q)) {
      hits.push({
        id: `goal-${goal.id}`,
        kind: 'goal',
        title: goal.title,
        subtitle: 'Goal',
        to: `/goals?id=${goal.id}`,
      })
    }
  }

  for (const habit of habitsApi.list(userId)) {
    if (habit.title.toLowerCase().includes(q)) {
      hits.push({
        id: `habit-${habit.id}`,
        kind: 'habit',
        title: habit.title,
        subtitle: habit.schedule,
        to: `/habits?id=${habit.id}`,
      })
    }
  }

  for (const entry of journalApi.list(userId)) {
    if (entry.body.toLowerCase().includes(q) || entry.reflection.toLowerCase().includes(q)) {
      hits.push({
        id: `journal-${entry.id}`,
        kind: 'journal',
        title: entry.date,
        subtitle: entry.mood,
        to: `/journal?date=${entry.date}`,
      })
    }
  }

  for (const doc of documentsApi.list(userId)) {
    if (doc.name.toLowerCase().includes(q)) {
      hits.push({
        id: `file-${doc.id}`,
        kind: 'file',
        title: doc.name,
        subtitle: 'File',
        to: `/documents?id=${doc.id}`,
      })
    }
  }

  return hits.slice(0, limit)
}
