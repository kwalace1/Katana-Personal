/**
 * UK Companies House fetcher.
 * Uses the free Companies House API (requires API key registration at
 * https://developer.company-information.service.gov.uk/).
 *
 * Env: COMPANIES_HOUSE_API_KEY (optional -- skipped if not set)
 */
import { fetchJson, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'company_name', 'company_number', 'company_status',
  'company_type', 'date_of_creation', 'jurisdiction',
  'registered_office', 'link', 'node_type', 'relationship_type',
]

const SEARCH_TERMS = [
  'venture capital', 'private equity', 'investment fund',
  'capital partners', 'asset management',
]

export async function fetchCompaniesHouse(dataDir) {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY || ''
  if (!apiKey) {
    console.log('  [Companies House] Skipped -- COMPANIES_HOUSE_API_KEY not set')
    return
  }

  console.log('  [Companies House] Searching UK company registry...')
  const rows = []
  const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64')

  for (const term of SEARCH_TERMS) {
    try {
      const url =
        `https://api.company-information.service.gov.uk/search/companies` +
        `?q=${encodeURIComponent(term)}&items_per_page=50`
      const data = await fetchJson(url, { Authorization: authHeader })
      const items = data?.items || []
      for (const c of items) {
        const name = (c.title || '').trim()
        if (!name) continue
        const addr = c.address || {}
        const addrStr = [addr.address_line_1, addr.locality, addr.region, addr.postal_code, addr.country]
          .filter(Boolean)
          .join(', ')
        rows.push({
          source: 'COMPANIES_HOUSE',
          company_name: name,
          company_number: c.company_number || '',
          company_status: c.company_status || '',
          company_type: c.company_type || '',
          date_of_creation: c.date_of_creation || '',
          jurisdiction: 'gb',
          registered_office: addrStr.slice(0, 300),
          link: c.company_number
            ? `https://find-and-update.company-information.service.gov.uk/company/${c.company_number}`
            : '',
          node_type: 'firm',
          relationship_type: 'uk_corporate_registry',
        })
      }
      await sleep(1000)
    } catch (e) {
      console.warn(`  [Companies House] Search "${term}" failed:`, e.message)
    }
  }

  const seen = new Set()
  const unique = rows.filter((r) => {
    const k = r.company_number || r.company_name.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  writeCsv(dataDir, 'companies_house.csv', HEADERS, unique)
}
