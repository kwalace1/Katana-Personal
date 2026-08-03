/**
 * SEC 10-K Subsidiary Exhibit (Exhibit 21) parser.
 * Fetches recent 10-K filings from EDGAR, locates Exhibit 21 in the filing index,
 * downloads and parses the text to extract subsidiary entities.
 */
import { fetchEdgarFilings, parseEdgarHit, fetchText, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'parent_company', 'subsidiary_name', 'jurisdiction',
  'parent_cik', 'filing_date', 'link', 'node_type', 'relationship_type',
]

function parseExhibit21Text(text) {
  const subs = []
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    // Exhibit 21 typically has lines like:
    // "Subsidiary Name    Delaware" or "Subsidiary Name    State of Delaware"
    // or tab/space-separated "Name\tJurisdiction"
    const parts = line.split(/\t+|\s{3,}/)
    if (parts.length >= 2) {
      const name = parts[0].trim()
      const jurisdiction = parts[parts.length - 1].trim()
      if (
        name.length > 3 &&
        name.length < 200 &&
        !/^(name|subsidiary|jurisdiction|state|exhibit|list|page|\d)/i.test(name)
      ) {
        subs.push({ name, jurisdiction })
      }
    }
  }
  return subs
}

export async function fetchSecSubsidiaries(dataDir, lookbackDays) {
  console.log('  [SEC] Fetching 10-K Exhibit 21 (subsidiaries)...')
  const rows = []
  const hits = await fetchEdgarFilings('10-K', lookbackDays, 50)

  for (const hit of hits.slice(0, 20)) {
    const p = parseEdgarHit(hit)
    if (!p.name || !p.filingUrl) continue

    try {
      const indexHtml = await fetchText(p.filingUrl)
      // Look for Exhibit 21 link in the filing index
      const ex21Match = indexHtml.match(/href="([^"]*)"[^>]*>[^<]*(?:EX-21|Exhibit 21|SUBSIDIARIES)/i)
      if (!ex21Match) continue

      let ex21Url = ex21Match[1]
      if (!ex21Url.startsWith('http')) {
        const basePath = p.filingUrl.replace(/[^/]+$/, '')
        ex21Url = ex21Url.startsWith('/') ? `https://www.sec.gov${ex21Url}` : `${basePath}${ex21Url}`
      }

      const ex21Text = await fetchText(ex21Url)
      const subs = parseExhibit21Text(ex21Text)

      for (const sub of subs) {
        rows.push({
          source: 'SEC_SUBSIDIARY',
          parent_company: p.name,
          subsidiary_name: sub.name,
          jurisdiction: sub.jurisdiction,
          parent_cik: p.cik,
          filing_date: p.fileDate,
          link: ex21Url,
          node_type: 'firm',
          relationship_type: 'subsidiary',
        })
      }
      await sleep(500)
    } catch {
      // skip individual filing errors
    }
  }

  writeCsv(dataDir, 'sec_subsidiaries.csv', HEADERS, rows)
}
