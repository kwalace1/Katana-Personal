import { FormEvent, useMemo, useState } from 'react'
import { Pencil, Pill, Plus, ScanBarcode, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  buildHealthStreakShareCard,
  isStreakMilestone,
  offerShareWin,
  recordSupplementFullStackDay,
} from '@/lib/social/share-win'
import {
  applySupplementMatch,
  SUPPLEMENT_NOT_FOUND_MESSAGE,
  type SupplementMatch,
} from '@/lib/supplements/barcode'
import { healthApi, SUPPLEMENT_TIMES, supplementTimeOfDay } from '../api'
import type { SupplementChecklistRow, SupplementTimeOfDay } from '../types'
import { SupplementBarcodeDialog } from './SupplementBarcodeDialog'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
}

type View = 'summary' | 'add'

export function VitaminsPanel({ userId, logDate, tick, refresh }: Props) {
  const checklist = useMemo(() => {
    void tick
    return healthApi.getDayChecklist(userId, logDate)
  }, [userId, logDate, tick])

  const groups = useMemo(() => {
    return SUPPLEMENT_TIMES.map((slot) => ({
      ...slot,
      rows: checklist.filter((row) => supplementTimeOfDay(row.item) === slot.value),
    })).filter((group) => group.rows.length > 0)
  }, [checklist])

  const takenCount = checklist.filter((row) => row.taken).length
  const [view, setView] = useState<View>('summary')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [doseNotes, setDoseNotes] = useState('')
  const [timeOfDay, setTimeOfDay] = useState<SupplementTimeOfDay>('morning')
  const [scanOpen, setScanOpen] = useState(false)
  const [scanNote, setScanNote] = useState<string | null>(null)

  function applyScan(match: SupplementMatch) {
    const next = applySupplementMatch({ name, doseNotes, timeOfDay }, match)
    setName(next.name)
    setDoseNotes(next.doseNotes)
    setScanNote(null)
  }

  function addItem(e: FormEvent) {
    e.preventDefault()
    const row = healthApi.addSupplement(userId, {
      name,
      dose_notes: doseNotes,
      time_of_day: timeOfDay,
    })
    if (!row) {
      toast.error('Add a name')
      return
    }
    toast.success(`Added ${row.name}`)
    setName('')
    setDoseNotes('')
    setScanNote(null)
    setView('summary')
    refresh()
  }

  function renderRow(row: SupplementChecklistRow) {
    const editing = editingId === row.item.id
    return (
      <li key={row.item.id} className="py-3">
        <div className="flex items-start gap-3">
          <Checkbox
            className="mt-0.5"
            checked={row.taken}
            onCheckedChange={(value) => {
              const taken = Boolean(value)
              healthApi.toggleTaken(userId, row.item.id, logDate, taken)
              if (taken && checklist.length >= 2) {
                const allDone = checklist.every((item) => (item.item.id === row.item.id ? true : item.taken))
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
          {editing ? null : (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0"
              aria-label={`Edit ${row.item.name}`}
              onClick={() => setEditingId(row.item.id)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
        {editing ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
            <Select
              value={supplementTimeOfDay(row.item)}
              onValueChange={(value) => {
                healthApi.updateSupplement(userId, row.item.id, { time_of_day: value as SupplementTimeOfDay })
                refresh()
              }}
            >
              <SelectTrigger size="sm" className="w-[7.5rem]" aria-label={`Time of day for ${row.item.name}`}>
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
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
              Done
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove ${row.item.name}`}
              onClick={() => {
                healthApi.archiveSupplement(userId, row.item.id)
                setEditingId(null)
                toast.message(`Removed ${row.item.name}`)
                refresh()
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </li>
    )
  }

  if (view === 'add') {
    return (
      <form onSubmit={addItem} className="kp-surface space-y-3 p-4">
        <h3 className="font-display text-lg tracking-tight">Add a supplement</h3>
        <div className="space-y-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setScanOpen(true)}
          >
            <ScanBarcode className="h-4 w-4" />
            Scan barcode
          </Button>
          {scanNote ? (
            <p className="text-sm text-muted-foreground" role="status">
              {scanNote}
            </p>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Name"
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
          <Select value={timeOfDay} onValueChange={(value) => setTimeOfDay(value as SupplementTimeOfDay)}>
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
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={!name.trim()}>
            Add to checklist
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setScanNote(null)
              setView('summary')
            }}
          >
            Cancel
          </Button>
        </div>
        <SupplementBarcodeDialog
          open={scanOpen}
          onOpenChange={setScanOpen}
          onFound={applyScan}
          onNotFound={() => setScanNote(SUPPLEMENT_NOT_FOUND_MESSAGE)}
        />
      </form>
    )
  }

  if (checklist.length === 0) {
    return (
      <EmptyState
        compact
        plain
        icon={Pill}
        title="Add a supplement"
        description="Track what you take, and check it off each day."
        action={
          <Button type="button" className="gap-1.5" onClick={() => setView('add')}>
            <Plus className="h-4 w-4" />
            Add a supplement
          </Button>
        }
      />
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {takenCount} of {checklist.length} taken
        </p>
        <Button type="button" size="sm" className="gap-1.5" onClick={() => setView('add')}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.value}>
            <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
            <ul className="divide-y divide-border">{group.rows.map(renderRow)}</ul>
          </div>
        ))}
      </div>
    </div>
  )
}
