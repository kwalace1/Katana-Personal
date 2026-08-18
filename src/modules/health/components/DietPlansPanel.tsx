import { FormEvent, useMemo, useState } from 'react'
import { Lock, Plus, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlusPaywallSheet, usePlusStatus } from '@/components/PlusPaywall'
import { ShareAudiencePicker, type ShareAudienceSelection } from '@/components/ShareAudiencePicker'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { canUsePlusFeature } from '@/lib/plus'
import { shareSuccessMessage, shareWithAudience } from '@/lib/social/share-with-audience'
import { cn } from '@/lib/utils'
import {
  formatMacros,
  formatMealCategory,
  healthApi,
  MEAL_CATEGORIES,
} from '../api'
import { DIET_PRESETS, DIET_PROGRAMS, type DietProgram } from '../diet-programs'
import { cloneIngredients, sumMacros } from '../meal-ingredients'
import type { DietPlan, DietPlanDay, DietPlanMeal, DietPlanPattern, MealCategory } from '../types'
import { MealIngredientPicker } from './MealIngredientPicker'
import { HealthCardHeader, HealthInner, HealthPill, HealthSegmented } from './health-ui'

type Props = {
  userId: string
  tick: number
  refresh: () => void
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function emptyMeal(): DietPlanMeal {
  return {
    name: '',
    category: 'breakfast',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients: [],
  }
}

function cycleDays(count: number): DietPlanDay[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `Day ${i + 1}`,
    meals: [emptyMeal()],
  }))
}

function weekdayDays(): DietPlanDay[] {
  return WEEKDAYS.map((name) => ({ name, meals: [emptyMeal()] }))
}

function cloneDays(days: DietPlanDay[]): DietPlanDay[] {
  return days.map((day) => ({
    name: day.name,
    meals: day.meals.map((meal) => ({
      ...meal,
      ingredients: cloneIngredients(meal.ingredients),
    })),
  }))
}

function syncMealMacros(meal: DietPlanMeal): DietPlanMeal {
  if (!meal.ingredients.length) return meal
  const totals = sumMacros(meal.ingredients)
  return { ...meal, ...totals }
}

export function DietPlansPanel({ userId, tick, refresh }: Props) {
  const plans = useMemo(() => {
    void tick
    return healthApi.listDietPlans(userId)
  }, [userId, tick])

  const [name, setName] = useState('')
  const [pattern, setPattern] = useState<DietPlanPattern>('cycle')
  const [days, setDays] = useState<DietPlanDay[]>(cycleDays(1))
  const [calories, setCalories] = useState('2000')
  const [protein, setProtein] = useState('150')
  const [carbs, setCarbs] = useState('200')
  const [fat, setFat] = useState('65')
  const [notes, setNotes] = useState('')
  const [plusOpen, setPlusOpen] = useState(false)
  const plus = usePlusStatus()
  const { cloudUser } = useCloudAuth()
  const [sharePlan, setSharePlan] = useState<DietPlan | null>(null)
  const [selectedFriends, setSelectedFriends] = useState<Record<string, boolean>>({})
  const [selectedCircles, setSelectedCircles] = useState<Record<string, boolean>>({})
  const [audience, setAudience] = useState<ShareAudienceSelection>({
    friendIds: [],
    circles: [],
    hasAny: false,
  })
  const [sharing, setSharing] = useState(false)

  function switchPattern(next: DietPlanPattern) {
    setPattern(next)
    setDays(next === 'weekdays' ? weekdayDays() : cycleDays(1))
  }

  function applyPreset(preset: (typeof DIET_PRESETS)[number]) {
    setName(preset.name)
    setCalories(String(preset.calories))
    setProtein(String(preset.protein))
    setCarbs(String(preset.carbs))
    setFat(String(preset.fat))
  }

  function applyProgram(program: DietProgram) {
    if (program.premium && !canUsePlusFeature('diet_plans')) {
      setPlusOpen(true)
      return
    }
    setName(program.name)
    setPattern(program.pattern)
    setCalories(String(program.calories))
    setProtein(String(program.protein))
    setCarbs(String(program.carbs))
    setFat(String(program.fat))
    setNotes(program.description)
    setDays(cloneDays(program.days))
    toast.message(`${program.name} loaded — review and save it`)
  }

  function updateMeal(dayIndex: number, mealIndex: number, patch: Partial<DietPlanMeal>) {
    setDays((rows) =>
      rows.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              meals: day.meals.map((meal, j) => (j === mealIndex ? syncMealMacros({ ...meal, ...patch }) : meal)),
            }
          : day,
      ),
    )
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name your diet plan')
      return
    }
    healthApi.saveDietPlan(userId, {
      name: name.trim(),
      pattern,
      days: days.map((day) => ({
        name: day.name.trim() || 'Day',
        meals: day.meals
          .filter((meal) => meal.name.trim() || meal.ingredients.length > 0)
          .map((meal) =>
            syncMealMacros({
              ...meal,
              name: meal.name.trim() || 'Meal',
              ingredients: cloneIngredients(meal.ingredients),
            }),
          ),
      })),
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      notes,
      active: true,
    })
    toast.success('Diet plan saved')
    setName('')
    setNotes('')
    setPattern('cycle')
    setDays(cycleDays(1))
    refresh()
  }

  async function shareSelectedPlan() {
    if (!sharePlan || !cloudUser || !audience.hasAny || sharing) return
    setSharing(true)
    try {
      const result = await shareWithAudience({
        kind: 'diet_plan',
        title: sharePlan.name,
        body: `${sharePlan.calories} kcal · ${formatMacros(sharePlan)} · ${sharePlan.days.length}-day ${
          sharePlan.pattern === 'cycle' ? 'cycle' : 'weekday plan'
        }`,
        data: {
          diet_plan: {
            name: sharePlan.name,
            pattern: sharePlan.pattern,
            calories: sharePlan.calories,
            protein: sharePlan.protein,
            carbs: sharePlan.carbs,
            fat: sharePlan.fat,
            notes: sharePlan.notes,
            days: cloneDays(sharePlan.days),
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
      setSharePlan(null)
      setSelectedFriends({})
      setSelectedCircles({})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t share diet plan')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={save} className="kp-surface space-y-5 p-4 sm:p-5">
        <HealthCardHeader
          eyebrow="Diet plan"
          title="Create a plan"
          description="Set calories and macros, then add the meals (with ingredients) for each day."
        />

        <div className="flex flex-wrap gap-2">
          {DIET_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => applyPreset(preset)}
            >
              {preset.name}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="kp-section-label">Pre-made plans</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {DIET_PROGRAMS.map((program) => (
              <button
                key={program.id}
                type="button"
                onClick={() => applyProgram(program)}
                className="rounded-2xl bg-secondary/40 p-3.5 text-left transition hover:bg-secondary/65"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{program.name}</p>
                  {program.premium && !plus ? (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {program.level} · {program.calories.toLocaleString()} kcal · {formatMacros(program)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{program.description}</p>
              </button>
            ))}
          </div>
        </div>

        <Input placeholder="Plan name" value={name} onChange={(e) => setName(e.target.value)} />

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Daily calories & macros</p>
          <div className="grid gap-3 sm:grid-cols-2 *:min-w-0">
            <Input type="number" min={0} placeholder="Calories" value={calories} onChange={(e) => setCalories(e.target.value)} />
            <Input type="number" min={0} placeholder="Protein (g)" value={protein} onChange={(e) => setProtein(e.target.value)} />
            <Input type="number" min={0} placeholder="Carbs (g)" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            <Input type="number" min={0} placeholder="Fat (g)" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
        </div>

        <HealthSegmented
          value={pattern}
          onChange={switchPattern}
          options={[
            { id: 'cycle', label: 'Repeating cycle' },
            { id: 'weekdays', label: 'Weekday plan' },
          ]}
        />

        <div className="space-y-3">
          {days.map((day, dayIndex) => (
            <HealthInner key={`${day.name}-${dayIndex}`} className="space-y-3">
              <div className="mb-2 flex items-center gap-2">
                {pattern === 'cycle' ? (
                  <Input
                    value={day.name}
                    onChange={(e) =>
                      setDays((rows) => rows.map((row, i) => (i === dayIndex ? { ...row, name: e.target.value } : row)))
                    }
                    aria-label={`Day ${dayIndex + 1} label`}
                  />
                ) : (
                  <p className="text-sm font-medium">{day.name}</p>
                )}
                {pattern === 'cycle' ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={days.length <= 1}
                    onClick={() => setDays((rows) => rows.filter((_, i) => i !== dayIndex))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="space-y-3">
                {day.meals.map((meal, mealIndex) => (
                  <div key={`${dayIndex}-${mealIndex}`} className="space-y-2 rounded-xl bg-secondary/30 p-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                      <Input
                        placeholder="Meal name"
                        value={meal.name}
                        onChange={(e) => updateMeal(dayIndex, mealIndex, { name: e.target.value })}
                      />
                      <Select
                        value={meal.category}
                        onValueChange={(v) => updateMeal(dayIndex, mealIndex, { category: v as MealCategory })}
                      >
                        <SelectTrigger aria-label="Meal category">
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
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={day.meals.length <= 1}
                        onClick={() =>
                          setDays((rows) =>
                            rows.map((row, i) =>
                              i === dayIndex ? { ...row, meals: row.meals.filter((_, j) => j !== mealIndex) } : row,
                            ),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <MealIngredientPicker
                      ingredients={meal.ingredients}
                      onChange={(ingredients) => updateMeal(dayIndex, mealIndex, { ingredients })}
                    />
                    {meal.ingredients.length === 0 ? (
                      <div className="grid gap-2 sm:grid-cols-4">
                        <Input
                          type="number"
                          min={0}
                          placeholder="kcal"
                          value={meal.calories || ''}
                          onChange={(e) => updateMeal(dayIndex, mealIndex, { calories: Number(e.target.value) || 0 })}
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="P"
                          value={meal.protein || ''}
                          onChange={(e) => updateMeal(dayIndex, mealIndex, { protein: Number(e.target.value) || 0 })}
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="C"
                          value={meal.carbs || ''}
                          onChange={(e) => updateMeal(dayIndex, mealIndex, { carbs: Number(e.target.value) || 0 })}
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="F"
                          value={meal.fat || ''}
                          onChange={(e) => updateMeal(dayIndex, mealIndex, { fat: Number(e.target.value) || 0 })}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {formatMealCategory(meal.category)} · {meal.calories} kcal · {formatMacros(meal)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() =>
                  setDays((rows) =>
                    rows.map((row, i) => (i === dayIndex ? { ...row, meals: [...row.meals, emptyMeal()] } : row)),
                  )
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add meal
              </Button>
            </HealthInner>
          ))}
        </div>

        {pattern === 'cycle' ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setDays((rows) => [...rows, { name: `Day ${rows.length + 1}`, meals: [emptyMeal()] }])}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add day
          </Button>
        ) : null}

        <Textarea rows={2} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit">Save diet plan</Button>
      </form>

      <div>
        <p className="kp-section-label">Library</p>
        <h3 className="mb-3 mt-1 font-display text-xl tracking-tight">Saved plans</h3>
        {plans.length === 0 ? (
          <EmptyState title="No diet plans yet" description="Save a calorie target and meals above." />
        ) : (
          <ul className="space-y-3">
            {plans.map((plan) => (
              <li key={plan.id} className={cn('kp-surface p-4 sm:p-5', plan.active && 'ring-2 ring-primary/20')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{plan.name}</p>
                      {plan.active ? <HealthPill tone="primary">Active</HealthPill> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {plan.calories.toLocaleString()} kcal · {formatMacros(plan)} ·{' '}
                      {plan.pattern === 'cycle' ? 'Repeating cycle' : 'Weekday'}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {plan.days.map((day, i) => (
                        <li key={`${plan.id}-${i}`} className="border-t border-border/30 py-1.5 first:border-0">
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">{day.name}</span>
                            <span>{day.meals.length} meal{day.meals.length === 1 ? '' : 's'}</span>
                          </div>
                          {day.meals.length ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {day.meals
                                .map(
                                  (meal) =>
                                    `${meal.name}${meal.ingredients.length ? ` (${meal.ingredients.length} ingredients)` : ''}`,
                                )
                                .join(' · ')}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!cloudUser) {
                          toast.message('Connect Social in Settings to share a diet plan')
                          return
                        }
                        setSharePlan(plan)
                      }}
                    >
                      <Share2 className="mr-1 h-3.5 w-3.5" />
                      Share
                    </Button>
                    {!plan.active ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          healthApi.setActiveDietPlan(userId, plan.id)
                          refresh()
                          toast.success('Diet plan activated')
                        }}
                      >
                        Set active
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        healthApi.removeDietPlan(userId, plan.id)
                        refresh()
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={Boolean(sharePlan)} onOpenChange={(open) => !open && setSharePlan(null)}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share {sharePlan?.name}</DialogTitle>
          </DialogHeader>
          {cloudUser ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Friends get the calories, macros, meals, and ingredients — they can import their own copy.
              </p>
              <ShareAudiencePicker
                uid={cloudUser.uid}
                selectedFriends={selectedFriends}
                selectedCircles={selectedCircles}
                onFriendsChange={setSelectedFriends}
                onCirclesChange={setSelectedCircles}
                onAudienceChange={setAudience}
                compact
              />
              <Button className="w-full" disabled={!audience.hasAny || sharing} onClick={() => void shareSelectedPlan()}>
                {sharing ? 'Sharing…' : 'Share complete diet plan'}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <PlusPaywallSheet open={plusOpen} onOpenChange={setPlusOpen} feature="diet_plans" />
    </div>
  )
}
