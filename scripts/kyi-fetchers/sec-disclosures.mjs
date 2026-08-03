/**
 * SEC Company Financial & Operational Disclosure fetchers:
 * 10-K, 10-Q, 8-K, DEF 14A, 20-F, 6-K.
 * All via EDGAR EFTS API.
 */
import { fetchEdgarFilings, parseEdgarHit, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'company_name', 'cik', 'filing_type', 'filing_date',
  'date', 'link', 'city', 'state', 'node_type', 'relationship_type',
]

async function fetchDisclosure(formParam, sourceName, relType, lookbackDays) {
  const hits = await fetchEdgarFilings(formParam, lookbackDays)
  const rows = []
  for (const hit of hits) {
    const p = parseEdgarHit(hit)
    if (!p.name) continue
    rows.push({
      source: sourceName,
      company_name: p.name,
      cik: p.cik,
      filing_type: p.form,
      filing_date: p.fileDate,
      date: p.fileDate,
      link: p.filingUrl,
      city: p.city,
      state: p.state,
      node_type: 'firm',
      relationship_type: relType,
    })
  }
  return rows
}

export async function fetchSec10k(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching 10-K filings (annual reports)...')
  const rows = await fetchDisclosure('10-K', 'SEC_10K', 'annual_report', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_10k.csv', HEADERS, rows)
}

export async function fetchSec10q(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching 10-Q filings (quarterly reports)...')
  const rows = await fetchDisclosure('10-Q', 'SEC_10Q', 'quarterly_report', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_10q.csv', HEADERS, rows)
}

export async function fetchSec8k(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching 8-K filings (current reports)...')
  const rows = await fetchDisclosure('8-K', 'SEC_8K', 'current_report', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_8k.csv', HEADERS, rows)
}

export async function fetchSecDef14a(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching DEF 14A filings (proxy statements)...')
  const rows = await fetchDisclosure('DEF 14A', 'SEC_DEF14A', 'proxy_statement', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_def14a.csv', HEADERS, rows)
}

export async function fetchSec20f(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching 20-F filings (foreign annual reports)...')
  const rows = await fetchDisclosure('20-F', 'SEC_20F', 'foreign_annual_report', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_20f.csv', HEADERS, rows)
}

export async function fetchSec6k(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching 6-K filings (foreign current reports)...')
  const rows = await fetchDisclosure('6-K', 'SEC_6K', 'foreign_current_report', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_6k.csv', HEADERS, rows)
}
