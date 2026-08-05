import { FormEvent, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { todayKey } from '@/lib/dates'
import {
  formatMacros,
  formatMealCategory,
  formatMealTime,
  healthApi,
  MEAL_CATEGORIES,
} from '../../api'
import type { MealCategory } from '../../types'
import { formatLiftDate } from '../lift/LiftLineChart'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
}

function localTimeHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function NutritionPanel({ userId, logDate, tick, refresh }: Props) {
  const meals = useMemo(() => {
    void tick
    return healthApi.listNutrition(userId)
  }, [userId, tick])

  const todayTotals = useMemo(() => {
    void tick
    return healthApi.nutritionDayTotals(userId, todayKey())
  }, [userId, tick])

  const dates = useMemo(() => [...new Set(meals.map((m) => m.date))], [meals])

  const [meal, setMeal] = useState('')
  const [category, setCategory] = useState<MealCategory>('breakfast')
  const [date, setDate] = useState(logDate || todayKey())
  const [time, setTime] = useState(localTimeHHMM())
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [notes, setNotes] = useState('')

  function save(e: FormEvent) {
    e.preventDefault()
    if (!meal.trim()) {
      toast.error('Add a meal name')
      return
    }
    healthApi.addNutrition(userId, {
      meal,
      category,
      date,
      time,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      notes,
    })
    toast.success('Meal saved')
    setMeal('')
    setCalories('')
    setProtein('')
    setCarbs('')
    setFat('')
    setNotes('')
    setTime(localTimeHHMM())
    refresh()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="kp-surface space-y-4 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Nutrition</p>
          <h3 className="font-display text-xl tracking-tight">Log meal</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Chicken bowl, shake, oats…"
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            aria-label="Meal"
          />
          <Select value={category} onValueChange={(v) => setCategory(v as MealCategory)}>
            <SelectTrigger aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEAL_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Calories & macros</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="Calories"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              step={0.1}
              placeholder="Protein (g)"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              step={0.1}
              placeholder="Carbs (g)"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              step={0.1}
              placeholder="Fat (g)"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>
        </div>
        <Textarea
          rows={3}
          placeholder="Optional details…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Button type="submit">Save meal</Button>
      </form>

      <div className="kp-surface flex flex-wrap items-end justify-between gap-3 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="font-display text-2xl tracking-tight">
            {Math.round(todayTotals.calories).toLocaleString()} kcal
          </p>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">
          {formatMacros(todayTotals)} · {todayTotals.count} meal{todayTotals.count === 1 ? '' : 's'}
        </p>
      </div>

      <div className="kp-surface p-4">
        <p className="text-xs text-muted-foreground">History</p>
        <h3 className="mb-3 font-display text-lg tracking-tight">Meal log</h3>
        {meals.length === 0 ? (
          <EmptyState title="No meals yet" description="Log a meal to start tracking calories and macros." />
        ) : (
          <div className="space-y-5">
            {dates.map((dateISO) => {
              const dayMeals = meals.filter((m) => m.date === dateISO)
              const totals = healthApi.nutritionDayTotals(userId, dateISO)
              return (
                <div key={dateISO}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{formatLiftDate(dateISO)}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(totals.calories).toLocaleString()} kcal · {formatMacros(totals)}
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {dayMeals.map((entry) => (
                      <li key={entry.id} className="rounded-xl border border-border/50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{entry.meal}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatMealCategory(entry.category)}
                              {entry.time ? ` · ${formatMealTime(entry.time)}` : ''} ·{' '}
                              {Math.round(Number(entry.calories) || 0).toLocaleString()} kcal ·{' '}
                              {formatMacros(entry)}
                            </p>
                            {entry.notes ? (
                              <p className="mt-1 text-sm text-muted-foreground">{entry.notes}</p>
                            ) : null}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              healthApi.removeNutrition(userId, entry.id)
                              refresh()
                              toast.message('Meal deleted')
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
