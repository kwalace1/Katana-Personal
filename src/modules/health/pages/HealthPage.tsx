import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { navItemLabel, navSectionLabel } from '@/lib/nav'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
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
import { healthApi } from '../api'
import { useWaterGoal, WaterGoalBar, WaterVolumeForm } from '../components/WaterVolumeForm'
import { amountFromMl, formatWater, mlFromAmount, waterMl } from '../water'
import { CardioPanel } from '../components/CardioPanel'
import { LiftTrackingPanel } from '../components/LiftTrackingPanel'
import { NutritionPanel } from '../components/NutritionPanel'
import { DietPlansPanel } from '../components/DietPlansPanel'
import { HealthSegmented } from '../components/health-ui'
import { VitaminsPanel } from '../components/VitaminsPanel'
import { SleepPanel } from '../components/SleepPanel'
const AREA_DESCRIPTIONS = {
  fitness: 'Train, follow your split, and see what is getting stronger.',
  wellness: 'Sleep, meals, weight, and the other signals Today uses — water included.',
} as const

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
  if (value === 'vitamins') return 'supplements'
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
  const sectionTabs = healthArea === 'fitness' ? FITNESS_TABS : WELLNESS_TABS
  const activeSection = sectionTabs.some((item) => item.id === healthTab)
    ? healthTab
    : sectionTabs[0].id

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
    if (searchParams.get('tab') === 'vitamins') {
      const params = new URLSearchParams(searchParams)
      params.set('tab', 'supplements')
      params.set('area', 'wellness')
      setSearchParams(params, { replace: true })
      return
    }
    if (sectionTabs.some((item) => item.id === healthTab)) return
    const params = new URLSearchParams(searchParams)
    params.set('tab', sectionTabs[0].id)
    params.set('area', healthArea)
    setSearchParams(params, { replace: true })
  }, [healthArea, healthTab, searchParams, sectionTabs, setSearchParams])

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
  const [waterGoal, setWaterGoal] = useWaterGoal()
  const waterAmountMl = waterMl(water)
  const waterGoalMl = Math.max(mlFromAmount(waterGoal.amount, waterGoal.unit), 1)

  const waterGoalMet = waterAmountMl >= waterGoalMl
  const waterBoxRef = useRef<HTMLDivElement>(null)
  const prevGoalMetRef = useRef(waterGoalMet)
  const waterDateRef = useRef(logDate)

  useEffect(() => {
    if (waterDateRef.current !== logDate) {
      waterDateRef.current = logDate
      prevGoalMetRef.current = waterGoalMet
      return
    }
    const prev = prevGoalMetRef.current
    prevGoalMetRef.current = waterGoalMet
    if (!prev && waterGoalMet) {
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
            detail: formatWater(waterAmountMl, waterGoal.unit),
          }),
        )
      } else {
        offerShareWin(buildHydrationShareCard(formatWater(waterAmountMl, waterGoal.unit)))
      }
    }
  }, [waterGoalMet, waterAmountMl, waterGoal.unit, logDate, userId])

  const waterStatusCopy = (() => {
    if (waterGoalMet) return 'Cheers! You’re hydrated — Circles streak is locked for today.'
    if (waterAmountMl <= 0) {
      return `Hit ${formatWater(waterGoalMl, waterGoal.unit)} to keep your hydration streak for Circles.`
    }
    return `${formatWater(waterGoalMl - waterAmountMl, waterGoal.unit)} left to lock your hydration streak.`
  })()

  const waterHistory = useMemo(() => {
    void tick
    return healthApi.waterSeries(userId, 30)
  }, [userId, tick])
  const sleepHistory = useMemo(() => {
    void tick
    return healthApi.sleepSeries(userId, 30)
  }, [userId, tick])
  const workoutHistory = useMemo(() => {
    void tick
    return healthApi.workoutMinutesSeries(userId, 30)
  }, [userId, tick])
  const waterSeries = useMemo(() => {
    const rows = range === 30 ? waterHistory : waterHistory.slice(-7)
    return rows.map((day) => amountFromMl(day.ml, waterGoal.unit))
  }, [waterHistory, range, waterGoal.unit])
  const sleepSeries = useMemo(() => {
    const rows = range === 30 ? sleepHistory : sleepHistory.slice(-7)
    return rows.map((day) => day.hours)
  }, [sleepHistory, range])
  const workoutSeries = useMemo(() => {
    const rows = range === 30 ? workoutHistory : workoutHistory.slice(-7)
    return rows.map((day) => day.minutes)
  }, [workoutHistory, range])
  const hasWaterHistory = waterHistory.some((day) => day.ml > 0)
  const hasSleepHistory = sleepHistory.some((day) => day.hours > 0)
  const hasMoveHistory = workoutHistory.some((day) => day.minutes > 0)
  const showWeek = hasWaterHistory || hasSleepHistory || hasMoveHistory
  const weekCharts = [
    waterSeries.some((value) => value > 0)
      ? { key: 'water', values: waterSeries, label: `Water · ${range}d`, maxHint: waterGoal.amount }
      : null,
    sleepSeries.some((value) => value > 0)
      ? { key: 'sleep', values: sleepSeries, label: `Sleep hrs · ${range}d`, maxHint: 10 }
      : null,
    workoutSeries.some((value) => value > 0)
      ? { key: 'move', values: workoutSeries, label: `Move min · ${range}d`, maxHint: 60 }
      : null,
  ].filter((chart): chart is { key: string; values: number[]; label: string; maxHint: number } => chart != null)

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        title={navItemLabel('/health') ?? 'Health & Wellness'}
        description={AREA_DESCRIPTIONS[healthArea]}
        reserveDescriptions={Object.values(AREA_DESCRIPTIONS)}
        eyebrow={navSectionLabel('/health')}
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

      <div className="mb-4 space-y-2">
        <HealthSegmented
          full
          size="lg"
          className="sm:max-w-xs"
          value={healthArea}
          onChange={setHealthArea}
          options={[
            { id: 'fitness', label: 'Fitness' },
            { id: 'wellness', label: 'Wellness' },
          ]}
        />
        <nav aria-label="Section" className="flex w-full min-w-0 flex-wrap">
          {sectionTabs.map((item) => {
            const selected = item.id === activeSection
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setHealthTab(item.id)}
                className={cn(
                  'min-h-11 whitespace-nowrap border-b-2 px-1 text-sm font-medium transition-colors',
                  selected
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      {activeSection === 'overview' ? (
        <div className="space-y-3">
          <div ref={waterBoxRef} className="kp-surface p-4">
            <p className="kp-section-label">
              Water · {logDate === todayKey() ? 'today' : logDate}
              {waterGoalMet ? ' · goal hit' : ''}
            </p>
            <div className="mt-2">
              <WaterGoalBar
                loggedMl={waterAmountMl}
                goal={waterGoal}
                onGoalChange={setWaterGoal}
                goalEditor="action"
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{waterStatusCopy}</p>
            <div className="mt-3 border-t border-border pt-3">
              <WaterVolumeForm userId={userId} date={logDate} onLogged={refresh} />
            </div>
          </div>

          {showWeek ? (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">This week at a glance</p>
                <HealthSegmented
                  value={String(range) as '7' | '30'}
                  onChange={(id) => setRange(Number(id) as 7 | 30)}
                  options={[
                    { id: '7', label: '7d' },
                    { id: '30', label: '30d' },
                  ]}
                />
              </div>
              {weekCharts.length > 0 ? (
                <div
                  className={cn(
                    'grid gap-3',
                    weekCharts.length === 2 && 'grid-cols-2',
                    weekCharts.length >= 3 && 'grid-cols-3',
                  )}
                >
                  {weekCharts.map((chart) => (
                    <MiniBars key={chart.key} values={chart.values} label={chart.label} maxHint={chart.maxHint} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  compact
                  plain
                  title="Nothing logged in this range"
                  description={`Sleep, meals, and workouts from the last ${range} days will show up here.`}
                />
              )}
            </div>
          ) : null}

        </div>
      ) : null}

      {activeSection === 'lift' ? (
        <div className="space-y-3">
          <LiftTrackingPanel
            userId={userId}
            logDate={logDate}
            tick={tick}
            refresh={refresh}
            panel="lift"
            onGoLift={() => setHealthTab('lift')}
            onGoSplits={() => setHealthTab('splits')}
          />
        </div>
      ) : null}

      {activeSection === 'splits' ? (
        <div className="space-y-3">
          <LiftTrackingPanel
            userId={userId}
            logDate={logDate}
            tick={tick}
            refresh={refresh}
            panel="splits"
            onGoLift={() => setHealthTab('lift')}
            onGoSplits={() => setHealthTab('splits')}
          />
        </div>
      ) : null}

      {activeSection === 'progress' ? (
        <div className="space-y-3">
          <LiftTrackingPanel
            userId={userId}
            logDate={logDate}
            tick={tick}
            refresh={refresh}
            panel="progress"
            onGoLift={() => setHealthTab('lift')}
          />
        </div>
      ) : null}

      {activeSection === 'weight' ? (
        <div className="space-y-3">
          <LiftTrackingPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} panel="weight" />
        </div>
      ) : null}

      {activeSection === 'workouts' ? (
        <div className="space-y-3">
          <CardioPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} />
        </div>
      ) : null}

      {activeSection === 'nutrition' ? (
        <div className="space-y-3">
          <HealthSegmented
            full
            size="lg"
            value={dietSection}
            onChange={setDietSection}
            options={[
              { id: 'meals', label: 'Meals' },
              { id: 'plans', label: 'Plans' },
            ]}
          />
          {dietSection === 'plans' ? (
            <DietPlansPanel userId={userId} tick={tick} refresh={refresh} />
          ) : (
            <NutritionPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} />
          )}
        </div>
      ) : null}

      {activeSection === 'supplements' ? (
        <div className="space-y-3">
          <VitaminsPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} />
        </div>
      ) : null}

      {activeSection === 'sleep' ? (
        <div className="space-y-3">
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
        </div>
      ) : null}
    </motion.div>
  )
}
