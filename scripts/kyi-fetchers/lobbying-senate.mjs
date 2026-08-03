/**
 * Senate Lobbying Disclosure (LDA) fetcher.
 * Uses the public Senate LDA API at lda.senate.gov.
 */
import { fetchJson, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'registrant_name', 'client_name', 'lobbyist_names',
  'filing_type', 'filing_date', 'issue_areas', 'amount',
  'registrant_city', 'registrant_state', 'registrant_zip',
  'link', 'node_type', 'relationship_type',
]

export async function fetchLobbySenate(dataDir, lookbackDays) {
  console.log('  [Lobbying] Fetching Senate LDA filings...')
  const rows = []
  const year = new Date().getFullYear()

  try {
    const url =
      `https://lda.senate.gov/api/v1/filings/` +
      `?filing_year=${year}&filing_type=Q&page_size=100`
    const data = await fetchJson(url, { Accept: 'application/json' })
    const results = data?.results || []
    for (const f of results) {
      const registrant = (f.registrant?.name || '').trim()
      const client = (f.client?.name || '').trim()
      if (!registrant && !client) continue
      const lobbyists = (f.lobbying_activities || [])
        .flatMap((a) => (a.lobbyists || []).map((l) => l.lobbyist?.name || ''))
        .filter(Boolean)
        .slice(0, 10)
        .join('; ')
      const issues = (f.lobbying_activities || [])
        .map((a) => a.general_issue_code_display || '')
        .filter(Boolean)
        .slice(0, 5)
        .join('; ')
      // Registrant address — LDA API exposes general_city / general_state / general_country
      const reg = f.registrant || {}
      const regCity = (reg.general_city || reg.ppb_city || '').trim()
      const regState = (reg.general_state || reg.ppb_state || '').trim()
      const regZip = (reg.general_zip || '').trim()
      rows.push({
        source: 'LOBBYING_SENATE',
        registrant_name: registrant,
        client_name: client,
        lobbyist_names: lobbyists,
        filing_type: f.filing_type_display || 'Quarterly',
        filing_date: f.dt_posted || '',
        issue_areas: issues,
        amount: f.income || f.expenses || '',
        registrant_city: regCity,
        registrant_state: regState,
        registrant_zip: regZip,
        link: f.filing_uuid
          ? `https://lda.senate.gov/filings/public/filing/${f.filing_uuid}/`
          : '',
        node_type: 'firm',
        relationship_type: 'lobbying',
      })
    }
  } catch (e) {
    console.warn('  [Lobbying Senate] Failed:', e.message)
  }

  await sleep(500)
  writeCsv(dataDir, 'lobbying_senate.csv', HEADERS, rows)
}
