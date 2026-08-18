import { FormEvent, useMemo, useState } from 'react'
import { ImagePlus, ScanText, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { MealPhotoEstimateDialog } from '@/components/MealPhotoEstimateDialog'
import { NutritionLabelScanDialog } from '@/components/NutritionLabelScanDialog'
import { PlusPaywallSheet, usePlusStatus } from '@/components/PlusPaywall'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ShareAudiencePicker, type ShareAudienceSelection } from '@/components/ShareAudiencePicker'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { todayKey } from '@/lib/dates'
import { canUsePlusFeature } from '@/lib/plus'
import type { MealEstimate } from '@/lib/food/meal-estimate'
import type { NutritionLabelEstimate } from '@/lib/food/nutrition-label'
import { computeLocalStreaks } from '@/lib/social/streaks'
import { buildHealthStreakShareCard, isStreakMilestone, offerShareWin } from '@/lib/social/share-win'
import { shareSuccessMessage, shareWithAudience } from '@/lib/social/share-with-audience'
import { cn } from '@/lib/utils'
import {
  formatMacros,
  formatMealCategory,
  formatMealTime,
  healthApi,
  MEAL_CATEGORIES,
} from '../api'
import { cloneIngredients, ingredientFromEstimate, ingredientFromLabel, sumMacros } from '../meal-ingredients'
import type { MealCategory, MealIngredient, NutritionLog } from '../types'
import { formatLiftDate } from './lift/LiftLineChart'
import { MealIngredientPicker } from './MealIngredientPicker'
import { HealthCardHeader } from './health-ui'

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

  const planned = useMemo(() => {
    void tick
    return healthApi.plannedDietDay(userId, logDate || todayKey())
  }, [userId, logDate, tick])

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
  const [ingredients, setIngredients] = useState<MealIngredient[]>([])
  const [scannerOpen, setScannerOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [plusOpen, setPlusOpen] = useState(false)
  const plus = usePlusStatus()
  const { cloudUser } = useCloudAuth()
  const [shareMeal, setShareMeal] = useState<NutritionLog | null>(null)
  const [selectedFriends, setSelectedFriends] = useState<Record<string, boolean>>({})
  const [selectedCircles, setSelectedCircles] = useState<Record<string, boolean>>({})
  const [audience, setAudience] = useState<ShareAudienceSelection>({
    friendIds: [],
    circles: [],
    hasAny: false,
  })
  const [sharing, setSharing] = useState(false)

  function applyIngredientTotals(next: MealIngredient[]) {
    setIngredients(next)
    if (next.length === 0) return
    const totals = sumMacros(next)
    setCalories(String(totals.calories))
    setProtein(String(totals.protein))
    setCarbs(String(totals.carbs))
    setFat(String(totals.fat))
    if (!meal.trim()) setMeal(next.map((item) => item.name).slice(0, 3).join(', '))
  }

  function applyNutritionLabel(label: NutritionLabelEstimate) {
    applyIngredientTotals([...ingredients, ingredientFromLabel(label)])
    if (!meal.trim()) setMeal(label.name)
  }

  function applyMealEstimate(estimate: MealEstimate) {
    applyIngredientTotals([...ingredients, ingredientFromEstimate(estimate)])
    if (!meal.trim()) setMeal(estimate.name)
    if (estimate.note) {
      setNotes((prev) => (prev.trim() ? prev : estimate.note || ''))
    }
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (!meal.trim()) {
      toast.error('Add a meal name')
      return
    }
    const wasFirstMealOfDay = !meals.some((m) => m.date === date)
    const totals = ingredients.length ? sumMacros(ingredients) : {
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    }
    healthApi.addNutrition(userId, {
      meal,
      category,
      date,
      time,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      notes: notes.trim(),
      ingredients: cloneIngredients(ingredients),
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
    setIngredients([])
    setTime(localTimeHHMM())
    refresh()
  }

  function logPlannedMeals() {
    if (!planned) return
    for (const item of planned.day.meals) {
      if (!item.name.trim() && item.ingredients.length === 0) continue
      healthApi.addNutrition(userId, {
        meal: item.name || 'Planned meal',
        category: item.category,
        date: logDate || todayKey(),
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        notes: item.notes || `From ${planned.plan.name}`,
        ingredients: cloneIngredients(item.ingredients),
      })
    }
    toast.success('Plan meals logged')
    refresh()
  }

  async function shareSelectedMeal() {
    if (!shareMeal || !cloudUser || !audience.hasAny || sharing) return
    setSharing(true)
    try {
      const result = await shareWithAudience({
        kind: 'meal',
        title: shareMeal.meal,
        body: `${Math.round(shareMeal.calories)} kcal · ${formatMacros(shareMeal)}${
          shareMeal.ingredients?.length ? ` · ${shareMeal.ingredients.length} ingredients` : ''
        }`,
        data: {
          meal: {
            name: shareMeal.meal,
            category: shareMeal.category || 'snack',
            calories: shareMeal.calories,
            protein: shareMeal.protein || 0,
            carbs: shareMeal.carbs || 0,
            fat: shareMeal.fat || 0,
            notes: shareMeal.notes,
            ingredients: cloneIngredients(shareMeal.ingredients),
          },
        },
        ownerId: cloudUser.uid,
        friendIds: audience.friendIds,
        circles: audience.circles,
        activityFeed: true,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(shareSuccessMessage(result))
      setShareMeal(null)
      setSelectedFriends({})
      setSelectedCircles({})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t share meal')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="space-y-4">
      {planned ? (
        <div className="kp-surface flex flex-wrap items-start justify-between gap-3 bg-primary/[0.06] p-4 sm:p-5">
          <div>
            <p className="kp-section-label">Active diet plan</p>
            <p className="mt-1 font-display text-xl tracking-tight">{planned.plan.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {planned.day.name} · {planned.plan.calories.toLocaleString()} kcal target · {formatMacros(planned.plan)}
            </p>
            {planned.day.meals.length ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {planned.day.meals.map((item) => item.name).filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
          {planned.day.meals.length ? (
            <Button size="sm" variant="outline" className="rounded-full" onClick={logPlannedMeals}>
              Log today’s meals
            </Button>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={save} className="kp-surface min-w-0 space-y-4 overflow-hidden p-4 sm:p-5">
        <HealthCardHeader
          eyebrow="Nutrition"
          title="Log a meal"
          description="Add ingredients, scan a Nutrition Facts label, or snap a meal for an estimate."
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            title={plus ? 'Scan Nutrition Facts label' : 'Scan label · Plus'}
            onClick={() => {
              if (!canUsePlusFeature('nutrition_ai')) {
                setPlusOpen(true)
                return
              }
              setScannerOpen(true)
            }}
          >
            <ScanText className="h-4 w-4" />
            Scan label
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            title={plus ? 'Estimate meal from photo' : 'Meal photo · Plus'}
            onClick={() => {
              if (!canUsePlusFeature('nutrition_ai')) {
                setPlusOpen(true)
                return
              }
              setPhotoOpen(true)
            }}
          >
            <ImagePlus className="h-4 w-4" />
            Photo estimate
          </Button>
        </div>

        <MealIngredientPicker ingredients={ingredients} onChange={applyIngredientTotals} />

        <NutritionLabelScanDialog
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          onRead={applyNutritionLabel}
        />
        <MealPhotoEstimateDialog
          open={photoOpen}
          onOpenChange={setPhotoOpen}
          onEstimate={applyMealEstimate}
        />
        <PlusPaywallSheet open={plusOpen} onOpenChange={setPlusOpen} feature="nutrition_ai" />

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
              className={cn(ingredients.length > 0 && 'border-primary/30')}
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
            {planned ? (
              <span className="ml-1 text-lg font-sans font-medium text-muted-foreground">
                / {planned.plan.calories.toLocaleString()}
              </span>
            ) : null}
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
            description="Add ingredients above or log a meal with rough macros."
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
                          <div className="min-w-0">
                            <p className="font-medium">{entry.meal}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatMealCategory(entry.category)}
                              {entry.time ? ` · ${formatMealTime(entry.time)}` : ''} ·{' '}
                              {Math.round(Number(entry.calories) || 0).toLocaleString()} kcal ·{' '}
                              {formatMacros(entry)}
                            </p>
                            {entry.ingredients?.length ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {entry.ingredients
                                  .map((item) => `${item.name}${item.grams ? ` (${item.grams}g)` : ''}`)
                                  .join(' · ')}
                              </p>
                            ) : null}
                            {entry.notes ? (
                              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{entry.notes}</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Share meal"
                              onClick={() => {
                                if (!cloudUser) {
                                  toast.message('Connect Social in Settings to share a meal')
                                  return
                                }
                                setShareMeal(entry)
                              }}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
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

      <Dialog open={Boolean(shareMeal)} onOpenChange={(open) => !open && setShareMeal(null)}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share {shareMeal?.meal}</DialogTitle>
          </DialogHeader>
          {cloudUser ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Friends receive the meal with ingredients and macros, and can copy it into their own log.
              </p>
              {shareMeal?.ingredients?.length ? (
                <ul className="space-y-1 rounded-2xl bg-secondary/40 p-3 text-sm">
                  {shareMeal.ingredients.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground">
                        {item.grams ? `${item.grams}g · ` : ''}
                        {Math.round(item.calories)} kcal
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ShareAudiencePicker
                uid={cloudUser.uid}
                selectedFriends={selectedFriends}
                selectedCircles={selectedCircles}
                onFriendsChange={setSelectedFriends}
                onCirclesChange={setSelectedCircles}
                onAudienceChange={setAudience}
                compact
              />
              <Button className="w-full" disabled={!audience.hasAny || sharing} onClick={() => void shareSelectedMeal()}>
                {sharing ? 'Sharing…' : 'Share meal with ingredients'}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
