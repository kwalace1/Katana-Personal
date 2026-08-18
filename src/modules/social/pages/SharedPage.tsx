import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckSquare, Dumbbell, LogOut, Salad, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { TogetherSetup } from '@/components/TogetherSetup'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { leaveSharedItem, listSharedItems, removeSharedItem, sharedItemHref } from '@/lib/social/shared'
import { getCloudProfile } from '@/lib/social/friends'
import { tasksApi } from '@/modules/tasks/api'
import type { SharedItem } from '@/lib/social/types'
import { formatShortDate } from '@/lib/dates'
import { liftApi } from '@/modules/health/lift-api'
import { healthApi } from '@/modules/health/api'
import type { DietPlanDay, DietPlanPattern, MealCategory, MealIngredient, SplitDay, SplitPattern } from '@/modules/health/types'

function readNumber(value: unknown): number {
  return Number(value) || 0
}

function readIngredients(raw: unknown): MealIngredient[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name : 'Ingredient',
      grams: readNumber(item.grams),
      calories: readNumber(item.calories),
      protein: readNumber(item.protein),
      carbs: readNumber(item.carbs),
      fat: readNumber(item.fat),
      code: typeof item.code === 'string' ? item.code : undefined,
      brand: typeof item.brand === 'string' ? item.brand : undefined,
      source:
        item.source === 'usda' ||
        item.source === 'off' ||
        item.source === 'label' ||
        item.source === 'estimate' ||
        item.source === 'manual'
          ? item.source
          : undefined,
    }))
}

function readSharedMeal(item: SharedItem): {
  name: string
  category: MealCategory
  calories: number
  protein: number
  carbs: number
  fat: number
  notes: string
  ingredients: MealIngredient[]
} | null {
  if (item.kind !== 'meal') return null
  const raw = item.data?.meal
  if (!raw || typeof raw !== 'object') return null
  const meal = raw as Record<string, unknown>
  const category: MealCategory =
    meal.category === 'breakfast' || meal.category === 'lunch' || meal.category === 'dinner'
      ? meal.category
      : 'snack'
  return {
    name: typeof meal.name === 'string' ? meal.name : item.title,
    category,
    calories: readNumber(meal.calories),
    protein: readNumber(meal.protein),
    carbs: readNumber(meal.carbs),
    fat: readNumber(meal.fat),
    notes: typeof meal.notes === 'string' ? meal.notes : '',
    ingredients: readIngredients(meal.ingredients),
  }
}

function readSharedDietPlan(item: SharedItem): {
  name: string
  pattern: DietPlanPattern
  calories: number
  protein: number
  carbs: number
  fat: number
  notes: string
  days: DietPlanDay[]
} | null {
  if (item.kind !== 'diet_plan') return null
  const raw = item.data?.diet_plan
  if (!raw || typeof raw !== 'object') return null
  const plan = raw as Record<string, unknown>
  if (typeof plan.name !== 'string' || !Array.isArray(plan.days)) return null
  const pattern: DietPlanPattern = plan.pattern === 'weekdays' ? 'weekdays' : 'cycle'
  const days: DietPlanDay[] = plan.days
    .filter((day): day is Record<string, unknown> => Boolean(day) && typeof day === 'object')
    .map((day) => ({
      name: typeof day.name === 'string' ? day.name : 'Day',
      meals: Array.isArray(day.meals)
        ? day.meals
            .filter((meal): meal is Record<string, unknown> => Boolean(meal) && typeof meal === 'object')
            .map((meal) => ({
              name: typeof meal.name === 'string' ? meal.name : 'Meal',
              category:
                meal.category === 'breakfast' || meal.category === 'lunch' || meal.category === 'dinner'
                  ? meal.category
                  : 'snack',
              calories: readNumber(meal.calories),
              protein: readNumber(meal.protein),
              carbs: readNumber(meal.carbs),
              fat: readNumber(meal.fat),
              notes: typeof meal.notes === 'string' ? meal.notes : '',
              ingredients: readIngredients(meal.ingredients),
            }))
        : [],
    }))
  return {
    name: plan.name,
    pattern,
    calories: readNumber(plan.calories),
    protein: readNumber(plan.protein),
    carbs: readNumber(plan.carbs),
    fat: readNumber(plan.fat),
    notes: typeof plan.notes === 'string' ? plan.notes : '',
    days,
  }
}

function readSharedSplit(item: SharedItem): {
  name: string
  pattern: SplitPattern
  days: SplitDay[]
} | null {
  if (item.kind !== 'training_split') return null
  const raw = item.data?.split
  if (!raw || typeof raw !== 'object') return null
  const split = raw as Record<string, unknown>
  if (typeof split.name !== 'string' || !Array.isArray(split.days)) return null
  const pattern: SplitPattern = split.pattern === 'weekdays' ? 'weekdays' : 'cycle'
  const days: SplitDay[] = split.days
    .filter((day): day is Record<string, unknown> => Boolean(day) && typeof day === 'object')
    .map((day) => ({
      name: typeof day.name === 'string' ? day.name : 'Day',
      focus: typeof day.focus === 'string' ? day.focus : '',
      exercises: Array.isArray(day.exercises)
        ? day.exercises
            .filter(
              (exercise): exercise is Record<string, unknown> =>
                Boolean(exercise) && typeof exercise === 'object',
            )
            .map((exercise) => ({
              name: typeof exercise.name === 'string' ? exercise.name : 'Exercise',
              sets: Math.max(1, Number(exercise.sets) || 1),
              reps: typeof exercise.reps === 'string' ? exercise.reps : String(exercise.reps || ''),
            }))
        : [],
    }))
  return days.length ? { name: split.name, pattern, days } : null
}

function readSharedWorkout(item: SharedItem): {
  date: string
  exercises: { name: string; sets: { weight: number; reps: number }[] }[]
} | null {
  if (item.kind !== 'lift_session') return null
  const raw = item.data?.workout
  if (!raw || typeof raw !== 'object') return null
  const workout = raw as Record<string, unknown>
  if (!Array.isArray(workout.exercises)) return null
  return {
    date: typeof workout.date === 'string' ? workout.date : '',
    exercises: workout.exercises
      .filter(
        (exercise): exercise is Record<string, unknown> =>
          Boolean(exercise) && typeof exercise === 'object',
      )
      .map((exercise) => ({
        name: typeof exercise.name === 'string' ? exercise.name : 'Exercise',
        sets: Array.isArray(exercise.sets)
          ? exercise.sets
              .filter((set): set is Record<string, unknown> => Boolean(set) && typeof set === 'object')
              .map((set) => ({
                weight: Number(set.weight) || 0,
                reps: Number(set.reps) || 0,
              }))
          : [],
      })),
  }
}

export default function SharedPage() {
  const { user } = useAuth()
  const { cloudUser } = useCloudAuth()
  const [items, setItems] = useState<SharedItem[]>([])
  const [selected, setSelected] = useState<SharedItem | null>(null)
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!cloudUser) return
    void listSharedItems(cloudUser.uid)
      .then(setItems)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Couldn’t load shared items'))
  }, [cloudUser, tick])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    ;(async () => {
      const map: Record<string, string> = {}
      await Promise.all(
        selected.memberIds.map(async (id) => {
          const p = await getCloudProfile(id)
          if (p) map[id] = p.displayName
        }),
      )
      if (!cancelled) setMemberNames(map)
    })()
    return () => {
      cancelled = true
    }
  }, [selected])

  if (!cloudUser) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page">
        <PageHeader
          title="Plans"
          description="Friends send you tasks and goals here — Circles are separate group boards."
          eyebrow="Together"
        />
        <TogetherSetup highlight="shared" compact />
      </motion.div>
    )
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        title="Plans"
        description="Friends send you tasks and goals here — Circles are separate group boards."
        eyebrow="Together"
      />
      {items.length === 0 ? (
        <>
          <TogetherSetup highlight="shared" compact cloudConnected className="mb-4" />
          <EmptyState
            title="Nothing in your plans inbox"
            description="Share a task with a friend from Tasks — they can copy it here. Circles are for streak boards, not this inbox."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link to="/tasks">Open Tasks → pick one → Share</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/circles">Circle Schedule</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/social?tab=friends">Find friends</Link>
                </Button>
              </div>
            }
          />
        </>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const mine = item.ownerId === cloudUser.uid
            const circleNames = Array.isArray(item.data?.sharedCircleNames)
              ? (item.data.sharedCircleNames as string[]).filter(Boolean)
              : []
            return (
            <li key={item.id}>
              <button
                type="button"
                className="kp-surface flex w-full items-start justify-between gap-3 p-4 text-left transition hover:border-primary/30"
                onClick={() => setSelected(item)}
              >
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.kind} · {mine ? 'You shared' : 'Shared with you'}
                  </p>
                  <p className="font-medium">{item.title}</p>
                  {item.body ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                  ) : null}
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {circleNames.length > 0
                      ? `${circleNames.join(', ')} · ${item.memberIds.length} people`
                      : `${item.memberIds.length} people`}
                    {' · '}
                    {formatShortDate(item.updatedAt)}
                  </p>
                </div>
              </button>
            </li>
            )
          })}
        </ul>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl tracking-tight">{selected.title}</DialogTitle>
              </DialogHeader>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{selected.kind}</p>
              {Array.isArray(selected.data?.sharedCircleNames) &&
              (selected.data.sharedCircleNames as string[]).length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Shared via {(selected.data.sharedCircleNames as string[]).join(', ')}
                </p>
              ) : null}
              {selected.body ? <p className="text-sm text-muted-foreground">{selected.body}</p> : null}
              {readSharedSplit(selected) ? (
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="mb-2 text-sm font-medium">Complete split</p>
                  <ul className="space-y-2 text-sm">
                    {readSharedSplit(selected)!.days.map((day, index) => (
                      <li key={`${day.name}-${index}`}>
                        <div className="flex justify-between gap-3">
                          <span className="font-medium">{day.name}</span>
                          <span className="text-muted-foreground">{day.focus || 'Rest'}</span>
                        </div>
                        {day.exercises?.length ? (
                          <p className="text-xs text-muted-foreground">
                            {day.exercises
                              .map((exercise) => `${exercise.name} ${exercise.sets}×${exercise.reps}`)
                              .join(' · ')}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {readSharedWorkout(selected) ? (
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="mb-2 text-sm font-medium">Complete workout</p>
                  <ul className="space-y-2 text-sm">
                    {readSharedWorkout(selected)!.exercises.map((exercise) => (
                      <li key={exercise.name}>
                        <p className="font-medium">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exercise.sets.map((set) => `${set.weight} × ${set.reps}`).join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {readSharedMeal(selected) ? (
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="mb-2 text-sm font-medium">Meal with ingredients</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(readSharedMeal(selected)!.calories)} kcal · P{readSharedMeal(selected)!.protein} C
                    {readSharedMeal(selected)!.carbs} F{readSharedMeal(selected)!.fat}
                  </p>
                  {readSharedMeal(selected)!.ingredients.length ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {readSharedMeal(selected)!.ingredients.map((ingredient, index) => (
                        <li key={`${ingredient.name}-${index}`} className="flex justify-between gap-3">
                          <span>{ingredient.name}</span>
                          <span className="text-muted-foreground">
                            {ingredient.grams ? `${ingredient.grams}g · ` : ''}
                            {Math.round(ingredient.calories)} kcal
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {readSharedDietPlan(selected) ? (
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="mb-2 text-sm font-medium">Complete diet plan</p>
                  <p className="text-xs text-muted-foreground">
                    {readSharedDietPlan(selected)!.calories.toLocaleString()} kcal · P
                    {readSharedDietPlan(selected)!.protein} C{readSharedDietPlan(selected)!.carbs} F
                    {readSharedDietPlan(selected)!.fat}
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {readSharedDietPlan(selected)!.days.map((day, index) => (
                      <li key={`${day.name}-${index}`}>
                        <div className="flex justify-between gap-3">
                          <span className="font-medium">{day.name}</span>
                          <span className="text-muted-foreground">
                            {day.meals.length} meal{day.meals.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        {day.meals.length ? (
                          <p className="text-xs text-muted-foreground">
                            {day.meals
                              .map(
                                (meal) =>
                                  `${meal.name}${meal.ingredients.length ? ` (${meal.ingredients.length})` : ''}`,
                              )
                              .join(' · ')}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div>
                <p className="mb-2 text-sm font-medium">People</p>
                <ul className="space-y-1">
                  {selected.memberIds.map((id) => (
                    <li key={id} className="rounded-xl bg-secondary/50 px-3 py-2 text-sm">
                      {memberNames[id] || '…'}
                      {id === selected.ownerId ? (
                        <span className="ml-2 text-xs text-muted-foreground">owner</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                {sharedItemHref(selected) && selected.ownerId === cloudUser.uid ? (
                  <Button asChild variant="outline">
                    <Link to={sharedItemHref(selected)!} onClick={() => setSelected(null)}>
                      Open related
                    </Link>
                  </Button>
                ) : null}
                {selected.kind === 'task' && user ? (
                  <Button
                    className="gap-1.5"
                    onClick={() => {
                      const lists = tasksApi.listLists(user.id)
                      const task = tasksApi.createTask(user.id, {
                        title: selected.title,
                        notes: selected.body || '',
                        list_id: lists[0]?.id ?? null,
                        due_at:
                          typeof selected.data?.due_at === 'string' ? selected.data.due_at : null,
                      })
                      toast.success('Copied into your tasks')
                      setSelected(null)
                      window.location.href = `/tasks?id=${task.id}`
                    }}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Copy into my tasks
                  </Button>
                ) : null}
                {selected.kind === 'training_split' && user && readSharedSplit(selected) ? (
                  <Button
                    className="gap-1.5"
                    onClick={() => {
                      const split = readSharedSplit(selected)
                      if (!split) return
                      liftApi.saveSplit(user.id, {
                        name: split.name,
                        pattern: split.pattern,
                        days: split.days,
                        active: true,
                      })
                      toast.success('Split imported and activated')
                      setSelected(null)
                      window.location.href = '/health?area=fitness&tab=splits'
                    }}
                  >
                    <Dumbbell className="h-3.5 w-3.5" />
                    Import to Fitness
                  </Button>
                ) : null}
                {selected.kind === 'meal' && user && readSharedMeal(selected) ? (
                  <Button
                    className="gap-1.5"
                    onClick={() => {
                      const meal = readSharedMeal(selected)
                      if (!meal) return
                      healthApi.addNutrition(user.id, {
                        meal: meal.name,
                        category: meal.category,
                        calories: meal.calories,
                        protein: meal.protein,
                        carbs: meal.carbs,
                        fat: meal.fat,
                        notes: meal.notes,
                        ingredients: meal.ingredients,
                      })
                      toast.success('Meal copied into Diet')
                      setSelected(null)
                      window.location.href = '/health?area=wellness&tab=nutrition'
                    }}
                  >
                    <Salad className="h-3.5 w-3.5" />
                    Copy into my meals
                  </Button>
                ) : null}
                {selected.kind === 'diet_plan' && user && readSharedDietPlan(selected) ? (
                  <Button
                    className="gap-1.5"
                    onClick={() => {
                      const plan = readSharedDietPlan(selected)
                      if (!plan) return
                      healthApi.saveDietPlan(user.id, {
                        name: plan.name,
                        pattern: plan.pattern,
                        days: plan.days,
                        calories: plan.calories,
                        protein: plan.protein,
                        carbs: plan.carbs,
                        fat: plan.fat,
                        notes: plan.notes,
                        active: true,
                      })
                      toast.success('Diet plan imported and activated')
                      setSelected(null)
                      window.location.href = '/health?area=wellness&tab=nutrition'
                    }}
                  >
                    <Salad className="h-3.5 w-3.5" />
                    Import to Diet
                  </Button>
                ) : null}
                {selected.ownerId === cloudUser.uid ? (
                  <Button
                    variant="destructive"
                    className="gap-1.5"
                    onClick={async () => {
                      await removeSharedItem(selected.id)
                      setSelected(null)
                      setTick((n) => n + 1)
                      toast.message('Removed')
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={async () => {
                      await leaveSharedItem(cloudUser.uid, selected)
                      setSelected(null)
                      setTick((n) => n + 1)
                      toast.message('Left')
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Leave
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
