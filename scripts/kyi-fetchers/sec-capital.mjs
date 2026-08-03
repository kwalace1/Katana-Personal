/**
 * SEC Capital Formation & M&A fetchers:
 * S-1, S-3, S-4, F-1, Schedule TO.
 * All via EDGAR EFTS API.
 */
import { fetchEdgarFilings, parseEdgarHit, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'company_name', 'cik', 'filing_type', 'filing_date',
  'date', 'link', 'city', 'state', 'node_type', 'relationship_type',
]

async function fetchCapital(formParam, sourceName, relType, lookbackDays) {
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

export async function fetchSecS1(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching S-1 filings (IPO registration)...')
  const rows = await fetchCapital('S-1', 'SEC_S1', 'ipo_registration', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_s1.csv', HEADERS, rows)
}

export async function fetchSecS3(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching S-3 filings (shelf registration)...')
  const rows = await fetchCapital('S-3', 'SEC_S3', 'shelf_registration', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_s3.csv', HEADERS, rows)
}

export async function fetchSecS4(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching S-4 filings (M&A registration)...')
  const rows = await fetchCapital('S-4', 'SEC_S4', 'merger_acquisition', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_s4.csv', HEADERS, rows)
}

export async function fetchSecF1(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching F-1 filings (foreign IPO registration)...')
  const rows = await fetchCapital('F-1', 'SEC_F1', 'foreign_ipo', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_f1.csv', HEADERS, rows)
}

export async function fetchSecScheduleTo(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching Schedule TO filings (tender offers)...')
  const rowsT = await fetchCapital('SC TO-T', 'SEC_SCHEDULE_TO', 'tender_offer', lookbackDays)
  const rowsC = await fetchCapital('SC TO-C', 'SEC_SCHEDULE_TO', 'tender_offer', lookbackDays)
  await sleep(500)
  writeCsv(dataDir, 'sec_schedule_to.csv', HEADERS, [...rowsT, ...rowsC])
}
