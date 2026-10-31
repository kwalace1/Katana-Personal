import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { NotebookPen, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { navSectionLabel } from '@/lib/nav'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { format, parseISO, todayKey, addDays, startOfWeek } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { journalApi } from '../api'
import { ShareWithFriendsButton } from '@/components/ShareWithFriendsButton'
import { offerJournalShare } from '@/lib/social/share-win'
import type { Mood } from '../types'

const MOODS: { id: Mood; label: string; color: string }[] = [
  { id: 'great', label: 'Great', color: '#10b981' },
  { id: 'good', label: 'Good', color: '#14b8a6' },
  { id: 'okay', label: 'Okay', color: '#f59e0b' },
  { id: 'low', label: 'Low', color: '#f97316' },
  { id: 'rough', label: 'Rough', color: '#f43f5e' },
]

function weekDayLabel(date: string, moods: Mood[]): string {
  let when = date
  try {
    when = format(parseISO(date), 'EEEE, MMMM d')
  } catch {
    when = date
  }
  if (moods.length === 0) return `${when}, no entries`
  const names = moods.map((mood) => moodLabel(mood)).join(', ')
  return `${when}, ${moods.length === 1 ? '1 entry' : `${moods.length} entries`}: ${names}`
}

function moodLabel(mood: Mood): string {
  return MOODS.find((m) => m.id === mood)?.label ?? mood
}

function moodColor(mood: Mood): string {
  return MOODS.find((m) => m.id === mood)?.color ?? '#94a3b8'
}

type JournalDraft = {
  date: string
  mood: Mood
  body: string
  reflection: string
}

function sameDraft(a: JournalDraft, b: JournalDraft) {
  return a.date === b.date && a.mood === b.mood && a.body === b.body && a.reflection === b.reflection
}

export default function JournalPage() {
  const { user } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const [params, setParams] = useSearchParams()

  const [activeDate, setActiveDate] = useState(params.get('date') || todayKey())
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    const d = params.get('date')
    if (d) setActiveDate(d)
  }, [params])

  const entries = useMemo(() => {
    void tick
    return journalApi.list(userId)
  }, [userId, tick])

  const weekDays = useMemo(() => {
    let anchor = parseISO(todayKey())
    const parsed = parseISO(activeDate)
    if (!Number.isNaN(parsed.getTime())) anchor = parsed
    const start = startOfWeek(anchor, { weekStartsOn: 0 })
    const moodsByDate = new Map<string, Mood[]>()
    for (const entry of [...entries].reverse()) {
      const moods = moodsByDate.get(entry.date) ?? []
      moods.push(entry.mood)
      moodsByDate.set(entry.date, moods)
    }
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i)
      const date = todayKey(day)
      const moods = moodsByDate.get(date) ?? []
      return {
        date,
        weekday: format(day, 'EEEEE'),
        dayNum: format(day, 'd'),
        moods,
        selected: date === activeDate,
      }
    })
  }, [entries, activeDate])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [mood, setMood] = useState<Mood>('good')
  const [body, setBody] = useState('')
  const [reflection, setReflection] = useState('')
  const [saving, setSaving] = useState(false)
  const baselineRef = useRef<JournalDraft | null>(null)
  const savingRef = useRef(false)

  const editing = entries.find((entry) => entry.id === editingId) ?? null
  const draft: JournalDraft = { date: activeDate, mood, body, reflection }

  const dateLabel = (() => {
    try {
      return format(parseISO(activeDate), 'MMMM d')
    } catch {
      return activeDate
    }
  })()

  function selectDate(date: string, entryCount: number) {
    setActiveDate(date)
    setParams(editingId ? { date, id: editingId } : { date })
    if (entryCount === 0) return
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-journal-date="${date}"]`)?.scrollIntoView({ block: 'nearest' })
    })
  }

  function rememberDraft(next: JournalDraft) {
    baselineRef.current = next
  }

  function confirmDiscard() {
    const baseline = baselineRef.current
    if (!composing || !baseline || sameDraft(baseline, draft)) return true
    return window.confirm('Discard unsaved changes?')
  }

  function closeEditor(date = baselineRef.current?.date ?? activeDate) {
    baselineRef.current = null
    setEditingId(null)
    setComposing(false)
    setActiveDate(date)
    setParams({ date })
  }

  function scrollEditorIntoView() {
    requestAnimationFrame(() => {
      document.getElementById('journal-editor')?.scrollIntoView({ block: 'start' })
    })
  }

  function scrollEntryIntoView(id: string) {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-journal-id="${id}"]`)?.scrollIntoView({ block: 'nearest' })
    })
  }

  function beginNew(date = todayKey()) {
    if (!confirmDiscard()) return
    const next = { date, mood: 'good' as const, body: '', reflection: '' }
    setEditingId(null)
    setActiveDate(date)
    setMood(next.mood)
    setBody(next.body)
    setReflection(next.reflection)
    rememberDraft(next)
    setParams({ date })
    setComposing(true)
    scrollEditorIntoView()
  }

  function openEntry(entryId: string) {
    if (composing && editingId === entryId) {
      if (!confirmDiscard()) return
      closeEditor()
      return
    }
    const entry = entries.find((item) => item.id === entryId)
    if (!entry) return
    if (!confirmDiscard()) return
    const next = {
      date: entry.date,
      mood: entry.mood,
      body: entry.body,
      reflection: entry.reflection,
    }
    setEditingId(entry.id)
    setActiveDate(next.date)
    setMood(next.mood)
    setBody(next.body)
    setReflection(next.reflection)
    rememberDraft(next)
    setParams({ date: entry.date, id: entry.id })
    setComposing(true)
    scrollEditorIntoView()
  }

  function onSave(e: FormEvent) {
    e.preventDefault()
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    const input = { date: activeDate, mood, body, reflection }
    try {
      if (editing) {
        const updated = journalApi.update(userId, editing.id, input)
        if (!updated) {
          toast.error('Couldn’t save this entry')
          return
        }
        refresh()
        closeEditor(updated.date)
        toast.success('Entry saved')
        scrollEntryIntoView(updated.id)
        return
      }
      const created = journalApi.create(userId, input)
      refresh()
      closeEditor(created.date)
      toast.success('Entry saved')
      scrollEntryIntoView(created.id)
      const snippet = (body.trim() || reflection.trim()).slice(0, 180)
      offerJournalShare({
        dateLabel,
        moodLabel: moodLabel(mood),
        snippet: snippet || undefined,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save this entry')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  function onDelete() {
    if (!editing || savingRef.current) return
    const removed = journalApi.remove(userId, editing.id)
    if (!removed) {
      toast.error('Couldn’t delete this entry')
      return
    }
    refresh()
    closeEditor(activeDate)
    toast.message('Entry deleted')
  }

  const canShare = Boolean(editing)
  const shareMoodLabel = moodLabel(mood)

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        dense
        title="Journal"
        eyebrow={navSectionLabel('/journal')}
        actions={
          entries.length > 0 || composing ? (
            <Button className="gap-2" onClick={() => beginNew(activeDate)}>
              <Plus className="h-4 w-4" />
              New entry
            </Button>
          ) : null
        }
      />

      {entries.length > 0 || composing ? (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={activeDate}
              onChange={(e) => {
                const next = e.target.value
                if (!next) return
                selectDate(next, entries.filter((entry) => entry.date === next).length)
              }}
              className="w-auto"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => selectDate(todayKey(), entries.filter((entry) => entry.date === todayKey()).length)}
            >
              Today
            </Button>
          </div>

          <div className="mb-4 grid grid-cols-7 gap-0.5" role="group" aria-label="Week">
            {weekDays.map((day) => (
              <button
                key={day.date}
                type="button"
                onClick={() => selectDate(day.date, day.moods.length)}
                aria-pressed={day.selected}
                aria-label={weekDayLabel(day.date, day.moods)}
                className={cn(
                  'flex min-h-11 flex-col items-center gap-1 rounded-lg px-0.5 py-1.5 transition',
                  day.selected ? 'kp-day-selected bg-primary/10' : 'hover:bg-secondary/50',
                )}
              >
                <span className="text-[0.65rem] font-semibold uppercase leading-none text-muted-foreground">
                  {day.weekday}
                </span>
                <span
                  className={cn(
                    'text-sm tabular-nums leading-none',
                    day.selected ? 'font-semibold text-foreground' : 'text-foreground',
                  )}
                >
                  {day.dayNum}
                </span>
                <span className="flex min-h-2 w-full flex-wrap items-center justify-center gap-0.5">
                  {day.moods.length === 0 ? (
                    <span className="h-2 w-2 rounded-full border border-border" aria-hidden />
                  ) : (
                    day.moods.map((moodId, index) => (
                      <span
                        key={`${day.date}-${index}`}
                        className="kp-type-mark h-2 w-2 shrink-0 rounded-full"
                        style={{ background: moodColor(moodId) }}
                      />
                    ))
                  )}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {composing ? (
      <form id="journal-editor" onSubmit={onSave} className="kp-surface mb-3 scroll-mt-24 space-y-2 p-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">How are you doing today?</p>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <FilterChip
                key={m.id}
                selected={mood === m.id}
                onClick={() => setMood(m.id)}
              >
                {m.label}
              </FilterChip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Entry</p>
          <Textarea
            className="min-h-16"
            placeholder="What happened?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">A quiet thought</p>
          <Textarea
            rows={1}
            className="min-h-9 resize-y py-1.5"
            placeholder="Anything you’d like to remember…"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => {
              if (!confirmDiscard()) return
              closeEditor()
            }}
          >
            Close
          </Button>
          <Button type="submit" disabled={saving}>
            Save
          </Button>
          {canShare ? (
            <>
              <ShareWithFriendsButton
                kind="journal"
                title={`Mood · ${dateLabel}`}
                body={`${shareMoodLabel} — shared from Journal`}
                data={{ date: activeDate, mood, moodLabel: shareMoodLabel, localEntryId: editing?.id }}
                label="Share mood"
              />
              {editing ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={saving}
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </form>
      ) : null}

      {entries.length === 0 && !composing ? (
        <EmptyState
          plain
          icon={NotebookPen}
          title="Write a first entry"
          description="A few lines about today is enough."
          action={
            <Button type="button" className="gap-1.5" onClick={() => beginNew()}>
              <Plus className="h-4 w-4" />
              Write an entry
            </Button>
          }
        />
      ) : entries.length > 0 ? (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const selected = composing && editingId === entry.id
            return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => openEntry(entry.id)}
                data-journal-id={entry.id}
                data-journal-date={entry.date}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                  'kp-surface-soft w-full scroll-mt-24 p-3 text-left transition hover:bg-secondary/50',
                  selected && 'border-primary bg-primary/10',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {(() => {
                      try {
                        const when = parseISO(entry.created_at)
                        return `${format(parseISO(entry.date), 'EEE · MMM d')} · ${format(when, 'h:mm a')}`
                      } catch {
                        return entry.date
                      }
                    })()}
                  </p>
                  <span className="text-xs font-medium tracking-wide text-muted-foreground">
                    {moodLabel(entry.mood)}
                  </span>
                </div>
                {entry.body ? (
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-foreground/90">{entry.body}</p>
                ) : null}
                {entry.reflection ? (
                  <p className="mt-1 line-clamp-1 text-xs italic text-muted-foreground">{entry.reflection}</p>
                ) : null}
              </button>
            </li>
            )
          })}
        </ul>
      ) : null}
    </motion.div>
  )
}
