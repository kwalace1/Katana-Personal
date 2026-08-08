/**
 * Open Food Facts client for Katana Nutrition.
 * Uses the public REST API (Apache-friendly for our app code; food data is ODbL — credit the source).
 * @see https://world.openfoodfacts.org
 */

const OFF_SEARCH = 'https://world.openfoodfacts.org/api/v2/search'
const OFF_PRODUCT = 'https://world.openfoodfacts.org/api/v2/product'
export type FoodHit = {
  code: string
  name: string
  brand?: string
  imageUrl?: string
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

type OffNutriments = Record<string, number | string | undefined>

type OffProduct = {
  code?: string
  product_name?: string
  product_name_en?: string
  brands?: string
  image_front_small_url?: string
  image_small_url?: string
  serving_size?: string
  serving_quantity?: number | string
  nutriments?: OffNutriments
}

function num(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : 0
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function mapProduct(p: OffProduct, fallbackCode?: string): FoodHit | null {
  const name = (p.product_name || p.product_name_en || '').trim()
  if (!name) return null
  const n = p.nutriments || {}
  const calories = num(n['energy-kcal_100g'] ?? n.energy_kcal_100g ?? n['energy-kcal'])
  const protein = num(n.proteins_100g ?? n.proteins)
  const carbs = num(n.carbohydrates_100g ?? n.carbohydrates)
  const fat = num(n.fat_100g ?? n.fat)
  // Skip empty shells with no nutrition
  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null

  const servingGrams = num(p.serving_quantity) || undefined
  return {
    code: String(p.code || fallbackCode || ''),
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    imageUrl: p.image_front_small_url || p.image_small_url,
    per100g: {
      calories: Math.round(calories),
      protein: round1(protein),
      carbs: round1(carbs),
      fat: round1(fat),
    },
    servingSizeLabel: p.serving_size || undefined,
    servingGrams: servingGrams && servingGrams > 0 ? servingGrams : undefined,
  }
}

/** Scale per-100g macros to a gram amount. */
export function macrosForGrams(hit: FoodHit, grams: number) {
  const g = Math.max(0, grams)
  const f = g / 100
  return {
    calories: Math.round(hit.per100g.calories * f),
    protein: round1(hit.per100g.protein * f),
    carbs: round1(hit.per100g.carbs * f),
    fat: round1(hit.per100g.fat * f),
  }
}

async function offFetch(url: string): Promise<Response> {
  // Keep headers CORS-simple. Custom X-* headers trigger a preflight that OFF rejects.
  return fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  })
}

export async function searchOpenFoodFacts(query: string, pageSize = 12): Promise<FoodHit[]> {
  const q = query.trim()
  if (q.length < 2) return []

  // Digits-only → treat as barcode
  if (/^\d{8,14}$/.test(q)) {
    const one = await lookupOpenFoodFactsBarcode(q)
    return one ? [one] : []
  }

  const params = new URLSearchParams({
    search_terms: q,
    page_size: String(pageSize),
    fields:
      'code,product_name,product_name_en,brands,image_front_small_url,nutriments,serving_size,serving_quantity',
  })

  const res = await offFetch(`${OFF_SEARCH}?${params}`)
  if (!res.ok) throw new Error('Food search failed — try again')
  const json = (await res.json()) as { products?: OffProduct[] }
  const hits: FoodHit[] = []
  for (const p of json.products || []) {
    const mapped = mapProduct(p)
    if (mapped) hits.push(mapped)
  }
  return hits
}

export async function lookupOpenFoodFactsBarcode(barcode: string): Promise<FoodHit | null> {
  const code = barcode.trim()
  if (!/^\d{8,14}$/.test(code)) return null
  const res = await offFetch(
    `${OFF_PRODUCT}/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_en,brands,image_front_small_url,nutriments,serving_size,serving_quantity`,
  )
  if (!res.ok) throw new Error('Barcode lookup failed')
  const json = (await res.json()) as { status?: number; product?: OffProduct }
  if (json.status !== 1 || !json.product) return null
  return mapProduct(json.product, code)
}
