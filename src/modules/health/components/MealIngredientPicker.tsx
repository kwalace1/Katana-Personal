import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { foodSourceLabel, searchFoods, type FoodHit } from '@/lib/food/open-food-facts'
import { formatMacros } from '../api'
import { ingredientFromFood, rescaleIngredient, sumMacros } from '../meal-ingredients'
import type { MealIngredient } from '../types'

export function MealIngredientPicker({
  ingredients,
  onChange,
}: {
  ingredients: MealIngredient[]
  onChange: (next: MealIngredient[]) => void
}) {
  const [foodQuery, setFoodQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<FoodHit[]>([])
  const searchSeq = useRef(0)
  const totals = sumMacros(ingredients)

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
      void searchFoods(q)
        .then((results) => {
          if (seq !== searchSeq.current) return
          setHits(results)
        })
        .catch((err) => {
          if (seq !== searchSeq.current) return
          const msg = err instanceof Error ? err.message : 'Search failed'
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

  function addFood(hit: FoodHit) {
    const g = hit.servingGrams && hit.servingGrams > 0 ? hit.servingGrams : 100
    onChange([...ingredients, ingredientFromFood(hit, g)])
    setFoodQuery('')
    setHits([])
  }

  return (
    <div className="space-y-2">
      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={foodQuery}
          onChange={(e) => setFoodQuery(e.target.value)}
          placeholder="Add ingredients — chicken, rice, oats…"
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {searching ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          </span>
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
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-border/60 bg-card/80 p-1.5">
          {hits.map((hit) => (
            <li key={`${hit.code}-${hit.name}`}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-secondary/80"
                onClick={() => addFood(hit)}
              >
                {hit.imageUrl ? (
                  <img
                    src={hit.imageUrl}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg bg-secondary object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-[0.65rem] font-medium text-muted-foreground">
                    {foodSourceLabel(hit) === 'USDA' ? 'USDA' : 'OFF'}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{hit.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {foodSourceLabel(hit)}
                    {hit.brand && foodSourceLabel(hit) !== 'USDA' ? ` · ${hit.brand}` : ''}
                    {` · ${hit.per100g.calories} kcal / 100g`}
                  </span>
                </span>
                <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {ingredients.length > 0 ? (
        <ul className="space-y-2">
          {ingredients.map((item, index) => (
            <li
              key={`${item.code || item.name}-${index}`}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(item.calories)} kcal · {formatMacros(item)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={item.grams || ''}
                  onChange={(e) => {
                    const g = Number(e.target.value)
                    if (!Number.isFinite(g) || g <= 0) {
                      onChange(ingredients.map((row, i) => (i === index ? { ...row, grams: 0 } : row)))
                      return
                    }
                    onChange(ingredients.map((row, i) => (i === index ? rescaleIngredient(row, g) : row)))
                  }}
                  className="h-9 w-[5.5rem]"
                  aria-label={`${item.name} grams`}
                />
                <span className="text-xs text-muted-foreground">g</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onChange(ingredients.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Add as many ingredients as you want — macros add up automatically.</p>
      )}

      {ingredients.length > 0 ? (
        <p className="text-xs font-medium text-muted-foreground">
          {ingredients.length} ingredient{ingredients.length === 1 ? '' : 's'} · {totals.calories} kcal · {formatMacros(totals)}
        </p>
      ) : null}
    </div>
  )
}
