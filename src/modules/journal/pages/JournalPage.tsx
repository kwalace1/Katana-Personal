import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { MoodSparkline } from '@/components/MiniBars'
import { useAuth } from '@/contexts/AuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { format, parseISO, todayKey } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { journalApi } from '../api'
import { ShareWithFriendsButton } from '@/components/ShareWithFriendsButton'
import { offerJournalShare } from '@/lib/social/share-win'
import type { Mood } from '../types'

const MOODS: { id: Mood; label: string }[] = [
  { id: 'great', label: 'Great' },
  { id: 'good', label: 'Good' },
  { id: 'okay', label: 'Okay' },
  { id: 'low', label: 'Low' },
  { id: 'rough', label: 'Rough' },
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

export default function JournalPage() {
  const { user } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const [params, setParams] = useSearchParams()

  const [activeDate, setActiveDate] = useState(params.get('date') || todayKey())

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
        title="Journal"
        description={`Mental check-in for ${dateLabel} — mood, the day, and a quiet thought.`}
        eyebrow="Mental wellness"
        actions={
          moodSeries.length > 1 ? (
            <div className="hidden sm:block">
              <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">Mood · 14 days</p>
              <MoodSparkline moods={moodSeries} />
            </div>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
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
      </div>

      <form onSubmit={onSave} className="kp-surface mb-8 space-y-5 p-5">
        <div>
          <p className="mb-2 text-sm font-medium">How are you feeling?</p>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <Button
                key={m.id}
                type="button"
                size="sm"
                variant={mood === m.id ? 'default' : 'outline'}
                className="rounded-full"
                onClick={() => {
                  setMood(m.id)
                  markDirty()
                }}
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Entry</p>
          <Textarea
            className="min-h-[160px]"
            placeholder="What happened?"
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              markDirty()
            }}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">A quiet thought</p>
          <Textarea
            className="min-h-[100px]"
            placeholder="Anything you’d like to remember…"
            value={reflection}
            onChange={(e) => {
              setReflection(e.target.value)
              markDirty()
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {justSaved && !dirty ? (
            <p className="text-xs text-muted-foreground">Only your mood is shared — never the entry text.</p>
          ) : null}
        </div>
      </form>

      <h2 className="mb-3 font-semibold">Earlier</h2>
      {entries.length === 0 ? (
        <EmptyState title="No entries yet" description="Write something for today when you’re ready." />
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => {
                  setActiveDate(entry.date)
                  setParams({ date: entry.date })
                }}
                className={cn(
                  'kp-surface w-full p-4 text-left transition hover:ring-1 hover:ring-primary/25',
                  entry.date === activeDate && 'ring-1 ring-primary/30',
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
      )}
    </motion.div>
  )
}
