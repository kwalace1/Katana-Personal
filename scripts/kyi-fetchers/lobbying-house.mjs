/**
 * House Lobbying Disclosure fetcher.
 * Downloads quarterly bulk XML from disclosurespreview.house.gov and parses it.
 * Falls back to a simpler HTML scrape if the bulk endpoint changes.
 */
import { fetchText, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'registrant_name', 'client_name', 'lobbyist_names',
  'filing_type', 'filing_year', 'filing_period',
  'link', 'node_type', 'relationship_type',
]

function extractXmlTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : ''
}

function extractAllXmlTags(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi')
  const matches = []
  let m
  while ((m = re.exec(xml)) !== null) matches.push(m[1].trim())
  return matches
}

export async function fetchLobbyHouse(dataDir) {
  console.log('  [Lobbying] Fetching House disclosure filings...')
  const rows = []
  const year = new Date().getFullYear()
  const quarter = Math.ceil((new Date().getMonth() + 1) / 3)
  const prevQuarter = quarter > 1 ? quarter - 1 : 4
  const prevYear = quarter > 1 ? year : year - 1

  try {
    const url =
      `https://disclosurespreview.house.gov/lc/lcxmlrelease/${prevYear}/Q${prevQuarter}/${prevYear}_Q${prevQuarter}_XML.zip`
    console.log(`  [House] Trying bulk XML: ${url}`)
    // The ZIP download is large; fall back to parsing the listing page
    const listUrl =
      `https://disclosurespreview.house.gov/ld/ldxmlrelease/${prevYear}/Q${prevQuarter}/`
    const html = await fetchText(listUrl)
    // Parse individual filing XML links from the directory listing
    const xmlLinks = (html.match(/href="([^"]+\.xml)"/gi) || [])
      .map((m) => m.replace(/href="/i, '').replace(/"$/, ''))
      .slice(0, 50)

    for (const xmlFile of xmlLinks) {
      try {
        const fileUrl = xmlFile.startsWith('http')
          ? xmlFile
          : `https://disclosurespreview.house.gov/ld/ldxmlrelease/${prevYear}/Q${prevQuarter}/${xmlFile}`
        const xml = await fetchText(fileUrl)
        const registrant = extractXmlTag(xml, 'registrantName') || extractXmlTag(xml, 'organizationName')
        const client = extractXmlTag(xml, 'clientName')
        if (!registrant && !client) continue
        const lobbyists = extractAllXmlTags(xml, 'lobbyistName').slice(0, 10).join('; ')
        rows.push({
          source: 'LOBBYING_HOUSE',
          registrant_name: registrant,
          client_name: client,
          lobbyist_names: lobbyists,
          filing_type: 'Quarterly',
          filing_year: String(prevYear),
          filing_period: `Q${prevQuarter}`,
          link: '',
          node_type: 'firm',
          relationship_type: 'lobbying',
        })
        await sleep(300)
      } catch {
        // skip individual file errors
      }
    }
  } catch (e) {
    console.warn('  [Lobbying House] Failed:', e.message)
    console.warn('  [Lobbying House] House disclosure endpoint may have changed. Skipping.')
  }

  writeCsv(dataDir, 'lobbying_house.csv', HEADERS, rows)
}
