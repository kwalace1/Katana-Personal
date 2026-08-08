/**
 * Open Food Facts proxy — same-origin so Safari / PWA content blockers
 * and service workers never touch cross-origin OFF requests.
 */

const OFF_SEARCH = 'https://world.openfoodfacts.org/api/v2/search'
const OFF_PRODUCT = 'https://world.openfoodfacts.org/api/v2/product'

const OFF_UA = 'KatanaPersonal - Web - Version 1.0 - https://katana-personal.vercel.app'

const PRODUCT_FIELDS =
  'code,product_name,product_name_en,brands,image_front_small_url,image_small_url,nutriments,serving_size,serving_quantity'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  })
}

async function offGet(url: string): Promise<Response> {
  let last: Response | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': OFF_UA,
      },
    })
    // OFF edge occasionally returns HTML 503 pages — retry briefly.
    if (res.status !== 503 && res.status !== 502) return res
    last = res
    await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
  }
  return last!
}

/** GET /api/food-search?q=chicken | GET /api/food-search?barcode=3017620422003 */
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
      const upstream = await offGet(
        `${OFF_PRODUCT}/${encodeURIComponent(code)}.json?fields=${PRODUCT_FIELDS}`,
      )
      if (!upstream.ok) {
        return json({ error: 'Barcode lookup failed', status: upstream.status }, 502)
      }
      const body = await upstream.text()
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      })
    }

    if (q.length < 2) {
      return json({ products: [], count: 0 })
    }

    const params = new URLSearchParams({
      search_terms: q,
      page_size: String(pageSize),
      fields: PRODUCT_FIELDS,
    })
    const upstream = await offGet(`${OFF_SEARCH}?${params}`)
    if (!upstream.ok) {
      return json({ error: 'Food search failed', status: upstream.status }, 502)
    }
    const body = await upstream.text()
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Food search failed' },
      502,
    )
  }
}
