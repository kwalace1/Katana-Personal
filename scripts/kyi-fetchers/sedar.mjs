/**
 * SEDAR+ (Canada) fetcher.
 * Uses the SEDAR+ search XHR endpoint to fetch Canadian securities filings.
 * No official API -- this uses the same POST endpoint the search UI calls.
 */
import { fetchJson, writeCsv, dateStr, daysAgo, sleep } from './_helpers.mjs'
import https from 'https'

const HEADERS = [
  'source', 'issuer_name', 'filing_type', 'filing_date',
  'date', 'link', 'category', 'node_type', 'relationship_type',
]

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'Katana-KYI/1.0 (kyi-fetch)',
        ...headers,
      },
      timeout: 30_000,
    }
    const req = https.request(opts, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch (e) { reject(new Error('JSON parse error: ' + e.message)) }
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
    req.write(payload)
    req.end()
  })
}

export async function fetchSedar(dataDir, lookbackDays) {
  console.log('  [SEDAR+] Fetching Canadian securities filings...')
  const rows = []
  const startDate = dateStr(daysAgo(lookbackDays))

  try {
    const body = {
      keyword: '',
      dateFrom: startDate,
      dateTo: dateStr(new Date()),
      categories: ['Annual Financial Statements', 'Annual Reports', 'Prospectus'],
      pageNumber: 1,
      pageSize: 100,
    }
    const data = await postJson('https://www.sedarplus.ca/csa-party/records/filter', body)
    const results = data?.results || data?.data || []
    for (const r of results) {
      const name = (r.issuerName || r.companyName || '').trim()
      if (!name) continue
      rows.push({
        source: 'SEDAR',
        issuer_name: name,
        filing_type: r.documentType || r.category || '',
        filing_date: r.filingDate || r.dateFiled || '',
        date: r.filingDate || r.dateFiled || '',
        link: r.documentUrl || '',
        category: r.category || '',
        node_type: 'firm',
        relationship_type: 'canadian_filing',
      })
    }
  } catch (e) {
    console.warn('  [SEDAR+] Search failed:', e.message)
    console.warn('  [SEDAR+] SEDAR+ may have changed their endpoint. Skipping.')
  }

  await sleep(500)
  writeCsv(dataDir, 'sedar_filings.csv', HEADERS, rows)
}
