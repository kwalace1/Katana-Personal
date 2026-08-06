import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, FolderPlus, Pin, Plus, Search, Trash2 } from 'lucide-react'
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
import { notesApi } from '../api'
import { ShareWithFriendsButton } from '@/components/ShareWithFriendsButton'
import type { Note } from '../types'

export default function NotesPage() {
  const { user } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const [params, setParams] = useSearchParams()

  const [query, setQuery] = useState('')
  const [folderId, setFolderId] = useState<string | 'all' | 'none'>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'))
  const [preview, setPreview] = useState(false)
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
      title: 'New note',
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
        description="A quiet place for thoughts."
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
          <Input className="h-8 w-28" placeholder="Folder" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
          <Button type="submit" size="sm" variant="ghost" aria-label="Add folder">
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
          description="Capture from Today with a quick thought, or start a note here. Saves as you type."
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
          <ul className="kp-surface max-h-[70vh] space-y-1 overflow-auto p-2">
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
            <div className="kp-surface space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <Input
                  value={selected.title}
                  onChange={(e) => {
                    notesApi.updateNote(userId, selected.id, { title: e.target.value })
                    refresh()
                  }}
                  className="border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
                />
                <div className="flex shrink-0 items-center gap-1">
                  <ShareWithFriendsButton
                    kind="note"
                    title={selected.title}
                    body={selected.body}
                    data={{ tags: selected.tags, localNoteId: selected.id }}
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
                    variant={selected.pinned ? 'secondary' : 'ghost'}
                    aria-label="Pin note"
                    onClick={() => {
                      notesApi.updateNote(userId, selected.id, { pinned: !selected.pinned })
                      refresh()
                    }}
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      notesApi.deleteNote(userId, selected.id)
                      setSelectedId(null)
                      setParams({})
                      refresh()
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Labels (comma separated)"
                  value={selected.tags.join(', ')}
                  onChange={(e) => {
                    const tags = e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                    notesApi.updateNote(userId, selected.id, { tags })
                    refresh()
                  }}
                  className="flex-1"
                />
                <select
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  value={selected.folder_id || ''}
                  onChange={(e) => {
                    notesApi.updateNote(userId, selected.id, {
                      folder_id: e.target.value || null,
                    })
                    refresh()
                  }}
                >
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              {preview ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Preview · saved as you type</p>
                  <div
                    className="prose-sm min-h-[360px] rounded-xl bg-secondary/40 p-4 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(selected.body || '_Nothing yet_') }}
                  />
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Editing · saved as you type · # headings, **bold**, - lists
                  </p>
                  <Textarea
                    className="min-h-[360px] resize-y"
                    placeholder="Start writing…"
                    value={selected.body}
                    onChange={(e) => {
                      notesApi.updateNote(userId, selected.id, { body: e.target.value })
                      refresh()
                    }}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </motion.div>
  )
}
