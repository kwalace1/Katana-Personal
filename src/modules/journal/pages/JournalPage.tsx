import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { navSectionLabel } from '@/lib/nav'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MoodSparkline } from '@/components/MiniBars'
import { useAuth } from '@/contexts/AuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { format, parseISO, todayKey, addDays } from '@/lib/dates'
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

const MOOD_SCORE: Record<Mood, number> = {
  rough: 0,
  low: 1,
  okay: 2,
  good: 3,
  great: 4,
}

function moodLabel(mood: Mood): string {
  return MOODS.find((m) => m.id === mood)?.label ?? mood
}

function moodColor(mood: Mood): string {
  return MOODS.find((m) => m.id === mood)?.color ?? '#94a3b8'
}

export default function JournalPage() {
  const { user } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const [params, setParams] = useSearchParams()

  const [activeDate, setActiveDate] = useState(params.get('date') || todayKey())
  const [composing, setComposing] = useState(() => Boolean(params.get('date')))

  useEffect(() => {
    const d = params.get('date')
    if (d) setActiveDate(d)
  }, [params])

  const existing = useMemo(() => {
    void tick
    return journalApi.forDate(userId, activeDate)
  }, [userId, activeDate, tick])

  const entries = useMemo(() => {
    void tick
    return journalApi.list(userId)
  }, [userId, tick])

  const moodSeries = useMemo(() => {
    const last14 = [...entries].reverse().slice(-14)
    return last14.map((e) => MOOD_SCORE[e.mood])
  }, [entries])

  const weekBlips = useMemo(() => {
    const byDate = new Map(entries.map((e) => [e.date, e.mood] as const))
    const today = parseISO(todayKey())
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i - 6)
      const date = todayKey(day)
      return {
        date,
        label: format(day, 'EEEEE'),
        mood: byDate.get(date) ?? null,
        selected: date === activeDate,
      }
    })
  }, [entries, activeDate])

  const [mood, setMood] = useState<Mood>('good')
  const [body, setBody] = useState('')
  const [reflection, setReflection] = useState('')
  const [dirty, setDirty] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    setMood(existing?.mood || 'good')
    setBody(existing?.body || '')
    setReflection(existing?.reflection || '')
    setDirty(false)
    setJustSaved(false)
  }, [existing, activeDate])

  function markDirty() {
    setDirty(true)
    setJustSaved(false)
  }

  const dateLabel = (() => {
    try {
      return format(parseISO(activeDate), 'MMMM d')
    } catch {
      return activeDate
    }
  })()

  function checkInMood(next: Mood) {
    setMood(next)
    journalApi.upsert(userId, { date: activeDate, mood: next, body, reflection })
    refresh()
    setDirty(false)
    setJustSaved(true)
  }

  function startEntry() {
    const date = todayKey()
    setActiveDate(date)
    setParams({ date })
    setComposing(true)
  }

  function onSave(e: FormEvent) {
    e.preventDefault()
    const wasNew = !existing
    journalApi.upsert(userId, { date: activeDate, mood, body, reflection })
    refresh()
    setDirty(false)
    setJustSaved(true)
    toast.success(existing ? 'Entry updated' : 'Entry saved')
    if (wasNew) {
      const snippet = (body.trim() || reflection.trim()).slice(0, 180)
      offerJournalShare({
        dateLabel,
        moodLabel: moodLabel(mood),
        snippet: snippet || undefined,
      })
    }
  }

  const canShare = Boolean(existing) || justSaved
  const shareMoodLabel = moodLabel(mood)

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        dense
        title="Journal"
        eyebrow={navSectionLabel('/journal')}
        actions={
          entries.length > 0 && !composing ? (
            <Button className="gap-2" onClick={startEntry}>
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
                setActiveDate(e.target.value)
                setParams({ date: e.target.value })
              }}
              className="w-auto"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const t = todayKey()
                setActiveDate(t)
                setParams({ date: t })
              }}
            >
              Today
            </Button>
            {moodSeries.length > 1 ? <MoodSparkline moods={moodSeries} /> : null}
          </div>

          <div className="mb-3 flex gap-1.5">
            {weekBlips.map((blip) => (
              <button
                key={blip.date}
                type="button"
                onClick={() => {
                  setActiveDate(blip.date)
                  setParams({ date: blip.date })
                }}
                className={cn(
                  'flex min-h-11 flex-1 flex-col items-center justify-center gap-1 py-1.5 transition',
                  blip.selected ? 'bg-primary/10' : 'hover:bg-secondary/50',
                )}
                aria-label={`${blip.date}${blip.mood ? `, ${moodLabel(blip.mood)}` : ', no check-in'}`}
              >
                <span className="text-[0.65rem] font-semibold uppercase text-muted-foreground">{blip.label}</span>
                <span
                  className={cn('h-2.5 w-2.5 rounded-full', !blip.mood && 'bg-border')}
                  style={blip.mood ? { background: moodColor(blip.mood) } : undefined}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {composing ? (
      <form onSubmit={onSave} className="kp-surface mb-3 space-y-2 p-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">How are you doing today?</p>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <FilterChip
                key={m.id}
                selected={mood === m.id && (Boolean(existing) || justSaved)}
                onClick={() => checkInMood(m.id)}
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
            onChange={(e) => {
              setBody(e.target.value)
              markDirty()
            }}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">A quiet thought</p>
          <Textarea
            rows={1}
            className="min-h-9 resize-y py-1.5"
            placeholder="Anything you’d like to remember…"
            value={reflection}
            onChange={(e) => {
              setReflection(e.target.value)
              markDirty()
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setComposing(false)
              setParams({})
            }}
          >
            Close
          </Button>
          <Button type="submit" disabled={!dirty && Boolean(existing)} className="gap-1.5">
            {justSaved && !dirty ? (
              <>
                <Check className="h-4 w-4" />
                Saved
              </>
            ) : existing && !dirty ? (
              'Saved'
            ) : existing ? (
              'Update'
            ) : (
              'Save'
            )}
          </Button>
          {canShare ? (
            <>
              <ShareWithFriendsButton
                kind="journal"
                title={`Mood · ${dateLabel}`}
                body={`${shareMoodLabel} — shared from Journal`}
                data={{ date: activeDate, mood, moodLabel: shareMoodLabel, localEntryId: existing?.id }}
                label="Share mood"
              />
              {existing ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    journalApi.remove(userId, existing.id)
                    setBody('')
                    setReflection('')
                    setMood('good')
                    setDirty(false)
                    setJustSaved(false)
                    refresh()
                    toast.message('Entry deleted')
                  }}
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
        <div>
          <p className="text-sm text-muted-foreground">No entries yet.</p>
          <Button type="button" size="sm" className="mt-3 gap-1.5" onClick={startEntry}>
            <Plus className="h-4 w-4" />
            New entry
          </Button>
        </div>
      ) : entries.length > 0 ? (
        <ul className="kp-surface divide-y">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => {
                  if (composing && entry.date === activeDate) {
                    setComposing(false)
                    return
                  }
                  setActiveDate(entry.date)
                  setParams({ date: entry.date })
                  setComposing(true)
                }}
                className={cn(
                  'w-full p-3 text-left transition hover:bg-secondary/50',
                  entry.date === activeDate && 'bg-primary/10',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {(() => {
                      try {
                        return format(parseISO(entry.date), 'EEE · MMM d')
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
          ))}
        </ul>
      ) : null}
    </motion.div>
  )
}
