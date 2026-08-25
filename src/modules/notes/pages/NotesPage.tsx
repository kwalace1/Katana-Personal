import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, FolderPlus, Pin, Plus, Save, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/contexts/AuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { formatShortDate } from '@/lib/dates'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { renderSimpleMarkdown } from '@/lib/simple-markdown'
import { cn } from '@/lib/utils'
import { noteTitleFromInput, notesApi } from '../api'
import { ShareWithFriendsButton } from '@/components/ShareWithFriendsButton'
import type { Note, NoteFolder } from '../types'

function parseTagInput(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function NoteEditor({
  note,
  folders,
  userId,
  onSaved,
  onDeleted,
}: {
  note: Note
  folders: NoteFolder[]
  userId: string
  onSaved: (folderId: string | null) => void
  onDeleted: () => void
}) {
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [tagInput, setTagInput] = useState(note.tags.join(', '))
  const [folderId, setFolderId] = useState(note.folder_id || '')
  const [preview, setPreview] = useState(false)
  const [dirty, setDirty] = useState(false)
  const draftRef = useRef({ title, body, tagInput, folderId, dirty, noteId: note.id })
  draftRef.current = { title, body, tagInput, folderId, dirty, noteId: note.id }
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  useEffect(() => {
    setTitle(note.title === 'Untitled' ? '' : note.title)
    setBody(note.body)
    setTagInput(note.tags.join(', '))
    setFolderId(note.folder_id || '')
    setDirty(false)
    setPreview(false)
  }, [note.id])

  function persist(source = draftRef.current, opts?: { silent?: boolean }) {
    const nextTitle = noteTitleFromInput(source.title)
    const nextFolder = source.folderId || null
    notesApi.updateNote(userId, source.noteId, {
      title: nextTitle,
      body: source.body,
      tags: parseTagInput(source.tagInput),
      folder_id: nextFolder,
    })
    if (source.noteId === note.id) {
      setDirty(false)
      setTitle(nextTitle === 'Untitled' ? '' : nextTitle)
    }
    onSavedRef.current(nextFolder)
    if (!opts?.silent) toast.success('Note saved')
  }

  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => persist(draftRef.current, { silent: true }), 2500)
    return () => window.clearTimeout(timer)
  }, [dirty, title, body, tagInput, folderId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        persist(draftRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [userId])

  useEffect(() => {
    return () => {
      const latest = draftRef.current
      if (latest.dirty) persist(latest, { silent: true })
    }
  }, [note.id, userId])

  return (
    <div className="kp-surface space-y-3 p-5">
      <Input
        value={title}
        placeholder="Note title"
        autoComplete="off"
        autoCorrect="on"
        spellCheck
        aria-label="Note title"
        onChange={(e) => {
          setTitle(e.target.value)
          setDirty(true)
        }}
        className="h-auto min-h-11 w-full border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
      />
      <div className="flex flex-wrap items-center justify-end gap-1">
          <ShareWithFriendsButton
            kind="note"
            title={noteTitleFromInput(title)}
            body={body}
            data={{ tags: parseTagInput(tagInput), localNoteId: note.id }}
            label="Share"
          />
          <Button
            size="icon"
            variant={preview ? 'secondary' : 'ghost'}
            aria-label="Toggle preview"
            onClick={() => setPreview((v) => !v)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={note.pinned ? 'secondary' : 'ghost'}
            aria-label="Pin note"
            onClick={() => {
              notesApi.updateNote(userId, note.id, { pinned: !note.pinned })
              onSaved(folderId || null)
            }}
          >
            <Pin className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              notesApi.deleteNote(userId, note.id)
              onDeleted()
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Category</span>
          <select
            className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
            value={folderId}
            onChange={(e) => {
              setFolderId(e.target.value)
              setDirty(true)
            }}
          >
            <option value="">Unfiled</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <Input
          placeholder="Labels (comma separated)"
          value={tagInput}
          onChange={(e) => {
            setTagInput(e.target.value)
            setDirty(true)
          }}
          className="flex-1"
        />
        <Button
          className="min-h-11 gap-2 sm:min-w-[7.5rem]"
          disabled={!dirty}
          onClick={() => persist()}
        >
          <Save className="h-4 w-4" />
          {dirty ? 'Save' : 'Saved'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {dirty ? 'Unsaved changes · Save keeps the title, category, and body together.' : 'Saved'}
        {preview ? ' · preview' : ' · # headings, **bold**, - lists'}
      </p>

      {preview ? (
        <div
          className="prose-sm min-h-[360px] rounded-xl bg-secondary/40 p-4 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(body || '_Nothing yet_') }}
        />
      ) : (
        <Textarea
          className="min-h-[360px] resize-y"
          placeholder="Start writing…"
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            setDirty(true)
          }}
        />
      )}
    </div>
  )
}

export default function NotesPage() {
  const { user } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const [params, setParams] = useSearchParams()

  const [query, setQuery] = useState('')
  const [folderId, setFolderId] = useState<string | 'all' | 'none'>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'))
  const [newFolder, setNewFolder] = useState('')

  const folders = useMemo(() => {
    void tick
    return notesApi.listFolders(userId)
  }, [userId, tick])

  const allTags = useMemo(() => {
    void tick
    return notesApi.allTags(userId)
  }, [userId, tick])

  const notes = useMemo(() => {
    void tick
    let list = notesApi.search(userId, query)
    if (folderId === 'none') list = list.filter((n) => !n.folder_id)
    else if (folderId !== 'all') list = list.filter((n) => n.folder_id === folderId)
    if (tagFilter) list = list.filter((n) => n.tags.includes(tagFilter))
    return list
  }, [userId, query, folderId, tagFilter, tick])

  useEffect(() => {
    const id = params.get('id')
    if (id) setSelectedId(id)
  }, [params])

  const selected: Note | null = useMemo(() => {
    if (!selectedId) return notes[0] ?? null
    return notes.find((n) => n.id === selectedId) || notesApi.getNote(userId, selectedId) || notes[0] || null
  }, [notes, selectedId, userId])

  function createNote() {
    const note = notesApi.createNote(userId, {
      title: 'Untitled',
      body: '',
      folder_id: folderId !== 'all' && folderId !== 'none' ? folderId : null,
    })
    setSelectedId(note.id)
    setParams({ id: note.id })
    refresh()
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        title="Notes"
        description="Write freely — including spaces in the title — then save into a category."
        eyebrow="Life"
        actions={
          <Button className="gap-2" onClick={createNote}>
            <Plus className="h-4 w-4" />
            New note
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant={folderId === 'all' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFolderId('all')}>
          All
        </Button>
        <Button size="sm" variant={folderId === 'none' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFolderId('none')}>
          Unfiled
        </Button>
        {folders.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={folderId === f.id ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setFolderId(f.id)}
          >
            {f.name}
          </Button>
        ))}
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newFolder.trim()) return
            const f = notesApi.createFolder(userId, newFolder)
            setNewFolder('')
            setFolderId(f.id)
            refresh()
          }}
        >
          <Input className="h-8 w-28" placeholder="Category" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
          <Button type="submit" size="sm" variant="ghost" aria-label="Add category">
            <FolderPlus className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Find a note…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {allTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter((t) => (t === tag ? null : tag))}
                className={cn(
                  'kp-chip text-xs',
                  tagFilter === tag && 'bg-primary text-primary-foreground',
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Capture from Today with a quick thought, or start a note here. Use Save when you’re ready."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={createNote}>Start writing</Button>
              <Button asChild variant="outline">
                <Link to="/dashboard">Back to Today</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <ul className="kp-surface max-h-[32vh] space-y-1 overflow-auto p-2 lg:max-h-[70vh]">
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(note.id)
                    setParams({ id: note.id })
                  }}
                  className={cn(
                    'w-full rounded-xl px-3 py-2.5 text-left transition',
                    selected?.id === note.id ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary',
                  )}
                >
                  <p className="flex items-center gap-1 truncate text-sm font-medium">
                    {note.pinned ? <Pin className="h-3 w-3 shrink-0" /> : null}
                    {note.title}
                  </p>
                  <p
                    className={cn(
                      'truncate text-xs',
                      selected?.id === note.id ? 'text-primary-foreground/80' : 'text-muted-foreground',
                    )}
                  >
                    {formatShortDate(note.updated_at)}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              folders={folders}
              userId={userId}
              onSaved={(savedFolder) => {
                if (savedFolder && folderId !== 'all' && folderId !== 'none' && folderId !== savedFolder) {
                  setFolderId(savedFolder)
                }
                refresh()
              }}
              onDeleted={() => {
                setSelectedId(null)
                setParams({})
                refresh()
              }}
            />
          ) : null}
        </div>
      )}
    </motion.div>
  )
}
