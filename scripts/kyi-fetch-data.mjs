#!/usr/bin/env node
/**
 * KYI Fetch – pull fresh investor lead data from public APIs.
 *
 * Modular orchestrator: each source lives in scripts/kyi-fetchers/*.mjs
 *
 * Sources:
 *   --- Original ---
 *   1.  FEC  – Federal Election Commission individual contributions
 *   2.  SEC 13F – EDGAR 13F-HR filings
 *   3.  SEC Form D – EDGAR Form D filings
 *   4.  Wikidata – SPARQL query for US investor/VC entities
 *   5.  GitHub – Search API for VC-related user profiles
 *   6.  Reddit – r/venturecapital subreddit posts
 *   7.  Mastodon – Active investor directory profiles
 *   8.  RSS – TechCrunch funding news
 *   --- SEC Ownership & Activity ---
 *   9.  SEC 13D – Beneficial ownership >5%
 *   10. SEC 13G – Passive beneficial ownership >5%
 *   11. SEC Form 4 – Insider transactions
 *   12. SEC Form 3 – Initial insider ownership
 *   13. SEC Form 5 – Annual insider changes
 *   --- SEC Company Disclosures ---
 *   14. SEC 10-K – Annual reports
 *   15. SEC 10-Q – Quarterly reports
 *   16. SEC 8-K – Current reports (material events)
 *   17. SEC DEF 14A – Proxy statements
 *   18. SEC 20-F – Foreign annual reports
 *   19. SEC 6-K – Foreign current reports
 *   --- SEC Capital & M&A ---
 *   20. SEC S-1 – IPO registration
 *   21. SEC S-3 – Shelf registration
 *   22. SEC S-4 – M&A registration
 *   23. SEC F-1 – Foreign IPO
 *   24. Schedule TO – Tender offers
 *   --- Enforcement ---
 *   25. SEC enforcement actions (litigation releases)
 *   --- Fund / Adviser ---
 *   26. SEC IAPD (Form ADV) – Investment adviser disclosures
 *   27. FINRA BrokerCheck – Broker/firm records
 *   --- Corporate / Entity ---
 *   28. OpenCorporates – Corporate registry
 *   29. Companies House (UK) – UK filings
 *   30. SEC 10-K Exhibit 21 – Subsidiary disclosures
 *   --- Political / Lobbying ---
 *   31. Senate LDA – Lobbying disclosures
 *   32. House lobbying – Bulk XML disclosures
 *   --- International ---
 *   33. SEDAR+ – Canadian securities filings
 *   --- Alternative / Edge ---
 *   34. Press releases (PR Newswire, Business Wire, GlobeNewsWire)
 *   35. GDELT news sentiment
 *   --- USPTO ---
 *   36. Patent filings (PatentsView API)
 *
 * Usage:  npm run kyi:fetch-data
 * Chain:  npm run kyi:refresh        (fetch + import)
 *
 * Env vars (optional overrides):
 *   FEC_API_KEY              – FEC API key (falls back to DEMO_KEY)
 *   GITHUB_TOKEN             – GitHub personal access token
 *   COMPANIES_HOUSE_API_KEY  – UK Companies House API key
 *   KYI_DATA_PATH            – output directory (default: <project>/data)
 *   KYI_FETCH_LOOKBACK       – days of history to fetch (default: 30)
 */

import fs from 'fs'
import path from 'path'
import { fetchJson, fetchText, writeCsv, dateStr, daysAgo, sleep, escapeCsv } from './kyi-fetchers/_helpers.mjs'

// ── env ──────────────────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
}

const dataDir = process.env.KYI_DATA_PATH || path.resolve(process.cwd(), 'data')
const LOOKBACK_DAYS = parseInt(process.env.KYI_FETCH_LOOKBACK || '30', 10)
const FEC_KEY = process.env.FEC_API_KEY || 'DEMO_KEY'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

// ── Original sources (kept inline for backwards compatibility) ───────────────

async function fetchFec() {
  console.log('  [FEC] Fetching individual contributions...')
  const headers = ['source', 'person_name', 'employer', 'occupation', 'city', 'state', 'date', 'node_type', 'relationship_type']
  const rows = []
  const fecLookback = Math.max(LOOKBACK_DAYS, 365)
  const minDate = dateStr(daysAgo(fecLookback))

  const employerTerms = ['VENTURE+CAPITAL', 'PRIVATE+EQUITY', 'ANGEL+INVEST', 'CAPITAL+PARTNERS', 'INVESTMENT+FUND', 'CAPITAL+MANAGEMENT']
  const occupationTerms = ['INVESTOR', 'VENTURE+CAPITALIST', 'FUND+MANAGER', 'MANAGING+PARTNER', 'CAPITAL+INVESTOR']

  async function fetchPage(paramName, term) {
    try {
      const url = `https://api.open.fec.gov/v1/schedules/schedule_a/?api_key=${FEC_KEY}&sort=-contribution_receipt_date&per_page=100&min_date=${minDate}&${paramName}=${term}`
      const data = await fetchJson(url)
      for (const r of (data.results || [])) {
        const name = (r.contributor_name || '').trim()
        if (!name) continue
        rows.push({
          source: 'FEC', person_name: name,
          employer: (r.contributor_employer || '').trim(),
          occupation: (r.contributor_occupation || '').trim(),
          city: (r.contributor_city || '').trim(),
          state: (r.contributor_state || '').trim(),
          date: (r.contribution_receipt_date || '').slice(0, 10),
          node_type: 'person', relationship_type: 'employment',
        })
      }
    } catch (e) {
      console.warn(`  [FEC] ${paramName}=${term} failed:`, e.message)
    }
    await sleep(500)
  }

  for (const term of employerTerms) await fetchPage('contributor_employer', term)
  for (const term of occupationTerms) await fetchPage('contributor_occupation', term)

  const seen = new Set()
  const unique = rows.filter((r) => { const k = r.person_name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
  writeCsv(dataDir, 'fec_donors.csv', headers, unique)
}

async function fetchSec13f() {
  console.log('  [SEC] Fetching 13F-HR filings...')
  const headers = ['source', 'investor_name', 'manager_name', 'cik', 'filing_type', 'filing_date', 'date', 'link', 'source_url', 'issuer_name', 'cusip', 'value', 'shares', 'put_call', 'investment_discretion', 'other_manager', 'voting_auth_sole', 'voting_auth_shared', 'voting_auth_none', 'city', 'state', 'node_type', 'relationship_type']
  const rows = []
  const startDate = dateStr(daysAgo(LOOKBACK_DAYS))
  const endDate = dateStr(new Date())
  try {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%2213F%22&forms=13F-HR&dateRange=custom&startdt=${startDate}&enddt=${endDate}&start=0&count=100`
    const data = await fetchJson(url, { 'User-Agent': 'Katana-KYI/1.0 admin@katana.dev' })
    const hits = data.hits?.hits || []
    for (const hit of hits) {
      const s = hit._source || {}
      const displayNames = Array.isArray(s.display_names) ? s.display_names : []
      const name = (displayNames[0] || '').trim()
      if (!name) continue
      const cik = Array.isArray(s.ciks) ? s.ciks[0] || '' : ''
      const adsh = s.adsh || ''
      const adshPath = adsh.replace(/-/g, '')
      const filingUrl = cik && adsh ? `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${adshPath}/${adsh}-index.htm` : ''
      // Parse city/state from biz_locations e.g. ["Santa Monica, CA"]
      const bizLocations = Array.isArray(s.biz_locations) ? s.biz_locations : []
      const firstLoc = (bizLocations[0] || '').trim()
      let city = ''
      let state = ''
      if (firstLoc) {
        const commaIdx = firstLoc.lastIndexOf(',')
        if (commaIdx >= 0) { city = firstLoc.slice(0, commaIdx).trim(); state = firstLoc.slice(commaIdx + 1).trim() }
        else { city = firstLoc }
      }
      if (!state) { const bizStates = Array.isArray(s.biz_states) ? s.biz_states : []; state = (bizStates[0] || '').trim() }
      rows.push({
        source: 'SEC_13F', investor_name: name, manager_name: '', cik, filing_type: s.form || '13F-HR',
        filing_date: s.file_date || '', date: s.file_date || '', link: filingUrl, source_url: '',
        issuer_name: '', cusip: '', value: '', shares: '', put_call: '', investment_discretion: '',
        other_manager: '', voting_auth_sole: '', voting_auth_shared: '', voting_auth_none: '',
        city, state, node_type: 'investor', relationship_type: 'institutional_holdings',
      })
    }
  } catch (e) { console.warn('  [SEC 13F] EFTS failed:', e.message) }
  writeCsv(dataDir, 'sec_13f.csv', headers, rows)
}

async function fetchSecFormD() {
  console.log('  [SEC] Fetching Form D filings...')
  const headers = ['source', 'company_name', 'filing_type', 'date', 'link', 'summary', 'city', 'state', 'relationship_type']
  const rows = []
  const startDate = dateStr(daysAgo(LOOKBACK_DAYS))
  const endDate = dateStr(new Date())
  try {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22Form+D%22&forms=D,D/A&dateRange=custom&startdt=${startDate}&enddt=${endDate}&start=0&count=200`
    const data = await fetchJson(url, { 'User-Agent': 'Katana-KYI/1.0 admin@katana.dev' })
    const hits = data.hits?.hits || []
    for (const hit of hits) {
      const s = hit._source || {}
      const displayNames = Array.isArray(s.display_names) ? s.display_names : []
      const name = (displayNames[0] || '').trim()
      if (!name) continue
      const cik = Array.isArray(s.ciks) ? s.ciks[0] || '' : ''
      const adsh = s.adsh || ''
      const adshPath = adsh.replace(/-/g, '')
      const filingUrl = cik && adsh ? `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${adshPath}/${adsh}-index.htm` : ''
      const bizLocations = Array.isArray(s.biz_locations) ? s.biz_locations : []
      const firstLoc = (bizLocations[0] || '').trim()
      let city = ''
      let state = ''
      if (firstLoc) {
        const commaIdx = firstLoc.lastIndexOf(',')
        if (commaIdx >= 0) { city = firstLoc.slice(0, commaIdx).trim(); state = firstLoc.slice(commaIdx + 1).trim() }
        else { city = firstLoc }
      }
      if (!state) { const bizStates = Array.isArray(s.biz_states) ? s.biz_states : []; state = (bizStates[0] || '').trim() }
      rows.push({
        source: 'SEC_FORM_D', company_name: `${s.form || 'D'} - ${name}`, filing_type: 'Form D',
        date: s.file_date || '', link: filingUrl, summary: `Filed: ${s.file_date || 'N/A'}`,
        city, state, relationship_type: 'investment',
      })
    }
  } catch (e) { console.warn('  [SEC Form D] EFTS failed:', e.message) }
  writeCsv(dataDir, 'sec_form_d.csv', headers, rows)
}

async function fetchWikidata() {
  console.log('  [Wikidata] Querying investor entities...')
  const headers = ['source', 'person_name', 'occupation', 'employer', 'country', 'city', 'roles', 'industries', 'website', 'socials', 'wikidata_id', 'aliases', 'node_type', 'relationship_type']
  const rows = []
  const sparql = `SELECT DISTINCT ?person ?personLabel ?occupationLabel ?countryLabel ?wikidataId WHERE { VALUES ?occType { wd:Q484876 wd:Q2526255 wd:Q18924081 wd:Q3621823 wd:Q131524 } ?person wdt:P106 ?occType . ?person wdt:P27 ?country . OPTIONAL { ?person wdt:P106 ?occupation . } BIND(REPLACE(STR(?person), "http://www.wikidata.org/entity/", "") AS ?wikidataId) SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 200`
  try {
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql.trim())}`
    const data = await fetchJson(url, { Accept: 'application/sparql-results+json' })
    const bindings = data.results?.bindings || []
    for (const b of bindings) {
      const name = (b.personLabel?.value || '').trim()
      if (!name || name.startsWith('Q')) continue
      rows.push({ source: 'Wikidata', person_name: name, occupation: b.occupationLabel?.value || '', employer: '', country: b.countryLabel?.value || '', city: '', roles: '', industries: '', website: '', socials: '', wikidata_id: b.wikidataId?.value || '', aliases: '', node_type: 'person', relationship_type: 'professional' })
    }
  } catch (e) { console.warn('  [Wikidata] Failed:', e.message) }
  const seen = new Set()
  const unique = rows.filter((r) => { const key = r.person_name.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true })
  writeCsv(dataDir, 'wikidata_investors.csv', headers, unique)
}

async function fetchGithub() {
  console.log('  [GitHub] Searching VC-related profiles...')
  const headers = ['source', 'username', 'name', 'bio', 'company', 'location', 'followers', 'following', 'public_repos', 'profile_url', 'node_type', 'relationship_type']
  const rows = []
  const queries = ['venture capital', 'angel investor', 'private equity']
  const authHeaders = GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}
  for (const q of queries) {
    try {
      const url = `https://api.github.com/search/users?q=${encodeURIComponent(q)}+in:bio&per_page=50&sort=followers&order=desc`
      const data = await fetchJson(url, authHeaders)
      for (const user of (data.items || [])) {
        try {
          const profile = await fetchJson(`https://api.github.com/users/${user.login}`, authHeaders)
          rows.push({ source: 'GitHub', username: user.login, name: profile.name || '', bio: (profile.bio || '').replace(/\n/g, ' '), company: profile.company || '', location: profile.location || '', followers: profile.followers || 0, following: profile.following || 0, public_repos: profile.public_repos || 0, profile_url: `https://github.com/${user.login}`, node_type: 'person', relationship_type: 'developer' })
          await sleep(800)
        } catch { /* skip */ }
      }
      await sleep(10000)
    } catch (e) { console.warn(`  [GitHub] Query "${q}" failed:`, e.message) }
  }
  const seen = new Set()
  const unique = rows.filter((r) => { if (seen.has(r.username)) return false; seen.add(r.username); return true })
  writeCsv(dataDir, 'github_users.csv', headers, unique)
}

async function fetchReddit() {
  console.log('  [Reddit] Fetching r/venturecapital posts...')
  const headers = ['source', 'title', 'author', 'score', 'comments', 'url', 'created', 'subreddit', 'node_type', 'relationship_type']
  const rows = []
  for (const sub of ['venturecapital', 'investing', 'startups']) {
    try {
      const url = `https://www.reddit.com/r/${sub}/hot.json?limit=100`
      const data = await fetchJson(url, { 'User-Agent': 'Katana-KYI/1.0 (by /u/kyi-bot)' })
      for (const p of (data?.data?.children || [])) {
        const d = p.data; if (!d || d.stickied) continue
        rows.push({ source: `Reddit_${sub}`, title: (d.title || '').slice(0, 300), author: d.author || '', score: d.score || 0, comments: d.num_comments || 0, url: `https://reddit.com${d.permalink || ''}`, created: d.created_utc || '', subreddit: sub, node_type: 'discussion', relationship_type: 'community_post' })
      }
      await sleep(2000)
    } catch (e) { console.warn(`  [Reddit] r/${sub} failed:`, e.message) }
  }
  writeCsv(dataDir, 'reddit_posts.csv', headers, rows)
}

async function fetchMastodon() {
  console.log('  [Mastodon] Fetching investor profiles...')
  const headers = ['source', 'username', 'display_name', 'bio', 'followers', 'following', 'profile_url', 'instance', 'node_type', 'relationship_type']
  const rows = []
  for (const inst of ['mastodon.social', 'me.dm', 'techhub.social']) {
    try {
      const url = `https://${inst}/api/v1/directory?order=active&limit=80&local=true`
      const data = await fetchJson(url)
      if (!Array.isArray(data)) continue
      for (const acct of data) {
        const bio = (acct.note || '').replace(/<[^>]*>/g, '').toLowerCase()
        if (!/invest|venture|capital|fund|angel|equity|portfolio|fintech|startup/i.test(bio + ' ' + (acct.display_name || ''))) continue
        rows.push({ source: `Mastodon_${inst}`, username: acct.username || '', display_name: acct.display_name || '', bio: (acct.note || '').replace(/<[^>]*>/g, '').replace(/\n/g, ' ').slice(0, 500), followers: acct.followers_count || 0, following: acct.following_count || 0, profile_url: acct.url || '', instance: inst, node_type: 'person', relationship_type: 'social_profile' })
      }
      await sleep(1000)
    } catch (e) { console.warn(`  [Mastodon] ${inst} failed:`, e.message) }
  }
  writeCsv(dataDir, 'mastodon_users.csv', headers, rows)
}

async function fetchRssNews() {
  console.log('  [RSS] Fetching funding news...')
  const headers = ['source', 'title', 'link', 'published', 'summary', 'node_type', 'relationship_type']
  const rows = []
  const feeds = [{ name: 'RSS_TechCrunch', url: 'https://techcrunch.com/feed/' }]
  for (const feed of feeds) {
    try {
      const xml = await fetchText(feed.url)
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
      for (const item of items) {
        const title = (item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
        const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || ''
        const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''
        const desc = (item.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || ''
        const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim()
        const cleanDesc = desc.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim().slice(0, 300)
        if (!/invest|fund|capital|venture|startup|raise|ipo|valuation|acquisition|billion|million/i.test(cleanTitle + ' ' + cleanDesc)) continue
        rows.push({ source: feed.name, title: cleanTitle, link: link.trim(), published: pubDate.trim(), summary: cleanDesc, node_type: 'news', relationship_type: 'funding_announcement' })
      }
    } catch (e) { console.warn(`  [RSS] ${feed.name} failed:`, e.message) }
  }
  writeCsv(dataDir, 'news_funding.csv', headers, rows)
}

// ── New modular fetchers ─────────────────────────────────────────────────────

import { fetchSec13d, fetchSec13g, fetchSecForm4, fetchSecForm3, fetchSecForm5 } from './kyi-fetchers/sec-ownership.mjs'
import { fetchSec10k, fetchSec10q, fetchSec8k, fetchSecDef14a, fetchSec20f, fetchSec6k } from './kyi-fetchers/sec-disclosures.mjs'
import { fetchSecS1, fetchSecS3, fetchSecS4, fetchSecF1, fetchSecScheduleTo } from './kyi-fetchers/sec-capital.mjs'
import { fetchSecEnforcement } from './kyi-fetchers/sec-enforcement.mjs'
import { fetchSecAdv } from './kyi-fetchers/sec-adv.mjs'
import { fetchFinraBrokercheck } from './kyi-fetchers/finra-brokercheck.mjs'
import { fetchUsptoPatents } from './kyi-fetchers/uspto-patents.mjs'
import { fetchOpenCorporates } from './kyi-fetchers/opencorporates.mjs'
import { fetchCompaniesHouse } from './kyi-fetchers/companies-house.mjs'
import { fetchSedar } from './kyi-fetchers/sedar.mjs'
import { fetchLobbySenate } from './kyi-fetchers/lobbying-senate.mjs'
import { fetchLobbyHouse } from './kyi-fetchers/lobbying-house.mjs'
import { fetchPressReleases } from './kyi-fetchers/press-releases.mjs'
import { fetchSecSubsidiaries } from './kyi-fetchers/sec-subsidiaries.mjs'
import { fetchNewsSentiment } from './kyi-fetchers/news-sentiment.mjs'

// ── main ─────────────────────────────────────────────────────────────────────

async function run() {
  const start = Date.now()
  console.log('KYI Fetch – pulling fresh data from public sources')
  console.log('  Data dir:', dataDir)
  console.log('  Lookback:', LOOKBACK_DAYS, 'days')
  console.log('')

  const sources = [
    // Original sources
    { name: 'FEC', fn: fetchFec },
    { name: 'SEC 13F', fn: fetchSec13f },
    { name: 'SEC Form D', fn: fetchSecFormD },
    { name: 'Wikidata', fn: fetchWikidata },
    { name: 'GitHub', fn: fetchGithub },
    { name: 'Reddit', fn: fetchReddit },
    { name: 'Mastodon', fn: fetchMastodon },
    { name: 'RSS News', fn: fetchRssNews },
    // SEC Ownership & Activity
    { name: 'SEC 13D', fn: () => fetchSec13d(dataDir, LOOKBACK_DAYS) },
    { name: 'SEC 13G', fn: () => fetchSec13g(dataDir, LOOKBACK_DAYS) },
    { name: 'SEC Form 4', fn: () => fetchSecForm4(dataDir, LOOKBACK_DAYS) },
    { name: 'SEC Form 3', fn: () => fetchSecForm3(dataDir, LOOKBACK_DAYS) },
    { name: 'SEC Form 5', fn: () => fetchSecForm5(dataDir, LOOKBACK_DAYS) },
    // SEC Company Disclosures
    { name: 'SEC 10-K', fn: () => fetchSec10k(dataDir, LOOKBACK_DAYS) },
    { name: 'SEC 10-Q', fn: () => fetchSec10q(dataDir, LOOKBACK_DAYS) },
    { name: 'SEC 8-K', fn: () => fetchSec8k(dataDir, LOOKBACK_DAYS) },
    { name: 'SEC DEF 14A', fn: () => fetchSecDef14a(dataDir, LOOKBACK_DAYS) },
    { name: 'SEC 20-F', fn: () => fetchSec20f(dataDir, LOOKBACK_DAYS) },
    { name: 'SEC 6-K', fn: () => fetchSec6k(dataDir, LOOKBACK_DAYS) },
    // SEC Capital & M&A
    { name: 'SEC S-1', fn: () => fetchSecS1(dataDir, LOOKBACK_DAYS) },
    { name: 'SEC S-3', fn: () => fetchSecS3(dataDir, LOOKBACK_DAYS) },
    { name: 'SEC S-4', fn: () => fetchSecS4(dataDir, LOOKBACK_DAYS) },
    { name: 'SEC F-1', fn: () => fetchSecF1(dataDir, LOOKBACK_DAYS) },
    { name: 'Schedule TO', fn: () => fetchSecScheduleTo(dataDir, LOOKBACK_DAYS) },
    // Enforcement
    { name: 'SEC Enforcement', fn: () => fetchSecEnforcement(dataDir, LOOKBACK_DAYS) },
    // Fund / Adviser
    { name: 'SEC IAPD (ADV)', fn: () => fetchSecAdv(dataDir) },
    { name: 'FINRA BrokerCheck', fn: () => fetchFinraBrokercheck(dataDir) },
    // Corporate / Entity
    { name: 'OpenCorporates', fn: () => fetchOpenCorporates(dataDir) },
    { name: 'Companies House', fn: () => fetchCompaniesHouse(dataDir) },
    { name: 'SEC Subsidiaries', fn: () => fetchSecSubsidiaries(dataDir, LOOKBACK_DAYS) },
    // Political / Lobbying
    { name: 'Lobbying (Senate)', fn: () => fetchLobbySenate(dataDir, LOOKBACK_DAYS) },
    { name: 'Lobbying (House)', fn: () => fetchLobbyHouse(dataDir) },
    // International
    { name: 'SEDAR+ (Canada)', fn: () => fetchSedar(dataDir, LOOKBACK_DAYS) },
    // Alternative / Edge
    { name: 'Press Releases', fn: () => fetchPressReleases(dataDir) },
    { name: 'News Sentiment', fn: () => fetchNewsSentiment(dataDir, LOOKBACK_DAYS) },
    // USPTO
    { name: 'USPTO Patents', fn: () => fetchUsptoPatents(dataDir, LOOKBACK_DAYS) },
  ]

  const results = []
  for (const src of sources) {
    try {
      await src.fn()
      results.push({ name: src.name, status: 'ok' })
    } catch (e) {
      console.error(`  [${src.name}] FAILED:`, e.message)
      results.push({ name: src.name, status: 'failed', error: e.message })
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('')
  console.log(`Done in ${elapsed}s.`)
  console.log('  Results:', results.map((r) => `${r.name}: ${r.status}`).join(', '))

  const failCount = results.filter((r) => r.status === 'failed').length
  if (failCount > 0) console.warn(`  ${failCount} source(s) failed – data from other sources was still saved.`)

  const meta = { last_fetch: new Date().toISOString(), lookback_days: LOOKBACK_DAYS, source_count: sources.length, results }
  fs.writeFileSync(path.join(dataDir, '.kyi-fetch-meta.json'), JSON.stringify(meta, null, 2))
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
