/**
 * SEC IAPD / Form ADV fetcher.
 * Uses the IAPD search API to find registered investment advisers.
 * The full bulk XML is very large; this uses the search endpoint for targeted results.
 */
import { fetchJson, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'adviser_name', 'crd_number', 'sec_number',
  'city', 'state', 'country', 'status',
  'link', 'node_type', 'relationship_type',
]

const SEARCH_TERMS = [
  'venture', 'private equity', 'capital management',
  'investment partners', 'fund management', 'asset management',
]

export async function fetchSecAdv(dataDir) {
  console.log('  [SEC IAPD] Fetching Form ADV adviser records...')
  const rows = []

  for (const term of SEARCH_TERMS) {
    try {
      const url =
        `https://api.adviserinfo.sec.gov/IAPD/Content/Search/api/Firm?query=${encodeURIComponent(term)}` +
        `&fromDate=&toDate=&officeState=&ofcCountry=&Status=Active&ownersOnly=false` +
        `&skip=0&top=50`
      const data = await fetchJson(url)
      const hits = data?.Results || data?.results || []
      for (const firm of hits) {
        const name = (firm.FirmName || firm.firmName || '').trim()
        if (!name) continue
        const crd = firm.FirmCrdNumber || firm.firmCrdNumber || ''
        rows.push({
          source: 'SEC_ADV',
          adviser_name: name,
          crd_number: String(crd),
          sec_number: firm.SecNumber || firm.secNumber || '',
          city: (firm.City || firm.city || '').trim(),
          state: (firm.State || firm.state || '').trim(),
          country: (firm.Country || firm.country || 'US').trim(),
          status: firm.Status || firm.status || 'Active',
          link: crd
            ? `https://adviserinfo.sec.gov/firm/summary/${crd}`
            : '',
          node_type: 'firm',
          relationship_type: 'investment_adviser',
        })
      }
      await sleep(1000)
    } catch (e) {
      console.warn(`  [SEC IAPD] Search "${term}" failed:`, e.message)
    }
  }

  const seen = new Set()
  const unique = rows.filter((r) => {
    const k = (r.crd_number || r.adviser_name).toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  writeCsv(dataDir, 'sec_adv.csv', HEADERS, unique)
}
