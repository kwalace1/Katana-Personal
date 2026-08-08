/**
 * Food search client — same-origin /api/food-search (USDA + Open Food Facts).
 */

export type FoodHit = {
  code: string
  name: string
  brand?: string
  imageUrl?: string
  source?: 'usda' | 'off'
  /** Nutrition per 100g */
  per100g: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  servingSizeLabel?: string
  /** Grams in one serving, when known */
  servingGrams?: number
}

/** Scale per-100g macros to a gram amount. */
export function macrosForGrams(hit: FoodHit, grams: number) {
  const g = Math.max(0, grams)
  const f = g / 100
  return {
    calories: Math.round(hit.per100g.calories * f),
    protein: Math.round(hit.per100g.protein * f * 10) / 10,
    carbs: Math.round(hit.per100g.carbs * f * 10) / 10,
    fat: Math.round(hit.per100g.fat * f * 10) / 10,
  }
}

async function foodApi(params: URLSearchParams): Promise<Response> {
  return fetch(`/api/food-search?${params}`)
}

export async function searchFoods(query: string, pageSize = 12): Promise<FoodHit[]> {
  const q = query.trim()
  if (q.length < 2) return []

  if (/^\d{8,14}$/.test(q)) {
    const one = await lookupFoodBarcode(q)
    return one ? [one] : []
  }

  const res = await foodApi(
    new URLSearchParams({
      q,
      page_size: String(pageSize),
    }),
  )
  if (!res.ok) throw new Error('Food search failed — try again')
  const json = (await res.json()) as { foods?: FoodHit[]; error?: string }
  return json.foods || []
}

/** @deprecated use searchFoods */
export const searchOpenFoodFacts = searchFoods

export async function lookupFoodBarcode(barcode: string): Promise<FoodHit | null> {
  const code = barcode.trim()
  if (!/^\d{8,14}$/.test(code)) return null
  const res = await foodApi(new URLSearchParams({ barcode: code }))
  if (!res.ok) throw new Error('Barcode lookup failed')
  const json = (await res.json()) as { foods?: FoodHit[]; error?: string }
  return json.foods?.[0] || null
}

/** @deprecated use lookupFoodBarcode */
export const lookupOpenFoodFactsBarcode = lookupFoodBarcode

export function foodSourceLabel(hit: FoodHit): string {
  if (hit.code.startsWith('label:')) return 'Nutrition Facts'
  if (hit.source === 'usda' || hit.code.startsWith('usda:')) return 'USDA'
  return 'Open Food Facts'
}
