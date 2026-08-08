import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { todayKey } from '@/lib/dates'
import {
  macrosForGrams,
  searchOpenFoodFacts,
  type FoodHit,
} from '@/lib/food/open-food-facts'
import { computeLocalStreaks } from '@/lib/social/streaks'
import { buildHealthStreakShareCard, isStreakMilestone, offerShareWin } from '@/lib/social/share-win'
import { cn } from '@/lib/utils'
import {
  formatMacros,
  formatMealCategory,
  formatMealTime,
  healthApi,
  MEAL_CATEGORIES,
} from '../api'
import type { MealCategory } from '../types'
import { formatLiftDate } from './lift/LiftLineChart'

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

  const [foodQuery, setFoodQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<FoodHit[]>([])
  const [selectedFood, setSelectedFood] = useState<FoodHit | null>(null)
  const [grams, setGrams] = useState('100')
  const searchSeq = useRef(0)

  useEffect(() => {
    const q = foodQuery.trim()
    if (q.length < 2) {
      setHits([])
      setSearching(false)
      return
    }
    const seq = ++searchSeq.current
    setSearching(true)
    const t = window.setTimeout(() => {
      void searchOpenFoodFacts(q)
        .then((results) => {
          if (seq !== searchSeq.current) return
          setHits(results)
        })
        .catch((err) => {
          if (seq !== searchSeq.current) return
          const msg = err instanceof Error ? err.message : 'Search failed'
          // Safari often reports network/CORS failures as "Load failed"
          toast.error(
            /load failed|failed to fetch|networkerror/i.test(msg)
              ? 'Food search unavailable — check connection and try again'
              : msg,
          )
          setHits([])
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false)
        })
    }, 350)
    return () => window.clearTimeout(t)
  }, [foodQuery])

  function applyFood(hit: FoodHit, nextGrams: number) {
    const macros = macrosForGrams(hit, nextGrams)
    setSelectedFood(hit)
    setMeal(hit.brand ? `${hit.name} (${hit.brand})` : hit.name)
    setCalories(String(macros.calories))
    setProtein(String(macros.protein))
    setCarbs(String(macros.carbs))
    setFat(String(macros.fat))
    setFoodQuery('')
    setHits([])
  }

  function onPickFood(hit: FoodHit) {
    const g = hit.servingGrams && hit.servingGrams > 0 ? hit.servingGrams : 100
    setGrams(String(Math.round(g)))
    applyFood(hit, g)
  }

  function onGramsChange(value: string) {
    setGrams(value)
    if (!selectedFood) return
    const g = Number(value)
    if (!Number.isFinite(g) || g <= 0) return
    const macros = macrosForGrams(selectedFood, g)
    setCalories(String(macros.calories))
    setProtein(String(macros.protein))
    setCarbs(String(macros.carbs))
    setFat(String(macros.fat))
  }

  function clearFood() {
    setSelectedFood(null)
    setGrams('100')
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (!meal.trim()) {
      toast.error('Add a meal name')
      return
    }
    const wasFirstMealOfDay = !meals.some((m) => m.date === date)
    const sourceNote =
      selectedFood?.code
        ? `Open Food Facts · ${selectedFood.code}${selectedFood.servingSizeLabel ? ` · serving ${selectedFood.servingSizeLabel}` : ''}`
        : ''
    healthApi.addNutrition(userId, {
      meal,
      category,
      date,
      time,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      notes: [notes.trim(), sourceNote].filter(Boolean).join('\n'),
    })
    toast.success('Meal saved')
    if (wasFirstMealOfDay) {
      const { nutritionStreak } = computeLocalStreaks(userId)
      if (isStreakMilestone(nutritionStreak)) {
        offerShareWin(
          buildHealthStreakShareCard({
            kind: 'nutrition',
            streak: nutritionStreak,
          }),
        )
      }
    }
    setMeal('')
    setCalories('')
    setProtein('')
    setCarbs('')
    setFat('')
    setNotes('')
    setTime(localTimeHHMM())
    clearFood()
    refresh()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="kp-surface min-w-0 space-y-4 overflow-hidden p-4">
        <div>
          <p className="text-xs text-muted-foreground">Nutrition</p>
          <h3 className="font-display text-xl tracking-tight">Log a meal</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Search a food or barcode to fill macros — or type them yourself.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="food-search">
            Find food
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="food-search"
              value={foodQuery}
              onChange={(e) => setFoodQuery(e.target.value)}
              placeholder="Search “oats”, “chicken”, or paste a barcode…"
              className="pl-9 pr-9"
              autoComplete="off"
            />
            {searching ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : foodQuery ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary"
                aria-label="Clear search"
                onClick={() => {
                  setFoodQuery('')
                  setHits([])
                }}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {hits.length > 0 ? (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-border/60 bg-card/80 p-1.5">
              {hits.map((hit) => (
                <li key={`${hit.code}-${hit.name}`}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-secondary/80"
                    onClick={() => onPickFood(hit)}
                  >
                    {hit.imageUrl ? (
                      <img
                        src={hit.imageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover bg-secondary"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs text-muted-foreground">
                        Food
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{hit.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {hit.brand ? `${hit.brand} · ` : ''}
                        {hit.per100g.calories} kcal / 100g
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {selectedFood ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.05] px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selectedFood.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedFood.per100g.calories} kcal / 100g
                  {selectedFood.servingSizeLabel ? ` · serving ${selectedFood.servingSizeLabel}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={grams}
                  onChange={(e) => onGramsChange(e.target.value)}
                  className="h-9 w-[5.5rem]"
                  aria-label="Grams"
                />
                <span className="text-xs text-muted-foreground">g</span>
                {selectedFood.servingGrams ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={() => onGramsChange(String(Math.round(selectedFood.servingGrams!)))}
                  >
                    1 serving
                  </Button>
                ) : null}
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9" onClick={clearFood} aria-label="Clear food">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          <p className="text-[0.7rem] text-muted-foreground">
            Food data from{' '}
            <a
              href="https://world.openfoodfacts.org"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Open Food Facts
            </a>{' '}
            (ODbL).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 *:min-w-0">
          <Input
            placeholder="Chicken bowl, shake, oats…"
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            aria-label="Meal"
          />
          <Select value={category} onValueChange={(v) => setCategory(v as MealCategory)}>
            <SelectTrigger aria-label="Category" className="min-w-0">
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
          <div className="grid gap-3 sm:grid-cols-2 *:min-w-0">
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="Calories"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className={cn(selectedFood && 'border-primary/30')}
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
          <EmptyState
            title="No meals yet"
            description="Search a food above or log a meal with rough macros."
          />
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
                              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{entry.notes}</p>
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
