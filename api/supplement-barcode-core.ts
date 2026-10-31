import {
  InvalidBarcodeError,
  lookupSupplementByBarcode,
  SupplementLookupError,
} from '../src/lib/supplements/barcode'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

/** GET /api/supplement-barcode?code=012345678905 */
export async function handleSupplementBarcodeRequest(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const code = new URL(req.url).searchParams.get('code') || ''
  try {
    const match = await lookupSupplementByBarcode(code)
    if (!match) return json({ found: false })
    return json({
      found: true,
      name: match.name,
      labelServing: match.labelServing ?? null,
    })
  } catch (err) {
    if (err instanceof InvalidBarcodeError) return json({ error: 'Invalid barcode' }, 400)
    if (err instanceof SupplementLookupError) return json({ error: 'Supplement lookup failed' }, 502)
    return json({ error: 'Supplement lookup failed' }, 502)
  }
}
