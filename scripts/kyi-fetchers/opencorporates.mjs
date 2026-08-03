/**
 * OpenCorporates fetcher.
 * Searches the free tier of the OpenCorporates API for corporate registry data.
 * Free tier: 200 requests/day, no API key needed.
 */
import { fetchJson, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'company_name', 'company_number', 'jurisdiction',
  'status', 'incorporation_date', 'company_type',
  'city', 'state', 'zip_code', 'registered_address', 'link', 'node_type', 'relationship_type',
]

const SEARCH_TERMS = [
  'venture capital', 'private equity', 'investment fund',
  'capital partners', 'holdings', 'asset management',
]

export async function fetchOpenCorporates(dataDir) {
  console.log('  [OpenCorporates] Searching corporate registry...')
  const rows = []

  for (const term of SEARCH_TERMS) {
    try {
      const url =
        `https://api.opencorporates.com/v0.4/companies/search` +
        `?q=${encodeURIComponent(term)}&jurisdiction_code=us&per_page=30&order=score`
      const data = await fetchJson(url)
      const companies = data?.results?.companies || []
      for (const item of companies) {
        const c = item.company || {}
        const name = (c.name || '').trim()
        if (!name) continue
        const addr = c.registered_address || {}
        rows.push({
          source: 'OPENCORPORATES',
          company_name: name,
          company_number: c.company_number || '',
          jurisdiction: c.jurisdiction_code || '',
          status: c.current_status || '',
          incorporation_date: c.incorporation_date || '',
          company_type: c.company_type || '',
          city: (addr.locality || '').trim(),
          state: (addr.region || '').trim(),
          zip_code: (addr.postal_code || '').trim(),
          registered_address: (c.registered_address_in_full || '').replace(/\n/g, ', ').slice(0, 300),
          link: c.opencorporates_url || '',
          node_type: 'firm',
          relationship_type: 'corporate_registry',
        })
      }
      await sleep(2000)
    } catch (e) {
      console.warn(`  [OpenCorporates] Search "${term}" failed:`, e.message)
    }
  }

  const seen = new Set()
  const unique = rows.filter((r) => {
    const k = `${r.company_name.toLowerCase()}_${r.jurisdiction}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  writeCsv(dataDir, 'opencorporates.csv', HEADERS, unique)
}
