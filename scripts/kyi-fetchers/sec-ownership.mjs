/**
 * SEC Ownership & Activity fetchers: 13D, 13G, Form 4, Form 3, Form 5, and amendments.
 * All via EDGAR EFTS API.
 */
import { fetchEdgarFilings, parseEdgarHit, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'filer_name', 'cik', 'filing_type', 'filing_date',
  'date', 'link', 'city', 'state', 'node_type', 'relationship_type',
]

async function fetchFormGroup(formParam, sourceName, nodeType, relType, lookbackDays) {
  const hits = await fetchEdgarFilings(formParam, lookbackDays)
  const rows = []
  for (const hit of hits) {
    const p = parseEdgarHit(hit)
    if (!p.name) continue
    rows.push({
      source: sourceName,
      filer_name: p.name,
      cik: p.cik,
      filing_type: p.form,
      filing_date: p.fileDate,
      date: p.fileDate,
      link: p.filingUrl,
      city: p.city,
      state: p.state,
      node_type: nodeType,
      relationship_type: relType,
    })
  }
  return rows
}

export async function fetchSec13d(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching 13D filings (beneficial ownership >5%)...')
  const rows = [
    ...(await fetchFormGroup('SC 13D', 'SEC_13D', 'firm', 'beneficial_ownership', lookbackDays)),
    ...(await fetchFormGroup('SC 13D/A', 'SEC_13D_A', 'firm', 'beneficial_ownership', lookbackDays)),
  ]
  await sleep(500)
  writeCsv(dataDir, 'sec_13d.csv', HEADERS, rows)
}

export async function fetchSec13g(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching 13G filings (passive beneficial ownership >5%)...')
  const rows = [
    ...(await fetchFormGroup('SC 13G', 'SEC_13G', 'firm', 'passive_ownership', lookbackDays)),
    ...(await fetchFormGroup('SC 13G/A', 'SEC_13G_A', 'firm', 'passive_ownership', lookbackDays)),
  ]
  await sleep(500)
  writeCsv(dataDir, 'sec_13g.csv', HEADERS, rows)
}

export async function fetchSecForm4(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching Form 4 filings (insider transactions)...')
  const rows = await fetchFormGroup('4', 'SEC_FORM4', 'person', 'insider_transaction', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_form4.csv', HEADERS, rows)
}

export async function fetchSecForm3(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching Form 3 filings (initial insider ownership)...')
  const rows = await fetchFormGroup('3', 'SEC_FORM3', 'person', 'initial_ownership', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_form3.csv', HEADERS, rows)
}

export async function fetchSecForm5(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching Form 5 filings (annual insider changes)...')
  const rows = await fetchFormGroup('5', 'SEC_FORM5', 'person', 'annual_ownership_change', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_form5.csv', HEADERS, rows)
}
