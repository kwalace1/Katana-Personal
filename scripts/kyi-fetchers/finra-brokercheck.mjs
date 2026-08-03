/**
 * FINRA BrokerCheck fetcher.
 * Searches for broker/firm records via the public BrokerCheck API.
 */
import { fetchJson, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'entity_name', 'crd_number', 'entity_type', 'firm_name',
  'branch_city', 'branch_state', 'disclosure_count', 'registration_status',
  'link', 'node_type', 'relationship_type',
]

const SEARCH_TERMS = [
  'venture capital', 'private equity', 'investment fund',
  'capital management', 'asset management', 'hedge fund',
]

export async function fetchFinraBrokercheck(dataDir) {
  console.log('  [FINRA] Fetching BrokerCheck records...')
  const rows = []

  for (const term of SEARCH_TERMS) {
    try {
      const url =
        `https://api.brokercheck.finra.org/search/firm?query=${encodeURIComponent(term)}` +
        `&filter=active=true&hl=true&nrows=50&start=0`
      const data = await fetchJson(url)
      const hits = data?.hits?.hits || []
      for (const hit of hits) {
        const s = hit._source || {}
        const name = (s.bc_firm_name || s.firm_name || '').trim()
        if (!name) continue

        // Address is in firm_ia_address_details as a JSON string
        let city = ''
        let state = ''
        const addrRaw = s.firm_ia_address_details || s.bc_address_details || ''
        if (addrRaw) {
          try {
            const addr = typeof addrRaw === 'string' ? JSON.parse(addrRaw) : addrRaw
            const office = addr.officeAddress || addr.mailingAddress || addr
            city = (office.city || '').trim()
            state = (office.state || office.stateCode || '').trim()
          } catch {
            // not parseable — leave empty
          }
        }

        rows.push({
          source: 'FINRA_BROKERCHECK',
          entity_name: name,
          crd_number: s.firm_ia_id_no || s.firm_bc_id || '',
          entity_type: 'firm',
          firm_name: name,
          branch_city: city,
          branch_state: state,
          disclosure_count: s.bc_disclosure_cnt || 0,
          registration_status: s.bc_current_employ_status || '',
          link: s.firm_ia_id_no
            ? `https://brokercheck.finra.org/firm/summary/${s.firm_ia_id_no}`
            : '',
          node_type: 'firm',
          relationship_type: 'broker_dealer',
        })
      }
      await sleep(1000)
    } catch (e) {
      console.warn(`  [FINRA] Search "${term}" failed:`, e.message)
    }
  }

  const seen = new Set()
  const unique = rows.filter((r) => {
    const k = r.entity_name.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  writeCsv(dataDir, 'finra_brokercheck.csv', HEADERS, unique)
}
