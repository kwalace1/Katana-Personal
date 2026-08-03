/**
 * SEC Enforcement Action fetcher.
 * Fetches litigation releases from EDGAR EFTS.
 */
import { fetchJson, dateStr, daysAgo, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'entity_name', 'release_number', 'filing_date',
  'date', 'link', 'summary', 'node_type', 'relationship_type',
]

export async function fetchSecEnforcement(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching enforcement actions (litigation releases)...')
  const rows = []
  const startDate = dateStr(daysAgo(lookbackDays))
  const endDate = dateStr(new Date())

  try {
    const url =
      `https://efts.sec.gov/LATEST/search-index?q=%22litigation+release%22` +
      `&dateRange=custom&startdt=${startDate}&enddt=${endDate}&start=0&count=200`
    const data = await fetchJson(url, { 'User-Agent': 'Katana-KYI/1.0 admin@katana.dev' })
    const hits = data.hits?.hits || []
    for (const hit of hits) {
      const s = hit._source || {}
      const displayNames = Array.isArray(s.display_names) ? s.display_names : []
      const name = (displayNames[0] || '').trim()
      if (!name) continue
      rows.push({
        source: 'SEC_ENFORCEMENT',
        entity_name: name,
        release_number: s.adsh || '',
        filing_date: s.file_date || '',
        date: s.file_date || '',
        link: s.file_url || '',
        summary: (s.form || 'Litigation Release').slice(0, 300),
        node_type: 'entity',
        relationship_type: 'enforcement_action',
      })
    }
  } catch (e) {
    console.warn('  [SEC Enforcement] Failed:', e.message)
  }

  await sleep(500)
  writeCsv(dataDir, 'sec_enforcement.csv', HEADERS, rows)
}
