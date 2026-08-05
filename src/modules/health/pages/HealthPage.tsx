import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { MiniBars } from '@/components/MiniBars'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { todayKey } from '@/lib/dates'
import { burstConfetti } from '@/lib/celebrate'
import { healthApi, WATER_GOAL_GLASSES } from '../api'
import { CardioPanel } from '../components/CardioPanel'
import { LiftTrackingPanel } from '../components/LiftTrackingPanel'
import { NutritionPanel } from '../components/NutritionPanel'
import type { SleepLog } from '../types'
import { cn } from '@/lib/utils'

export default function HealthPage() {
  const { user } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const { cloudUser, syncStreaksToCloud } = useCloudAuth()
  const [healthTab, setHealthTab] = useState('overview')

  useEffect(() => {
    if (!cloudUser) return
    const t = window.setTimeout(() => {
      void syncStreaksToCloud().catch(() => {})
    }, 800)
    return () => window.clearTimeout(t)
  }, [cloudUser, tick, syncStreaksToCloud])
  const [range, setRange] = useState<7 | 30>(7)
  const [logDate, setLogDate] = useState(todayKey())

  const water = useMemo(() => {
    void tick
    return healthApi.getWater(userId, logDate)
  }, [userId, logDate, tick])

  const waterGoalMet = water.glasses >= WATER_GOAL_GLASSES
  /** 0 → base UI, 1 → full cheers teal (ramps with each glass). */
  const waterProgress = Math.min(1, Math.max(0, water.glasses / WATER_GOAL_GLASSES))
  const waterBoxRef = useRef<HTMLDivElement>(null)
  const prevGlassesRef = useRef(water.glasses)
  const waterDateRef = useRef(logDate)

  useEffect(() => {
    if (waterDateRef.current !== logDate) {
      waterDateRef.current = logDate
      prevGlassesRef.current = water.glasses
      return
    }
    const prev = prevGlassesRef.current
    prevGlassesRef.current = water.glasses
    if (prev < WATER_GOAL_GLASSES && water.glasses >= WATER_GOAL_GLASSES) {
      burstConfetti(waterBoxRef.current)
      toast.success('Hydration goal crushed!', {
        description: 'Cheers — streak locked in for Circles.',
        duration: 2800,
      })
    }
  }, [water.glasses, logDate])

  const waterStatusCopy = (() => {
    if (waterGoalMet) return 'Cheers! You’re hydrated — Circles streak is locked for today.'
    if (water.glasses <= 0) {
      return `Hit ${WATER_GOAL_GLASSES} glasses to keep your hydration streak for Circles. Log a lift under Lift to keep your lift streak.`
    }
    const left = WATER_GOAL_GLASSES - water.glasses
    if (water.glasses === 1) return 'Nice start — keep sipping.'
    if (left === 1) return 'One more glass — almost cheers!'
    if (waterProgress < 0.5) return `Building up — ${left} to go.`
    return `Getting close — ${left} left to lock your streak.`
  })()

  const sleep = useMemo(() => {
    void tick
    return healthApi.listSleep(userId)
  }, [userId, tick])

  const waterSeries = useMemo(() => healthApi.waterSeries(userId, range).map((d) => d.glasses), [userId, range, tick])
  const sleepSeries = useMemo(() => healthApi.sleepSeries(userId, range).map((d) => d.hours), [userId, range, tick])
  const workoutSeries = useMemo(
    () => healthApi.workoutMinutesSeries(userId, range).map((d) => d.minutes),
    [userId, range, tick],
  )

  const [hours, setHours] = useState('7.5')
  const [quality, setQuality] = useState<SleepLog['quality']>('good')

  function addSleep(e: FormEvent) {
    e.preventDefault()
    healthApi.addSleep(userId, {
      hours: Number(hours) || 0,
      quality,
      date: logDate,
    })
    refresh()
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader title="Health" description="Lift, move, fuel, and rest." eyebrow="Life" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="w-auto" />
        <Button size="sm" variant={range === 7 ? 'default' : 'outline'} className="rounded-full" onClick={() => setRange(7)}>
          7 days
        </Button>
        <Button size="sm" variant={range === 30 ? 'default' : 'outline'} className="rounded-full" onClick={() => setRange(30)}>
          30 days
        </Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="kp-surface p-4">
          <MiniBars values={waterSeries} label={`Water · ${range}d`} maxHint={8} />
        </div>
        <div className="kp-surface p-4">
          <MiniBars values={sleepSeries} label={`Sleep hrs · ${range}d`} maxHint={10} />
        </div>
        <div className="kp-surface p-4">
          <MiniBars values={workoutSeries} label={`Workout min · ${range}d`} maxHint={60} />
        </div>
      </div>

      <div
        ref={waterBoxRef}
        className="relative mb-6 overflow-hidden rounded-[1.25rem] border p-5 transition-[border-color,box-shadow] duration-500"
        style={{
          borderColor:
            waterProgress <= 0
              ? undefined
              : `color-mix(in srgb, rgb(45 212 191 / ${0.15 + waterProgress * 0.45}) ${waterProgress * 100}%, hsl(var(--border)))`,
          boxShadow:
            waterProgress > 0.15
              ? `0 0 0 1px rgb(45 212 191 / ${waterProgress * 0.28}), 0 8px 24px rgb(14 116 144 / ${waterProgress * 0.12})`
              : undefined,
        }}
      >
        {/* Base surface */}
        <div className="pointer-events-none absolute inset-0 bg-card/70 backdrop-blur-sm" />
        {/* Celebration wash — opacity climbs with each glass */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-400/40 via-sky-400/35 to-cyan-300/30 transition-opacity duration-500"
          style={{ opacity: waterProgress }}
          aria-hidden
        />
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p
                className="text-sm transition-colors duration-500"
                style={{
                  color:
                    waterProgress > 0.35
                      ? `color-mix(in srgb, rgb(19 78 74) ${40 + waterProgress * 60}%, hsl(var(--muted-foreground)))`
                      : undefined,
                  fontWeight: waterGoalMet ? 600 : undefined,
                }}
              >
                <span className={waterProgress <= 0.35 ? 'text-muted-foreground' : undefined}>
                  Water · {logDate === todayKey() ? 'today' : logDate}
                  {waterGoalMet ? ' · goal hit' : water.glasses > 0 ? ` · ${Math.round(waterProgress * 100)}%` : ''}
                </span>
              </p>
              <p
                className="font-display text-3xl tracking-tight transition-colors duration-500"
                style={{
                  color:
                    waterProgress > 0.4
                      ? `color-mix(in srgb, rgb(4 47 46) ${waterProgress * 100}%, hsl(var(--foreground)))`
                      : undefined,
                }}
              >
                {water.glasses}
                <span
                  className={cn(
                    'ml-1 text-lg font-sans font-medium transition-colors duration-500',
                    waterProgress <= 0.4 && 'text-muted-foreground',
                  )}
                  style={
                    waterProgress > 0.4
                      ? {
                          color: `color-mix(in srgb, rgb(17 94 89) ${50 + waterProgress * 50}%, hsl(var(--muted-foreground)))`,
                        }
                      : undefined
                  }
                >
                  / {WATER_GOAL_GLASSES} glasses
                </span>
              </p>
              <p
                className={cn(
                  'mt-1 text-xs transition-colors duration-500',
                  waterProgress <= 0.35 && 'text-muted-foreground',
                  waterGoalMet && 'font-medium',
                )}
                style={
                  waterProgress > 0.35
                    ? {
                        color: `color-mix(in srgb, rgb(19 78 74) ${35 + waterProgress * 65}%, hsl(var(--muted-foreground)))`,
                      }
                    : undefined
                }
              >
                {waterStatusCopy}
              </p>
            </div>
            <Button
              size="lg"
              className="gap-2 transition-colors duration-500"
              style={
                waterProgress > 0.2
                  ? {
                      backgroundColor: `color-mix(in srgb, rgb(15 118 110) ${waterProgress * 100}%, hsl(var(--primary)))`,
                      color: waterProgress > 0.45 ? '#fff' : undefined,
                    }
                  : undefined
              }
              onClick={() => {
                healthApi.addGlass(userId, logDate)
                refresh()
              }}
            >
              <Plus className="h-4 w-4" />
              Log a glass
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: Math.max(WATER_GOAL_GLASSES, water.glasses) }, (_, i) => {
              const filled = i < water.glasses
              // Each filled glass intensifies with overall progress
              const fillStrength = filled ? Math.min(1, (i + 1) / WATER_GOAL_GLASSES) : 0
              return (
                <button
                  key={i}
                  type="button"
                  title={filled ? 'Filled — click to set count' : 'Empty — log up to here'}
                  onClick={() => {
                    healthApi.setWater(userId, i + 1, logDate)
                    refresh()
                  }}
                  className={cn(
                    'flex h-10 w-8 items-end justify-center rounded-b-md rounded-t-lg border-2 transition-all duration-500',
                    !filled && 'border-border/60 bg-secondary/40 hover:border-sky-400/40',
                  )}
                  style={
                    filled
                      ? {
                          borderColor: `color-mix(in srgb, rgb(13 148 136) ${30 + fillStrength * 70}%, rgb(14 165 233))`,
                          backgroundColor: `color-mix(in srgb, rgb(45 212 191 / ${0.25 + fillStrength * 0.35}) ${fillStrength * 100}%, rgb(56 189 248 / 0.35))`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={cn('mb-1 h-5 w-4 rounded-sm transition-colors duration-500', !filled && 'bg-transparent')}
                    style={
                      filled
                        ? {
                            backgroundColor: `color-mix(in srgb, rgb(13 148 136) ${fillStrength * 100}%, rgb(14 165 233))`,
                          }
                        : undefined
                    }
                  />
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="transition-colors duration-500"
              style={
                waterProgress > 0.4
                  ? {
                      borderColor: `rgb(15 118 110 / ${0.25 + waterProgress * 0.25})`,
                      backgroundColor: `rgb(255 255 255 / ${0.25 + waterProgress * 0.2})`,
                    }
                  : undefined
              }
              onClick={() => {
                healthApi.setWater(userId, water.glasses - 1, logDate)
                refresh()
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span
              className={cn('text-xs transition-colors duration-500', waterProgress <= 0.35 && 'text-muted-foreground')}
              style={
                waterProgress > 0.35
                  ? {
                      color: `color-mix(in srgb, rgb(19 78 74) ${waterProgress * 100}%, hsl(var(--muted-foreground)))`,
                    }
                  : undefined
              }
            >
              Adjust count
            </span>
            <Button
              size="sm"
              variant="outline"
              className="transition-colors duration-500"
              style={
                waterProgress > 0.4
                  ? {
                      borderColor: `rgb(15 118 110 / ${0.25 + waterProgress * 0.25})`,
                      backgroundColor: `rgb(255 255 255 / ${0.25 + waterProgress * 0.2})`,
                    }
                  : undefined
              }
              onClick={() => {
                healthApi.setWater(userId, water.glasses + 1, logDate)
                refresh()
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={healthTab} onValueChange={setHealthTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lift">Lift</TabsTrigger>
          <TabsTrigger value="splits">Splits</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="weight">Weight</TabsTrigger>
          <TabsTrigger value="workouts">Cardio</TabsTrigger>
          <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
          <TabsTrigger value="sleep">Sleep</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <LiftTrackingPanel
            userId={userId}
            logDate={logDate}
            tick={tick}
            refresh={refresh}
            panel="overview"
            onGoLift={() => setHealthTab('lift')}
            onGoSplits={() => setHealthTab('splits')}
          />
        </TabsContent>

        <TabsContent value="lift" className="space-y-4">
          <LiftTrackingPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} panel="lift" />
        </TabsContent>

        <TabsContent value="splits" className="space-y-4">
          <LiftTrackingPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} panel="splits" />
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <LiftTrackingPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} panel="progress" />
        </TabsContent>

        <TabsContent value="weight" className="space-y-4">
          <LiftTrackingPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} panel="weight" />
        </TabsContent>

        <TabsContent value="workouts" className="space-y-4">
          <CardioPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} />
        </TabsContent>

        <TabsContent value="nutrition" className="space-y-4">
          <NutritionPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} />
        </TabsContent>

        <TabsContent value="sleep" className="space-y-4">
          <form onSubmit={addSleep} className="kp-surface grid gap-3 p-4 sm:grid-cols-3">
            <Input type="number" step="0.5" min={0} placeholder="Hours" value={hours} onChange={(e) => setHours(e.target.value)} />
            <Select value={quality} onValueChange={(v) => setQuality(v as SleepLog['quality'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="poor">Poor</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="great">Great</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">Log sleep</Button>
          </form>
          {sleep.length === 0 ? (
            <EmptyState title="No sleep logs" description="Note how you rested when you can." />
          ) : (
            <ul className="space-y-2">
              {sleep.map((s) => (
                <li key={s.id} className="kp-surface flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">
                      {s.hours} hours · {s.quality}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.date}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
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
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
