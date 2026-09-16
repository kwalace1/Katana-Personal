import { FormEvent, useMemo, useRef, useState } from 'react'
import { Moon, Trash2, Watch } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { burstConfetti } from '@/lib/celebrate'
import { useAuth } from '@/contexts/AuthContext'
import { computeLocalStreaks } from '@/lib/social/streaks'
import { buildHealthStreakShareCard, isStreakMilestone, offerShareWin } from '@/lib/social/share-win'
import { healthApi } from '../api'
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

  const computedHours = hoursBetweenTimes(bedtime, wake)

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
        refresh()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t read that file')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="kp-surface space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Watch className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Apple Watch & Fitbit</p>
            <h3 className="font-display text-lg tracking-tight">Bring sleep in from your watch</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Live Apple Health sync needs the native app. On the web, import an Apple Health export or
              Fitbit sleep CSV — or connect Fitbit in Settings → Connections (Plus).
            </p>
            {lastImportAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
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
              className="mt-3"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
            >
              {importing ? 'Importing…' : 'Import Health or Fitbit file'}
            </Button>
          </div>
        </div>
      </div>

      <form
        className="kp-surface grid gap-3 p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault()
          const g = Number(goal) || 8
          onSaveSchedule({
            goalHours: g,
            targetBedtime: schedBed,
            targetWake: schedWake,
          })
          toast.success('Sleep schedule saved')
        }}
      >
        <div className="sm:col-span-3">
          <p className="text-xs text-muted-foreground">Schedule</p>
          <h3 className="font-display text-lg tracking-tight">Target night</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {weekAvg == null
              ? `Aim for ${goalHours}h. Log nights to see your weekly average.`
              : `This week ${weekAvg}h avg · goal ${goalHours}h`}
          </p>
        </div>
        <Input type="time" value={schedBed} onChange={(e) => setSchedBed(e.target.value)} aria-label="Target bedtime" />
        <Input type="time" value={schedWake} onChange={(e) => setSchedWake(e.target.value)} aria-label="Target wake" />
        <Input
          type="number"
          min={4}
          max={12}
          step={0.5}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          aria-label="Goal hours"
        />
        <Button type="submit" variant="outline" className="sm:col-span-3">
          Save schedule
        </Button>
      </form>

      <form onSubmit={addSleep} className="kp-surface grid gap-3 p-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Sleep</p>
          </div>
          <h3 className="font-display text-xl tracking-tight">Log last night</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Bedtime to wake — hours fill in for you
            {computedHours != null ? ` (${computedHours}h)` : ''}.
          </p>
        </div>
        <Input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} aria-label="Bedtime" />
        <Input type="time" value={wake} onChange={(e) => setWake(e.target.value)} aria-label="Wake time" />
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
        <Button type="submit" className="sm:col-span-3">
          Log sleep
        </Button>
      </form>

      {sleep.length === 0 ? (
        <EmptyState
          title="No sleep logs yet"
          description="Import from your watch or log bedtime and wake when you get up."
        />
      ) : (
        <ul className="space-y-2">
          {sleep.map((s) => (
            <li key={s.id} className="kp-surface flex items-center justify-between p-4">
              <div>
                <p className="font-medium">
                  {s.hours} hours · {s.quality}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.date}
                  {s.bedtime && s.wake ? ` · ${s.bedtime} → ${s.wake}` : ''}
                  {s.source === 'apple_health' ? ' · Apple Health' : s.source === 'fitbit' ? ' · Fitbit' : ''}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete sleep log"
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
      )}
    </div>
  )
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
