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
import { computeLocalStreaks } from '@/lib/social/streaks'
import {
  buildHealthStreakShareCard,
  buildHydrationShareCard,
  isStreakMilestone,
  offerShareWin,
} from '@/lib/social/share-win'
import { healthApi, WATER_GOAL_GLASSES } from '../api'
import { CardioPanel } from '../components/CardioPanel'
import { LiftTrackingPanel } from '../components/LiftTrackingPanel'
import { NutritionPanel } from '../components/NutritionPanel'
import { VitaminsPanel } from '../components/VitaminsPanel'
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
      const { waterStreak } = computeLocalStreaks(userId)
      if (isStreakMilestone(waterStreak)) {
        offerShareWin(
          buildHealthStreakShareCard({
            kind: 'water',
            streak: waterStreak,
            detail: `${water.glasses} glasses today`,
          }),
        )
      } else {
        offerShareWin(buildHydrationShareCard(water.glasses))
      }
    }
  }, [water.glasses, logDate, userId])

  const waterStatusCopy = (() => {
    if (waterGoalMet) return 'Cheers! You’re hydrated — Circles streak is locked for today.'
    if (water.glasses <= 0) {
      return `Hit ${WATER_GOAL_GLASSES} glasses to keep your hydration streak for Circles.`
    }
    const left = WATER_GOAL_GLASSES - water.glasses
    if (left === 1) return 'One more glass — almost cheers!'
    return `${left} glasses left to lock your hydration streak.`
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
    const hrs = Number(hours) || 0
    healthApi.addSleep(userId, {
      hours: hrs,
      quality,
      date: logDate,
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
    refresh()
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader title="Health and Fitness" description="Lift, move, fuel, and rest." eyebrow="Life" />

      <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
        <Input
          type="date"
          value={logDate}
          onChange={(e) => setLogDate(e.target.value)}
          className="max-w-full min-w-0 sm:w-auto"
          aria-label="Log date"
        />
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
        className="relative mb-6 overflow-hidden rounded-[1.25rem] border border-border/70 p-5 transition-[border-color,box-shadow] duration-500"
        style={{
          borderColor:
            waterProgress > 0
              ? `rgb(20 184 166 / ${0.2 + waterProgress * 0.35})`
              : undefined,
          boxShadow:
            waterProgress > 0.2
              ? `0 8px 28px rgb(14 116 144 / ${waterProgress * 0.1})`
              : undefined,
        }}
      >
        {/* Base surface — always opaque enough for readable text */}
        <div className="pointer-events-none absolute inset-0 bg-card" />
        {/* Soft teal wash — capped so type stays readable */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-300/50 via-sky-300/35 to-cyan-200/30 transition-opacity duration-500"
          style={{ opacity: waterProgress * 0.55 }}
          aria-hidden
        />
        <div className="relative z-10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="min-w-0 rounded-xl bg-background/80 px-3 py-2 shadow-sm ring-1 ring-border/40 backdrop-blur-[2px]">
              <p className="text-sm font-medium text-foreground">
                Water · {logDate === todayKey() ? 'today' : logDate}
                {waterGoalMet ? ' · goal hit' : ''}
              </p>
              <p className="font-display text-3xl tracking-tight text-foreground">
                {water.glasses}
                <span className="ml-1 text-lg font-sans font-medium text-foreground/70">
                  / {WATER_GOAL_GLASSES} glasses
                </span>
              </p>
              <p
                className={cn(
                  'mt-1 min-h-[2.75rem] text-sm leading-snug text-foreground/85',
                  waterGoalMet && 'font-semibold text-foreground',
                )}
              >
                {waterStatusCopy}
              </p>
            </div>
            <Button
              size="lg"
              className={cn(
                'h-11 w-full shrink-0 gap-2 sm:w-auto sm:justify-self-end',
                waterGoalMet && 'bg-teal-700 text-white hover:bg-teal-800',
              )}
              onClick={() => {
                healthApi.addGlass(userId, logDate)
                refresh()
              }}
            >
              <Plus className="h-4 w-4" />
              Log a glass
            </Button>
          </div>
          <div className="mt-4 flex min-h-10 flex-wrap gap-2">
            {Array.from({ length: Math.max(WATER_GOAL_GLASSES, water.glasses) }, (_, i) => {
              const filled = i < water.glasses
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
                    'flex h-10 w-8 items-end justify-center rounded-b-md rounded-t-lg border-2 transition-colors duration-500',
                    !filled && 'border-border/60 bg-secondary/50 hover:border-sky-400/40',
                  )}
                  style={
                    filled
                      ? {
                          borderColor: `rgb(13 148 136 / ${0.45 + fillStrength * 0.4})`,
                          backgroundColor: `rgb(45 212 191 / ${0.3 + fillStrength * 0.35})`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={cn('mb-1 h-5 w-4 rounded-sm transition-colors duration-500', !filled && 'bg-transparent')}
                    style={
                      filled
                        ? { backgroundColor: `rgb(15 118 110 / ${0.55 + fillStrength * 0.4})` }
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
              className="shrink-0 bg-background/70"
              onClick={() => {
                healthApi.setWater(userId, water.glasses - 1, logDate)
                refresh()
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-xs text-foreground/70">Adjust count</span>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 bg-background/70"
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
          <TabsTrigger value="vitamins">Vitamins</TabsTrigger>
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

        <TabsContent value="vitamins" className="space-y-4">
          <VitaminsPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} />
        </TabsContent>

        <TabsContent value="sleep" className="space-y-4">
          <form onSubmit={addSleep} className="kp-surface grid gap-3 p-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <p className="text-xs text-muted-foreground">Sleep</p>
              <h3 className="font-display text-xl tracking-tight">Log last night</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Hours and how it felt — same calm log style as water and meals.
              </p>
            </div>
            <Input type="number" step="0.5" min={0} placeholder="Hours" value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Hours slept" />
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
            <Button type="submit">Log sleep</Button>
          </form>
          {sleep.length === 0 ? (
            <EmptyState
              title="No sleep logs yet"
              description="Log hours and quality above when you wake — it feeds your week review."
            />
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
