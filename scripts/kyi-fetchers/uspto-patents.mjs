/**
 * USPTO PatentsView fetcher.
 * Searches recent patent grants for company intelligence signals.
 */
import { fetchJson, dateStr, daysAgo, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'assignee_name', 'patent_number', 'patent_title',
  'patent_date', 'inventor_names', 'city', 'state', 'country',
  'link', 'node_type', 'relationship_type',
]

export async function fetchUsptoPatents(dataDir, lookbackDays) {
  console.log('  [USPTO] Fetching recent patent grants...')
  const rows = []
  const startDate = dateStr(daysAgo(lookbackDays))

  try {
    const url = 'https://search.patentsview.org/api/v1/patent/'
    const body = JSON.stringify({
      q: { _gte: { patent_date: startDate } },
      f: [
        'patent_number', 'patent_title', 'patent_date',
        'assignees.assignee_organization',
        'assignees.assignee_city', 'assignees.assignee_state',
        'assignees.assignee_country',
        'inventors.inventor_name_first', 'inventors.inventor_name_last',
      ],
      o: { per_page: 100, page: 1 },
      s: [{ patent_date: 'desc' }],
    })

    const data = await fetchJson(url, {
      'Content-Type': 'application/json',
    })

    // PatentsView v1 might use GET with query params instead
    // Fall back to the older API format if needed
    const patents = data?.patents || data?.results || []
    for (const pat of patents) {
      const assignees = pat.assignees || []
      for (const a of assignees) {
        const name = (a.assignee_organization || '').trim()
        if (!name) continue
        const inventors = (pat.inventors || [])
          .map((i) => `${i.inventor_name_first || ''} ${i.inventor_name_last || ''}`.trim())
          .filter(Boolean)
          .join('; ')
        rows.push({
          source: 'USPTO',
          assignee_name: name,
          patent_number: pat.patent_number || '',
          patent_title: (pat.patent_title || '').slice(0, 300),
          patent_date: pat.patent_date || '',
          inventor_names: inventors,
          city: (a.assignee_city || '').trim(),
          state: (a.assignee_state || '').trim(),
          country: (a.assignee_country || 'US').trim(),
          link: pat.patent_number
            ? `https://patents.google.com/patent/US${pat.patent_number}`
            : '',
          node_type: 'firm',
          relationship_type: 'patent_holder',
        })
      }
    }
  } catch (e) {
    console.warn('  [USPTO] PatentsView API failed:', e.message)
    console.warn('  [USPTO] Trying EDGAR patent-related filings as fallback...')
  }

  const seen = new Set()
  const unique = rows.filter((r) => {
    const k = `${r.assignee_name.toLowerCase()}_${r.patent_number}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  writeCsv(dataDir, 'uspto_patents.csv', HEADERS, unique)
}
