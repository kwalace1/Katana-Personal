import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Dumbbell,
  Footprints,
  Minus,
  Moon,
  Pill,
  Plus,
  Salad,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { DietPlansPanel } from '../components/DietPlansPanel'
import { VitaminsPanel } from '../components/VitaminsPanel'
import { SleepPanel } from '../components/SleepPanel'
import { cn } from '@/lib/utils'

const QUICK = [
  { id: 'lift', label: 'Log lift', icon: Dumbbell },
  { id: 'workouts', label: 'Cardio', icon: Footprints },
  { id: 'nutrition', label: 'Meal', icon: Salad },
  { id: 'vitamins', label: 'Vitamins', icon: Pill },
  { id: 'sleep', label: 'Sleep', icon: Moon },
] as const

const FITNESS_TABS = [
  { id: 'lift', label: 'Lift' },
  { id: 'splits', label: 'Splits' },
  { id: 'progress', label: 'Progress' },
  { id: 'workouts', label: 'Cardio' },
] as const

const WELLNESS_TABS = [
  { id: 'overview', label: 'Today' },
  { id: 'weight', label: 'Weight' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'nutrition', label: 'Diet' },
  { id: 'vitamins', label: 'Vitamins' },
  { id: 'supplements', label: 'Supplements' },
] as const

type HealthTab =
  | (typeof FITNESS_TABS)[number]['id']
  | (typeof WELLNESS_TABS)[number]['id']
type HealthArea = 'fitness' | 'wellness'

function areaForTab(tab: HealthTab): HealthArea {
  return FITNESS_TABS.some((item) => item.id === tab) ? 'fitness' : 'wellness'
}

function parseHealthTab(value: string | null): HealthTab {
  const all = [...FITNESS_TABS, ...WELLNESS_TABS] as readonly { id: HealthTab }[]
  return all.some((item) => item.id === value) ? (value as HealthTab) : 'overview'
}

export default function HealthPage() {
  const { user, profile, updatePreferences } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const { cloudUser, syncStreaksToCloud } = useCloudAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const healthTab = parseHealthTab(searchParams.get('tab'))
  const requestedArea = searchParams.get('area')
  const healthArea: HealthArea =
    requestedArea === 'fitness' || requestedArea === 'wellness'
      ? requestedArea
      : areaForTab(healthTab)

  function setHealthTab(next: string) {
    const tab = parseHealthTab(next)
    const params = new URLSearchParams(searchParams)
    params.set('tab', tab)
    params.set('area', areaForTab(tab))
    setSearchParams(params, { replace: true })
  }

  function setHealthArea(area: HealthArea) {
    const params = new URLSearchParams(searchParams)
    const nextTab = area === 'fitness' ? 'lift' : 'overview'
    params.set('area', area)
    params.set('tab', nextTab)
    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    if (!cloudUser) return
    const t = window.setTimeout(() => {
      void syncStreaksToCloud().catch(() => {})
    }, 800)
    return () => window.clearTimeout(t)
  }, [cloudUser, tick, syncStreaksToCloud])
  const [range, setRange] = useState<7 | 30>(7)
  const [logDate, setLogDate] = useState(todayKey())
  const [dietSection, setDietSection] = useState<'meals' | 'plans'>('meals')

  const water = useMemo(() => {
    void tick
    return healthApi.getWater(userId, logDate)
  }, [userId, logDate, tick])

  const waterGoalMet = water.glasses >= WATER_GOAL_GLASSES
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

  const waterSeries = useMemo(() => healthApi.waterSeries(userId, range).map((d) => d.glasses), [userId, range, tick])
  const sleepSeries = useMemo(() => healthApi.sleepSeries(userId, range).map((d) => d.hours), [userId, range, tick])
  const workoutSeries = useMemo(
    () => healthApi.workoutMinutesSeries(userId, range).map((d) => d.minutes),
    [userId, range, tick],
  )

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        title={healthArea === 'fitness' ? 'Fitness' : 'Wellness'}
        description={
          healthArea === 'fitness'
            ? 'Train, follow your split, and see what is getting stronger.'
            : 'Weight, rest, fuel, and supplements.'
        }
        eyebrow="Health & Wellness"
      />

      <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
        <Input
          type="date"
          value={logDate}
          onChange={(e) => setLogDate(e.target.value)}
          className="max-w-full min-w-0 sm:w-auto"
          aria-label="Log date"
        />
        {logDate !== todayKey() ? (
          <Button size="sm" variant="ghost" onClick={() => setLogDate(todayKey())}>
            Jump to today
          </Button>
        ) : null}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-secondary/50 p-1">
        <Button
          type="button"
          variant={healthArea === 'fitness' ? 'default' : 'ghost'}
          className="rounded-xl"
          onClick={() => setHealthArea('fitness')}
        >
          Fitness
        </Button>
        <Button
          type="button"
          variant={healthArea === 'wellness' ? 'default' : 'ghost'}
          className="rounded-xl"
          onClick={() => setHealthArea('wellness')}
        >
          Wellness
        </Button>
      </div>

      <Tabs value={healthTab} onValueChange={setHealthTab}>
        <TabsList fluid className="mb-1 w-full max-w-full">
          {(healthArea === 'fitness' ? FITNESS_TABS : WELLNESS_TABS).map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div
            ref={waterBoxRef}
            className="relative overflow-hidden rounded-[1.25rem] border border-border/70 p-5 transition-[border-color,box-shadow] duration-500"
            style={{
              borderColor:
                waterProgress > 0 ? `rgb(20 184 166 / ${0.2 + waterProgress * 0.35})` : undefined,
              boxShadow:
                waterProgress > 0.2 ? `0 8px 28px rgb(14 116 144 / ${waterProgress * 0.1})` : undefined,
            }}
          >
            <div className="pointer-events-none absolute inset-0 bg-card" />
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
                        className={cn(
                          'mb-1 h-5 w-4 rounded-sm transition-colors duration-500',
                          !filled && 'bg-transparent',
                        )}
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

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">This week at a glance</p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={range === 7 ? 'default' : 'outline'}
                  className="h-8 rounded-full"
                  onClick={() => setRange(7)}
                >
                  7d
                </Button>
                <Button
                  size="sm"
                  variant={range === 30 ? 'default' : 'outline'}
                  className="h-8 rounded-full"
                  onClick={() => setRange(30)}
                >
                  30d
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="kp-surface p-4">
                <MiniBars values={waterSeries} label={`Water · ${range}d`} maxHint={8} />
              </div>
              <div className="kp-surface p-4">
                <MiniBars values={sleepSeries} label={`Sleep hrs · ${range}d`} maxHint={10} />
              </div>
              <div className="kp-surface p-4">
                <MiniBars values={workoutSeries} label={`Move min · ${range}d`} maxHint={60} />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Log something</p>
            <div className="flex flex-wrap gap-2">
              {QUICK.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-full"
                  onClick={() => setHealthTab(id)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

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

        {/* Lift log only mounts on Lift — draft still autosaves to this device */}
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
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/50 p-1">
            <Button
              type="button"
              variant={dietSection === 'meals' ? 'default' : 'ghost'}
              className="rounded-xl"
              onClick={() => setDietSection('meals')}
            >
              Meals
            </Button>
            <Button
              type="button"
              variant={dietSection === 'plans' ? 'default' : 'ghost'}
              className="rounded-xl"
              onClick={() => setDietSection('plans')}
            >
              Plans
            </Button>
          </div>
          {dietSection === 'plans' ? (
            <DietPlansPanel userId={userId} tick={tick} refresh={refresh} />
          ) : (
            <NutritionPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} />
          )}
        </TabsContent>

        <TabsContent value="vitamins" className="space-y-4">
          <VitaminsPanel
            userId={userId}
            logDate={logDate}
            tick={tick}
            refresh={refresh}
            kind="vitamin"
          />
        </TabsContent>

        <TabsContent value="supplements" className="space-y-4">
          <VitaminsPanel
            userId={userId}
            logDate={logDate}
            tick={tick}
            refresh={refresh}
            kind="supplement"
          />
        </TabsContent>

        <TabsContent value="sleep" className="space-y-4">
          <SleepPanel
            userId={userId}
            logDate={logDate}
            tick={tick}
            refresh={refresh}
            goalHours={Number(profile?.preferences.sleep_goal_hours) || 8}
            targetBedtime={String(profile?.preferences.sleep_bedtime || '22:30')}
            targetWake={String(profile?.preferences.sleep_wake || '06:30')}
            onSaveSchedule={({ goalHours, targetBedtime, targetWake }) => {
              updatePreferences({
                sleep_goal_hours: goalHours,
                sleep_bedtime: targetBedtime,
                sleep_wake: targetWake,
              })
            }}
          />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
