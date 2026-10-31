import { FormEvent, useMemo, useRef, useState } from 'react'
import { Moon, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { burstConfetti } from '@/lib/celebrate'
import { useAuth } from '@/contexts/AuthContext'
import { computeLocalStreaks } from '@/lib/social/streaks'
import { buildHealthStreakShareCard, isStreakMilestone, offerShareWin } from '@/lib/social/share-win'
import { healthApi } from '../api'
import { HealthFieldLabel } from './health-ui'
import { formatLiftDate } from './lift/LiftLineChart'
import { parseHealthExportFile } from '../health-import'
import { hoursBetweenTimes } from '../sleep-import'
import type { SleepLog } from '../types'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
  goalHours: number
  targetBedtime: string
  targetWake: string
  onSaveSchedule: (next: { goalHours: number; targetBedtime: string; targetWake: string }) => void
}

export function SleepPanel({
  userId,
  logDate,
  tick,
  refresh,
  goalHours,
  targetBedtime,
  targetWake,
  onSaveSchedule,
}: Props) {
  const { updatePreferences, profile } = useAuth()

  const sleep = useMemo(() => {
    void tick
    return healthApi.listSleep(userId)
  }, [userId, tick])

  const lastImportAt =
    typeof profile?.preferences?.lastHealthImportAt === 'string'
      ? profile.preferences.lastHealthImportAt
      : null
  const importStale = lastImportAt
    ? Date.now() - new Date(lastImportAt).getTime() > 7 * 86400000
    : sleep.length > 0

  const fileRef = useRef<HTMLInputElement>(null)
  const [bedtime, setBedtime] = useState(targetBedtime || '22:30')
  const [wake, setWake] = useState(targetWake || '06:30')
  const [quality, setQuality] = useState<SleepLog['quality']>('good')
  const [importing, setImporting] = useState(false)
  const [goal, setGoal] = useState(String(goalHours || 8))
  const [schedBed, setSchedBed] = useState(targetBedtime || '22:30')
  const [schedWake, setSchedWake] = useState(targetWake || '06:30')
  const [view, setView] = useState<'summary' | 'log' | 'schedule' | 'import'>('summary')

  const computedHours = hoursBetweenTimes(bedtime, wake)
  const loggedTonight = useMemo(() => {
    return sleep
      .filter((entry) => entry.date === logDate)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  }, [sleep, logDate])
  const savedSchedule = profile?.preferences
  const hasSavedSchedule = Boolean(
    savedSchedule?.['sleep_bedtime'] || savedSchedule?.['sleep_wake'] || savedSchedule?.['sleep_goal_hours'],
  )

  const weekAvg = useMemo(() => {
    const last7 = sleep.filter((s) => s.date >= weekAgoKey())
    if (last7.length === 0) return null
    return Math.round((last7.reduce((sum, s) => sum + s.hours, 0) / last7.length) * 10) / 10
  }, [sleep])

  function addSleep(e: FormEvent) {
    e.preventDefault()
    const hrs = computedHours ?? 0
    if (hrs <= 0) {
      toast.error('Set bedtime and wake so we can count the hours')
      return
    }
    healthApi.addSleep(userId, {
      hours: hrs,
      quality,
      date: logDate,
      bedtime,
      wake,
      source: 'manual',
    })
    if (hrs >= 7) {
      const { sleepStreak } = computeLocalStreaks(userId)
      if (isStreakMilestone(sleepStreak)) {
        burstConfetti()
        offerShareWin(
          buildHealthStreakShareCard({
            kind: 'sleep',
            streak: sleepStreak,
            detail: `${hrs}h · ${quality}`,
          }),
        )
      }
    }
    toast.success(`Logged ${hrs}h sleep`)
    setView('summary')
    refresh()
  }

  async function onImport(file: File | null) {
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const { sleepNights, workouts } = parseHealthExportFile(file.name, text)
      const sleepAdded = healthApi.importSleepNights(userId, sleepNights)
      const workoutAdded = healthApi.importWorkouts(userId, workouts)
      const total = sleepAdded + workoutAdded
      if (total === 0) {
        toast.message(
          sleepNights.length || workouts.length
            ? 'Those records are already logged'
            : 'No sleep or workout records in that file',
        )
      } else {
        updatePreferences({ lastHealthImportAt: new Date().toISOString() })
        const bits = []
        if (sleepAdded) bits.push(`${sleepAdded} night${sleepAdded === 1 ? '' : 's'}`)
        if (workoutAdded) bits.push(`${workoutAdded} workout${workoutAdded === 1 ? '' : 's'}`)
        toast.success(`Imported ${bits.join(' and ')}`)
        setView('summary')
        refresh()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t read that file')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const scheduleLabel = hasSavedSchedule ? 'Edit schedule' : 'Schedule'

  return (
    <div className="space-y-3">
      {view === 'summary' && !loggedTonight && sleep.length === 0 ? (
        <EmptyState
          compact
          plain
          icon={Moon}
          title="Log last night"
          description="A bedtime and wake time is enough to start a sleep history."
          action={
            <>
              <Button type="button" className="gap-1.5" onClick={() => setView('log')}>
                <Plus className="h-4 w-4" />
                Log sleep
              </Button>
              <Button type="button" variant="outline" onClick={() => setView('schedule')}>
                {scheduleLabel}
              </Button>
              <Button type="button" variant="outline" onClick={() => setView('import')}>
                Import data
              </Button>
            </>
          }
        />
      ) : null}

      {view === 'summary' && !loggedTonight && sleep.length > 0 ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setView('log')}>
              <Plus className="h-4 w-4" />
              Log sleep
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setView('schedule')}>
              {scheduleLabel}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setView('import')}>
              Import data
            </Button>
          </div>
          <EmptyState
            compact
            plain
            className="px-0"
            title={`No sleep for ${formatLiftDate(logDate)}`}
            description="Log this night, or pick another date."
          />
        </div>
      ) : null}

      {view === 'summary' && loggedTonight ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setView('log')}>
              Log sleep
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setView('schedule')}>
              {scheduleLabel}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setView('import')}>
              Import data
            </Button>
          </div>
          <div>
            <h3 className="font-display text-lg tracking-tight">{loggedTonight.hours} hours</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{sleepDetail(loggedTonight)}</p>
          </div>
          {weekAvg != null ? (
            <p className="text-sm text-muted-foreground">
              This week {weekAvg}h avg · goal {goalHours}h
            </p>
          ) : null}
        </>
      ) : null}

      {view === 'summary' && sleep.length > 0 ? (
        <div>
          <h3 className="mb-3 font-display text-lg tracking-tight">Sleep history</h3>
          <ul className="divide-y border-t border-border">
            {sleep.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    {s.hours} hours · {qualityLabel(s.quality)}
                  </p>
                  <p className="text-xs text-muted-foreground">{sleepMeta(s)}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${s.hours} hours on ${formatLiftDate(s.date)}`}
                  onClick={() => {
                    healthApi.removeSleep(userId, s.id)
                    refresh()
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {view === 'log' ? (
        <form onSubmit={addSleep} className="kp-surface space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg tracking-tight">Log sleep</h3>
            <Button type="button" size="sm" variant="ghost" onClick={() => setView('summary')}>
              Cancel
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatLiftDate(logDate)}. Bedtime to wake — hours fill in for you
            {computedHours != null ? ` (${computedHours}h)` : ''}.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <HealthFieldLabel>Bedtime</HealthFieldLabel>
              <Input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} aria-label="Bedtime" />
            </div>
            <div>
              <HealthFieldLabel>Wake time</HealthFieldLabel>
              <Input type="time" value={wake} onChange={(e) => setWake(e.target.value)} aria-label="Wake time" />
            </div>
            <div>
              <HealthFieldLabel>Quality</HealthFieldLabel>
              <Select value={quality} onValueChange={(v) => setQuality(v as SleepLog['quality'])}>
                <SelectTrigger aria-label="Sleep quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="great">Great</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit">Log sleep</Button>
        </form>
      ) : null}

      {view === 'schedule' ? (
        <form
          className="kp-surface space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault()
            const g = Number(goal) || 8
            onSaveSchedule({
              goalHours: g,
              targetBedtime: schedBed,
              targetWake: schedWake,
            })
            toast.success('Sleep schedule saved')
            setView('summary')
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg tracking-tight">{scheduleLabel}</h3>
            <Button type="button" size="sm" variant="ghost" onClick={() => setView('summary')}>
              Cancel
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {weekAvg == null
              ? `Aim for ${goalHours}h. Log nights to see your weekly average.`
              : `This week ${weekAvg}h avg · goal ${goalHours}h`}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <HealthFieldLabel>Target bedtime</HealthFieldLabel>
              <Input type="time" value={schedBed} onChange={(e) => setSchedBed(e.target.value)} aria-label="Target bedtime" />
            </div>
            <div>
              <HealthFieldLabel>Target wake</HealthFieldLabel>
              <Input type="time" value={schedWake} onChange={(e) => setSchedWake(e.target.value)} aria-label="Target wake" />
            </div>
            <div>
              <HealthFieldLabel>Goal hours</HealthFieldLabel>
              <Input
                type="number"
                min={4}
                max={12}
                step={0.5}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                aria-label="Goal hours"
              />
            </div>
          </div>
          <Button type="submit" variant="outline">
            Save schedule
          </Button>
        </form>
      ) : null}

      {view === 'import' ? (
        <div className="kp-surface space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg tracking-tight">Import data</h3>
            <Button type="button" size="sm" variant="ghost" onClick={() => setView('summary')}>
              Cancel
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Import an Apple Health export or a Fitbit sleep CSV. This does not connect a live account.
          </p>
          <details className="border-t border-border pt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">How to export</summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4">
              <li>
                <span className="font-medium text-foreground">Apple Health:</span> Health app → profile
                picture → Export All Health Data → unzip → pick{' '}
                <code className="text-[10px]">export.xml</code>.
              </li>
              <li>
                <span className="font-medium text-foreground">Fitbit:</span> Fitbit account / data export
                → sleep CSV (or download sleep history) → import the .csv here.
              </li>
            </ol>
          </details>
          {lastImportAt ? (
            <p className="text-xs text-muted-foreground">
              Last imported {formatImportWhen(lastImportAt)}.
              {importStale ? ' A fresh export keeps orchestration accurate — re-import when you can.' : ''}
            </p>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept=".xml,.csv,text/xml,text/csv"
            className="hidden"
            onChange={(e) => void onImport(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? 'Importing…' : 'Import file'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function qualityLabel(quality: SleepLog['quality']) {
  return quality.charAt(0).toUpperCase() + quality.slice(1)
}

function sleepMeta(entry: SleepLog) {
  const source =
    entry.source === 'apple_health' ? ' · Apple Health' : entry.source === 'fitbit' ? ' · Fitbit' : ''
  const times = entry.bedtime && entry.wake ? ` · ${entry.bedtime} → ${entry.wake}` : ''
  return `${formatLiftDate(entry.date)}${times}${source}`
}

function sleepDetail(entry: SleepLog) {
  return `${sleepMeta(entry)} · ${qualityLabel(entry.quality)}`
}

function weekAgoKey() {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatImportWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}
