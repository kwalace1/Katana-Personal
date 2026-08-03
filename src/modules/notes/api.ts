import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import type { Note, NoteFolder } from './types'

const NOTES = 'notes'
const FOLDERS = 'note_folders'

function now() {
  return new Date().toISOString()
}

function normalizeNote(note: Note): Note {
  return {
    ...note,
    pinned: Boolean(note.pinned),
    tags: Array.isArray(note.tags) ? note.tags : [],
    folder_id: note.folder_id ?? null,
    body: note.body ?? '',
  }
}

export const notesApi = {
  listNotes(userId: string): Note[] {
    return localDb
      .list<Note>(NOTES, userId)
      .map(normalizeNote)
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.updated_at.localeCompare(a.updated_at)
      })
  },

  getNote(userId: string, id: string): Note | null {
    const note = localDb.getById<Note>(NOTES, userId, id)
    return note ? normalizeNote(note) : null
  },

  listFolders(userId: string): NoteFolder[] {
    return localDb.list<NoteFolder>(FOLDERS, userId).sort((a, b) => a.name.localeCompare(b.name))
  },

  createFolder(userId: string, name: string): NoteFolder {
    const ts = now()
    return localDb.insert(FOLDERS, userId, {
      id: createId(),
      user_id: userId,
      name: name.trim() || 'Folder',
      created_at: ts,
      updated_at: ts,
    })
  },

  updateFolder(userId: string, id: string, patch: Partial<Pick<NoteFolder, 'name'>>): NoteFolder | null {
    return localDb.update<NoteFolder>(FOLDERS, userId, id, { ...patch, updated_at: now() })
  },

  deleteFolder(userId: string, id: string): boolean {
    for (const note of notesApi.listNotes(userId).filter((n) => n.folder_id === id)) {
      notesApi.updateNote(userId, note.id, { folder_id: null })
    }
    return localDb.remove(FOLDERS, userId, id)
  },

  createNote(
    userId: string,
    input: {
      title?: string
      body?: string
      tags?: string[]
      folder_id?: string | null
      pinned?: boolean
    },
  ): Note {
    const ts = now()
    return normalizeNote(
      localDb.insert(NOTES, userId, {
        id: createId(),
        user_id: userId,
        folder_id: input.folder_id ?? null,
        title: input.title?.trim() || 'Untitled',
        body: input.body || '',
        tags: input.tags || [],
        pinned: input.pinned ?? false,
        created_at: ts,
        updated_at: ts,
      }),
    )
  },

  updateNote(userId: string, id: string, patch: Partial<Note>): Note | null {
    const updated = localDb.update<Note>(NOTES, userId, id, { ...patch, updated_at: now() })
    return updated ? normalizeNote(updated) : null
  },

  deleteNote(userId: string, id: string): boolean {
    return localDb.remove(NOTES, userId, id)
  },

  search(userId: string, query: string): Note[] {
    const q = query.trim().toLowerCase()
    if (!q) return notesApi.listNotes(userId)
    return notesApi.listNotes(userId).filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    )
  },

  recent(userId: string, limit = 4): Note[] {
    return notesApi.listNotes(userId).slice(0, limit)
  },

  allTags(userId: string): string[] {
    const set = new Set<string>()
    for (const note of notesApi.listNotes(userId)) {
      for (const tag of note.tags) {
        const t = tag.trim()
        if (t) set.add(t)
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  },
}
