import { FormEvent, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Minus, Plus, Trash2 } from 'lucide-react'
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
import { healthApi } from '../api'
import type { SleepLog } from '../types'

export default function HealthPage() {
  const { user } = useAuth()
  const userId = user!.id
  const { tick, refresh } = useLocalRefresh()
  const { cloudUser, syncStreaksToCloud } = useCloudAuth()

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

  const workouts = useMemo(() => {
    void tick
    return healthApi.listWorkouts(userId)
  }, [userId, tick])

  const nutrition = useMemo(() => {
    void tick
    return healthApi.listNutrition(userId)
  }, [userId, tick])

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

  const [activity, setActivity] = useState('')
  const [duration, setDuration] = useState('30')
  const [workoutNotes, setWorkoutNotes] = useState('')
  const [meal, setMeal] = useState('')
  const [calories, setCalories] = useState('')
  const [hours, setHours] = useState('7.5')
  const [quality, setQuality] = useState<SleepLog['quality']>('good')

  function addWorkout(e: FormEvent) {
    e.preventDefault()
    if (!activity.trim()) return
    healthApi.addWorkout(userId, {
      activity,
      duration_minutes: Number(duration) || 0,
      notes: workoutNotes,
      date: logDate,
    })
    setActivity('')
    setWorkoutNotes('')
    refresh()
  }

  function addMeal(e: FormEvent) {
    e.preventDefault()
    if (!meal.trim()) return
    healthApi.addNutrition(userId, {
      meal,
      calories: Number(calories) || 0,
      date: logDate,
    })
    setMeal('')
    setCalories('')
    refresh()
  }

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
      <PageHeader title="Health" description="How your body is doing." eyebrow="Life" />

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

      <div className="kp-surface mb-6 flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">Water · {logDate === todayKey() ? 'today' : logDate}</p>
          <p className="font-display text-3xl">{water.glasses} glasses</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              healthApi.setWater(userId, water.glasses - 1, logDate)
              refresh()
            }}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            onClick={() => {
              healthApi.setWater(userId, water.glasses + 1, logDate)
              refresh()
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="workouts">
        <TabsList>
          <TabsTrigger value="workouts">Workouts</TabsTrigger>
          <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
          <TabsTrigger value="sleep">Sleep</TabsTrigger>
        </TabsList>

        <TabsContent value="workouts" className="space-y-4">
          <form onSubmit={addWorkout} className="kp-surface grid gap-3 p-4 sm:grid-cols-3">
            <Input placeholder="Activity" value={activity} onChange={(e) => setActivity(e.target.value)} />
            <Input type="number" min={1} placeholder="Minutes" value={duration} onChange={(e) => setDuration(e.target.value)} />
            <Input placeholder="Notes (optional)" value={workoutNotes} onChange={(e) => setWorkoutNotes(e.target.value)} />
            <Button type="submit" className="sm:col-span-3">
              Log workout
            </Button>
          </form>
          {workouts.length === 0 ? (
            <EmptyState title="No workouts yet" description="Log a short session when you move." />
          ) : (
            <ul className="space-y-2">
              {workouts.map((w) => (
                <li key={w.id} className="kp-surface flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{w.activity}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.date} · {w.duration_minutes} min
                      {w.notes ? ` · ${w.notes}` : ''}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      healthApi.removeWorkout(userId, w.id)
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

        <TabsContent value="nutrition" className="space-y-4">
          <form onSubmit={addMeal} className="kp-surface grid gap-3 p-4 sm:grid-cols-3">
            <Input placeholder="Meal" value={meal} onChange={(e) => setMeal(e.target.value)} />
            <Input type="number" min={0} placeholder="Calories" value={calories} onChange={(e) => setCalories(e.target.value)} />
            <Button type="submit">Log meal</Button>
          </form>
          {nutrition.length === 0 ? (
            <EmptyState title="No meals logged" description="Track a meal when it helps." />
          ) : (
            <ul className="space-y-2">
              {nutrition.map((n) => (
                <li key={n.id} className="kp-surface flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{n.meal}</p>
                    <p className="text-xs text-muted-foreground">
                      {n.date} · {n.calories} cal
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      healthApi.removeNutrition(userId, n.id)
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
