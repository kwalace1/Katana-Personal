import { FormEvent, useMemo, useState } from 'react'
import { Pill, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  buildHealthStreakShareCard,
  isStreakMilestone,
  offerShareWin,
  recordSupplementFullStackDay,
} from '@/lib/social/share-win'
import { healthApi, SUPPLEMENT_TIMES, supplementTimeOfDay } from '../api'
import type { SupplementChecklistRow, SupplementTimeOfDay } from '../types'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
  kind?: 'vitamin' | 'supplement'
}

export function VitaminsPanel({ userId, logDate, tick, refresh, kind = 'supplement' }: Props) {
  const checklist = useMemo(() => {
    void tick
    return healthApi.getDayChecklist(userId, logDate).filter((row) => {
      const inferredKind =
        row.item.kind ||
        (/^vitamin\b|multivitamin/i.test(row.item.name) ? 'vitamin' : 'supplement')
      return inferredKind === kind
    })
  }, [userId, logDate, tick, kind])

  const groups = useMemo(() => {
    return SUPPLEMENT_TIMES.map((slot) => ({
      ...slot,
      rows: checklist.filter((row) => supplementTimeOfDay(row.item) === slot.value),
    })).filter((g) => g.rows.length > 0)
  }, [checklist])

  const takenCount = checklist.filter((row) => row.taken).length

  const [name, setName] = useState('')
  const [doseNotes, setDoseNotes] = useState('')
  const [timeOfDay, setTimeOfDay] = useState<SupplementTimeOfDay>('morning')

  function addItem(e: FormEvent) {
    e.preventDefault()
    const row = healthApi.addSupplement(userId, {
      name,
      dose_notes: doseNotes,
      kind,
      time_of_day: timeOfDay,
    })
    if (!row) {
      toast.error('Add a name')
      return
    }
    toast.success(`Added ${row.name}`)
    setName('')
    setDoseNotes('')
    refresh()
  }

  function renderRow(row: SupplementChecklistRow) {
    return (
      <li key={row.item.id} className="flex items-start gap-3 rounded-2xl bg-secondary/50 px-3 py-3">
        <Checkbox
          className="mt-0.5"
          checked={row.taken}
          onCheckedChange={(v) => {
            const taken = Boolean(v)
            healthApi.toggleTaken(userId, row.item.id, logDate, taken)
            if (taken && checklist.length >= 2) {
              const allDone = checklist.every((r) => (r.item.id === row.item.id ? true : r.taken))
              if (allDone) {
                const streak = recordSupplementFullStackDay(userId, logDate)
                if (isStreakMilestone(streak)) {
                  offerShareWin(
                    buildHealthStreakShareCard({
                      kind: 'supplements',
                      streak,
                    }),
                  )
                }
              }
            }
            refresh()
          }}
          id={`supp-${row.item.id}`}
        />
        <label htmlFor={`supp-${row.item.id}`} className="min-w-0 flex-1 cursor-pointer">
          <span className={`block text-sm font-medium ${row.taken ? 'text-muted-foreground line-through' : ''}`}>
            {row.item.name}
          </span>
          {row.doseNotes ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">{row.doseNotes}</span>
          ) : null}
        </label>
        <Select
          value={supplementTimeOfDay(row.item)}
          onValueChange={(v) => {
            healthApi.updateSupplement(userId, row.item.id, { time_of_day: v as SupplementTimeOfDay })
            refresh()
          }}
        >
          <SelectTrigger size="sm" className="w-[7.5rem] shrink-0" aria-label={`Time of day for ${row.item.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPLEMENT_TIMES.map((slot) => (
              <SelectItem key={slot.value} value={slot.value}>
                {slot.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="shrink-0"
          aria-label={`Remove ${row.item.name}`}
          onClick={() => {
            healthApi.archiveSupplement(userId, row.item.id)
            toast.message(`Removed ${row.item.name}`)
            refresh()
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </li>
    )
  }

  return (
    <div className="space-y-4">
      <div className="kp-surface p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <Pill className="h-4 w-4 text-primary" />
          <p className="text-xs text-muted-foreground">{kind === 'vitamin' ? 'Vitamins' : 'Supplements'}</p>
        </div>
        <h3 className="font-display text-xl tracking-tight">Daily checklist</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {checklist.length === 0
            ? 'Add what you take, then check them off by time of day.'
            : `${takenCount} of ${checklist.length} taken · ${logDate}`}
        </p>

        {checklist.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title={kind === 'vitamin' ? 'No vitamins yet' : 'No supplements yet'}
              description={
                kind === 'vitamin'
                  ? 'Vitamin D, B12, a multivitamin — set morning, afternoon, or evening.'
                  : 'Creatine, fish oil, protein — set morning, afternoon, or evening.'
              }
            />
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {groups.map((group) => (
              <div key={group.value}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                <ul className="space-y-2">{group.rows.map(renderRow)}</ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={addItem} className="kp-surface space-y-3 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Catalog</p>
          <h3 className="font-display text-lg tracking-tight">
            Add {kind === 'vitamin' ? 'a vitamin' : 'a supplement'}
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder={kind === 'vitamin' ? 'Name (e.g. Vitamin D)' : 'Name (e.g. Creatine)'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Supplement name"
          />
          <Input
            placeholder="Dose notes (optional)"
            value={doseNotes}
            onChange={(e) => setDoseNotes(e.target.value)}
            aria-label="Dose notes"
          />
        </div>
        <div className="max-w-xs">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Time of day</p>
          <Select value={timeOfDay} onValueChange={(v) => setTimeOfDay(v as SupplementTimeOfDay)}>
            <SelectTrigger aria-label="Time of day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPLEMENT_TIMES.map((slot) => (
                <SelectItem key={slot.value} value={slot.value}>
                  {slot.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={!name.trim()}>
          Add to checklist
        </Button>
      </form>
    </div>
  )
}
