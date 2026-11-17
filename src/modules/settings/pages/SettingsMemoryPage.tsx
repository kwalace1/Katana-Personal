import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MEMORY_KINDS,
  createMemory,
  deleteMemory,
  formatMemoryDisplayTag,
  isConfirmedMemory,
  listMemories,
  memoryKindLabel,
  updateMemory,
  type MemoryKind,
  type PersonalMemory,
} from '@/modules/assistant/memory'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'

function KindBadge({ memory }: { memory: PersonalMemory }) {
  const confirmed = isConfirmedMemory(memory)
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {memoryKindLabel(memory.kind)}
      {!confirmed ? (
        <span className="font-normal normal-case text-amber-700/90 dark:text-amber-400/90">
          · unconfirmed
        </span>
      ) : null}
      <span className="sr-only">{formatMemoryDisplayTag(memory)}</span>
    </span>
  )
}

export function SettingsMemoryPage() {
  const { user } = useAuth()
  const { tick, refresh } = useLocalRefresh()
  const userId = user?.id

  const [draft, setDraft] = useState('')
  const [draftKind, setDraftKind] = useState<MemoryKind>('fact')
  const [editing, setEditing] = useState<PersonalMemory | null>(null)
  const [editText, setEditText] = useState('')
  const [editKind, setEditKind] = useState<MemoryKind>('fact')

  const memories = useMemo(() => {
    void tick
    if (!userId) return []
    return listMemories(userId)
  }, [userId, tick])

  if (!userId) {
    return (
      <SettingsDetail title="Personal memory" description="Sign in locally to manage memories.">
        <SettingsPanel>
          <p className="text-sm text-muted-foreground">No user session.</p>
        </SettingsPanel>
      </SettingsDetail>
    )
  }

  function startEdit(m: PersonalMemory) {
    setEditing(m)
    setEditText(m.text)
    setEditKind(m.kind)
  }

  function saveEdit() {
    if (!editing || !userId) return
    const updated = updateMemory(userId, editing.id, { text: editText, kind: editKind })
    if (!updated) {
      toast.message('Could not update memory')
      return
    }
    setEditing(null)
    refresh()
    toast.message('Memory updated')
  }

  function addMemory() {
    if (!userId) return
    const created = createMemory(userId, { text: draft, kind: draftKind === 'pattern' ? 'note' : draftKind })
    if (!created) {
      toast.message('Enter something to remember')
      return
    }
    setDraft('')
    refresh()
    toast.message('Saved to personal memory')
  }

  function remove(id: string) {
    if (!userId) return
    deleteMemory(userId, id)
    if (editing?.id === id) setEditing(null)
    refresh()
    toast.message('Memory deleted')
  }

  return (
    <SettingsDetail
      title="Personal memory"
      description="What Ask remembers about you — only what you choose to save. Separate from tasks and chat."
    >
      <SettingsPanel className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Say “remember that…” in Ask, or add below. Nothing is stored from ordinary conversation.
          Patterns stay labeled unconfirmed until a future intelligence phase.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. I prefer deep work before noon"
            maxLength={280}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addMemory()
            }}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={draftKind === 'pattern' ? 'note' : draftKind}
            onChange={(e) => setDraftKind(e.target.value as MemoryKind)}
            aria-label="Memory kind"
          >
            {MEMORY_KINDS.filter((k) => k !== 'pattern').map((k) => (
              <option key={k} value={k}>
                {memoryKindLabel(k)}
              </option>
            ))}
          </select>
          <Button type="button" onClick={addMemory} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Save
          </Button>
        </div>
      </SettingsPanel>

      <SettingsPanel className="divide-y space-y-0 p-0 mt-3">
        {memories.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No memories yet. Ask won’t invent any — you stay in control.
          </p>
        ) : (
          memories.map((m) => (
            <div key={m.id} className="px-4 py-3">
              {editing?.id === m.id ? (
                <div className="space-y-2">
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    maxLength={280}
                    autoFocus
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={editKind}
                      onChange={(e) => setEditKind(e.target.value as MemoryKind)}
                      aria-label="Edit memory kind"
                    >
                      {MEMORY_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {memoryKindLabel(k)}
                          {k === 'pattern' ? ' (unconfirmed)' : ''}
                        </option>
                      ))}
                    </select>
                    <Button type="button" size="sm" onClick={saveEdit}>
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <KindBadge memory={m} />
                    <p className="mt-1 text-sm text-foreground">{m.text}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {m.source === 'explicit' ? 'You saved this' : 'Inferred'} ·{' '}
                      {new Date(m.updated_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => startEdit(m)}
                      aria-label="Edit memory"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => remove(m.id)}
                      aria-label="Delete memory"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </SettingsPanel>
    </SettingsDetail>
  )
}
