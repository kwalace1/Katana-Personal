/**
 * Food search proxy — USDA FoodData Central (generic foods) + Open Food Facts (packaged).
 * Same-origin so Safari / PWA blockers never touch third-party APIs from the browser.
 */

const OFF_SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl'
const OFF_PRODUCT = 'https://world.openfoodfacts.org/api/v2/product'
const USDA_SEARCH = 'https://api.nal.usda.gov/fdc/v1/foods/search'

const OFF_UA = 'KatanaPersonal - Web - Version 1.0 - https://katana-personal.vercel.app'

const OFF_FIELDS =
  'code,product_name,product_name_en,brands,image_front_small_url,image_small_url,nutriments,serving_size,serving_quantity'

export type FoodHitDto = {
  code: string
  name: string
  brand?: string
  imageUrl?: string
  source: 'usda' | 'off'
  per100g: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  servingSizeLabel?: string
  servingGrams?: number
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  })
}

function num(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : 0
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function usdaApiKey(): string {
  return (
    process.env.USDA_FDC_API_KEY ||
    process.env.USDA_API_KEY ||
    process.env.FDC_API_KEY ||
    'DEMO_KEY'
  )
}

async function fetchWithRetry(url: string, init?: RequestInit, attempts = 3): Promise<Response> {
  let last: Response | null = null
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, init)
    if (res.status !== 503 && res.status !== 502) return res
    last = res
    await new Promise((r) => setTimeout(r, 200 * (i + 1)))
  }
  return last!
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

function mapOffProduct(p: OffProduct, fallbackCode?: string): FoodHitDto | null {
  const name = (p.product_name || p.product_name_en || '').trim()
  if (!name) return null
  const n = p.nutriments || {}
  const calories = num(n['energy-kcal_100g'] ?? n.energy_kcal_100g ?? n['energy-kcal'])
  const protein = num(n.proteins_100g ?? n.proteins)
  const carbs = num(n.carbohydrates_100g ?? n.carbohydrates)
  const fat = num(n.fat_100g ?? n.fat)
  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null
  const servingGrams = num(p.serving_quantity) || undefined
  return {
    code: String(p.code || fallbackCode || ''),
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    imageUrl: p.image_front_small_url || p.image_small_url,
    source: 'off',
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

type UsdaNutrient = {
  nutrientId?: number
  nutrientNumber?: string | number
  value?: number
  amount?: number
}

type UsdaFood = {
  fdcId?: number
  description?: string
  brandOwner?: string
  dataType?: string
  foodCategory?: string
  foodNutrients?: UsdaNutrient[]
}

function usdaNutrient(ns: UsdaNutrient[], ids: number[], numbers: string[]): number {
  const hit = ns.find(
    (n) =>
      (n.nutrientId != null && ids.includes(n.nutrientId)) ||
      numbers.includes(String(n.nutrientNumber ?? '')),
  )
  return num(hit?.value ?? hit?.amount)
}

function mapUsdaFood(f: UsdaFood): FoodHitDto | null {
  const name = (f.description || '').trim()
  if (!name || f.fdcId == null) return null
  const ns = f.foodNutrients || []
  // Energy (kcal) 1008/208, Protein 1003/203, Fat 1004/204, Carb 1005/205
  let calories = usdaNutrient(ns, [1008], ['208'])
  const protein = usdaNutrient(ns, [1003], ['203'])
  const fat = usdaNutrient(ns, [1004], ['204'])
  let carbs = Math.max(0, usdaNutrient(ns, [1005], ['205']))
  // Some Foundation foods only publish energy as kJ
  if (calories <= 0) {
    const kj = usdaNutrient(ns, [1062], ['268'])
    if (kj > 0) calories = kj / 4.184
  }
  // Last resort: Atwater estimate so raw meats still show usable kcal
  if (calories <= 0 && (protein > 0 || fat > 0 || carbs > 0)) {
    calories = protein * 4 + carbs * 4 + fat * 9
  }
  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null
  const brandBits = [f.dataType, f.foodCategory].filter(Boolean)
  return {
    code: `usda:${f.fdcId}`,
    name,
    brand: brandBits.length ? brandBits.join(' · ') : 'USDA',
    source: 'usda',
    per100g: {
      calories: Math.round(calories),
      protein: round1(protein),
      carbs: round1(carbs),
      fat: round1(fat),
    },
    servingSizeLabel: '100 g',
    servingGrams: 100,
  }
}

async function searchUsda(query: string, pageSize: number): Promise<FoodHitDto[]> {
  const params = new URLSearchParams({
    api_key: usdaApiKey(),
    query,
    pageSize: String(pageSize),
    // Foundation + SR Legacy = generic / home-cooking foods Americans actually eat
    dataType: 'Foundation,SR Legacy',
  })
  const res = await fetchWithRetry(`${USDA_SEARCH}?${params}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return []
  const body = (await res.json()) as { foods?: UsdaFood[] }
  const hits: FoodHitDto[] = []
  for (const f of body.foods || []) {
    const mapped = mapUsdaFood(f)
    if (mapped) hits.push(mapped)
  }
  return hits
}

async function searchOff(query: string, pageSize: number): Promise<FoodHitDto[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(pageSize),
    fields: OFF_FIELDS,
  })
  const res = await fetchWithRetry(`${OFF_SEARCH}?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': OFF_UA,
    },
  })
  if (!res.ok) return []
  const body = (await res.json()) as { products?: OffProduct[] }
  const hits: FoodHitDto[] = []
  for (const p of body.products || []) {
    const mapped = mapOffProduct(p)
    if (mapped) hits.push(mapped)
  }
  return hits
}

async function lookupOffBarcode(code: string): Promise<FoodHitDto | null> {
  const res = await fetchWithRetry(
    `${OFF_PRODUCT}/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': OFF_UA,
      },
    },
  )
  if (!res.ok) return null
  const body = (await res.json()) as { status?: number; product?: OffProduct }
  if (body.status !== 1 || !body.product) return null
  return mapOffProduct(body.product, code)
}

function mergeHits(usda: FoodHitDto[], off: FoodHitDto[], limit: number): FoodHitDto[] {
  const seen = new Set<string>()
  const out: FoodHitDto[] = []
  const push = (hit: FoodHitDto) => {
    const key = hit.name.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) return
    seen.add(key)
    out.push(hit)
  }
  // USDA first — chicken breast, ground beef, eggs, rice, etc.
  for (const h of usda) {
    if (out.length >= limit) break
    push(h)
  }
  for (const h of off) {
    if (out.length >= limit) break
    push(h)
  }
  return out
}

/** GET /api/food-search?q=chicken+breast | GET /api/food-search?barcode=… */
export async function handleFoodSearchRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const { searchParams } = new URL(req.url)
  const barcode = (searchParams.get('barcode') || '').trim()
  const q = (searchParams.get('q') || '').trim()
  const pageSize = Math.min(24, Math.max(1, Number(searchParams.get('page_size')) || 12))

  try {
    if (/^\d{8,14}$/.test(barcode) || /^\d{8,14}$/.test(q)) {
      const code = barcode || q
      const hit = await lookupOffBarcode(code)
      return json({ foods: hit ? [hit] : [] })
    }

    if (q.length < 2) {
      return json({ foods: [] })
    }

    // Prefer USDA for generic foods; OFF fills branded / packaged products.
    const usdaSize = Math.min(10, pageSize)
    const offSize = Math.min(10, pageSize)
    const [usda, off] = await Promise.all([searchUsda(q, usdaSize), searchOff(q, offSize)])
    const foods = mergeHits(usda, off, pageSize)

    if (foods.length === 0) {
      return json({ foods: [], error: 'No foods found' }, 200)
    }
    return json({ foods })
  } catch (err) {
    return json(
      { foods: [], error: err instanceof Error ? err.message : 'Food search failed' },
      502,
    )
  }
}
