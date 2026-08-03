#!/usr/bin/env node
/**
 * KYI Import from data folder – sync leads into Supabase kyi_investor_leads.
 * All leads go into the platform pool (KYI_PLATFORM_CLIENT_ID, default 1). Any company
 * then sees these leads filtered by their own geo (investors in their target area).
 *
 * Usage (from katana root):
 *   npm run kyi:import-data
 *
 * Data path: KYI_DATA_PATH or <katana>/data
 * Re-run anytime to pull new data; existing names are skipped (append-only).
 *
 * Requires: csv-parse (npm install csv-parse --save-dev)
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env from project root
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const dataDir = process.env.KYI_DATA_PATH || path.resolve(process.cwd(), 'data')
const clientId = parseInt(process.env.KYI_PLATFORM_CLIENT_ID || process.argv[2] || process.env.KYI_CLIENT_ID || '1', 10)

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (or SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}

if (!fs.existsSync(dataDir)) {
  console.error('KYI data directory not found:', dataDir)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })

// ── Expanded scoring system (keep in sync with src/lib/kyi-lead-scoring.ts) ───

const SCORE = {
  // Investor ownership (highest value)
  sec_13d: 30,
  sec_13g: 25,
  sec_13f: 25,
  sec_form_d: 25,
  sec_form4: 20,
  sec_form3: 15,
  sec_form5: 10,
  // Company disclosures
  sec_10k: 20,
  sec_10q: 10,
  sec_8k: 15,
  sec_def14a: 15,
  sec_20f: 15,
  sec_6k: 10,
  // Capital formation
  sec_s1: 25,
  sec_s3: 15,
  sec_s4: 20,
  sec_f1: 20,
  sec_schedule_to: 20,
  // Enforcement & structure
  sec_enforcement: 10,
  sec_subsidiary: 10,
  sec_adv: 20,
  // External sources
  fec_donor: 15,
  finra_brokercheck: 15,
  uspto_patent: 10,
  opencorporates: 15,
  companies_house: 15,
  lobbying_disclosure: 10,
  press_release: 5,
  news_sentiment: 5,
  sedar: 10,
  business_registry: 25,
  // Multi-source multipliers
  multi_2: 1.15,
  multi_3: 1.25,
  multi_4: 1.35,
  multi_5: 1.45,
}

function scoreLead(signals) {
  let base = 0
  const fired = []
  for (const [key, weight] of Object.entries(SCORE)) {
    if (key.startsWith('multi_')) continue
    if (signals[key]) {
      base += weight
      fired.push(key)
    }
  }
  const mult =
    fired.length >= 5 ? SCORE.multi_5 :
    fired.length >= 4 ? SCORE.multi_4 :
    fired.length >= 3 ? SCORE.multi_3 :
    fired.length >= 2 ? SCORE.multi_2 : 1
  return Math.round(base * mult)
}

function normalizeName(name) {
  if (!name || !name.trim()) return ''
  let n = name.trim()
  if (n.includes(',')) {
    const [last, first] = n.split(',', 2).map((s) => s.trim())
    n = first && last ? `${first} ${last}` : n
  }
  return n.replace(/\b\w/g, (c) => c.toUpperCase())
}

const CITY_COORDS = {
  'NEW YORK,NY': [40.7128, -74.006],
  'SAN FRANCISCO,CA': [37.7749, -122.4194],
  'BOSTON,MA': [42.3601, -71.0589],
  'AUSTIN,TX': [30.2672, -97.7431],
  'CHICAGO,IL': [41.8781, -87.6298],
  'SEATTLE,WA': [47.6062, -122.3321],
  'DENVER,CO': [39.7392, -104.9903],
  'MIAMI,FL': [25.7617, -80.1918],
  'CARMEL,CA': [36.5552, -121.9233],
  'KENILWORTH,IL': [42.0878, -87.7173],
  'WAIMANALO,HI': [21.3481, -157.71],
  'LOS ANGELES,CA': [34.0522, -118.2437],
  'PHILADELPHIA,PA': [39.9526, -75.1652],
  'WASHINGTON,DC': [38.9072, -77.0369],
  'NORTH BEND,OR': [43.4065, -124.2243],
  // Additional major investor hubs
  'MENLO PARK,CA': [37.4529, -122.1817],
  'PALO ALTO,CA': [37.4419, -122.143],
  'MOUNTAIN VIEW,CA': [37.3861, -122.0839],
  'SAN JOSE,CA': [37.3382, -121.8863],
  'SANTA CLARA,CA': [37.3541, -121.9552],
  'REDWOOD CITY,CA': [37.4852, -122.2364],
  'SAN MATEO,CA': [37.5629, -122.3255],
  'NEWPORT BEACH,CA': [33.6189, -117.9289],
  'SANTA MONICA,CA': [34.0195, -118.4912],
  'BEVERLY HILLS,CA': [34.0736, -118.4004],
  'GREENWICH,CT': [41.0534, -73.6285],
  'STAMFORD,CT': [41.0534, -73.5387],
  'WESTPORT,CT': [41.1415, -73.3579],
  'MINNEAPOLIS,MN': [44.9778, -93.265],
  'DALLAS,TX': [32.7767, -96.797],
  'HOUSTON,TX': [29.7604, -95.3698],
  'ATLANTA,GA': [33.749, -84.388],
  'NASHVILLE,TN': [36.1627, -86.7816],
  'CHARLOTTE,NC': [35.2271, -80.8431],
  'RALEIGH,NC': [35.7796, -78.6382],
  'SALT LAKE CITY,UT': [40.7608, -111.891],
  'PORTLAND,OR': [45.5051, -122.675],
  'LAS VEGAS,NV': [36.1699, -115.1398],
  'PHOENIX,AZ': [33.4484, -112.074],
  'SAN DIEGO,CA': [32.7157, -117.1611],
  'BALTIMORE,MD': [39.2904, -76.6122],
  'BETHESDA,MD': [38.9807, -77.1],
  'MCLEAN,VA': [38.9339, -77.1773],
  'RICHMOND,VA': [37.5407, -77.436],
  'PITTSBURGH,PA': [40.4406, -79.9959],
  'COLUMBUS,OH': [39.9612, -82.9988],
  'CLEVELAND,OH': [41.4993, -81.6944],
  'INDIANAPOLIS,IN': [39.7684, -86.1581],
  'KANSAS CITY,MO': [39.0997, -94.5786],
  'ST LOUIS,MO': [38.627, -90.1994],
  'DETROIT,MI': [42.3314, -83.0458],
  'ANN ARBOR,MI': [42.2808, -83.743],
  'MILWAUKEE,WI': [43.0389, -87.9065],
  'TAMPA,FL': [27.9506, -82.4572],
  'ORLANDO,FL': [28.5383, -81.3792],
  'FORT LAUDERDALE,FL': [26.1224, -80.1373],
  'NEW ORLEANS,LA': [29.9511, -90.0715],
  'MEMPHIS,TN': [35.1495, -90.0489],
  'LOUISVILLE,KY': [38.2527, -85.7585],
  'CINCINNATI,OH': [39.1031, -84.512],
  'BUFFALO,NY': [42.8865, -78.8784],
  'ROCHESTER,NY': [43.1566, -77.6088],
  'ALBANY,NY': [42.6526, -73.7562],
  'HARTFORD,CT': [41.7658, -72.6851],
  'PROVIDENCE,RI': [41.824, -71.4128],
  'CAMBRIDGE,MA': [42.3736, -71.1097],
  'WALTHAM,MA': [42.3765, -71.2356],
  'BURLINGTON,MA': [42.5048, -71.1956],
  'NEW HAVEN,CT': [41.3083, -72.9279],
  'JERSEY CITY,NJ': [40.7178, -74.0431],
  'HOBOKEN,NJ': [40.744, -74.0324],
  'PRINCETON,NJ': [40.3573, -74.6672],
  'SHORT HILLS,NJ': [40.7282, -74.3268],
  'MORRISTOWN,NJ': [40.7968, -74.4815],
  'WILMINGTON,DE': [39.7447, -75.5484],
  'RICHMOND,VA': [37.5407, -77.436],
  'TYSONS,VA': [38.9209, -77.2311],
  'ARLINGTON,VA': [38.8816, -77.0910],
}

function lookupCoords(city, state) {
  if (!city || !state) return null
  const key = `${city.toUpperCase().trim()},${state.toUpperCase().trim()}`
  return CITY_COORDS[key] || null
}

function leadNeedsGeocoding(lead) {
  const hasHint =
    !!(lead.city && String(lead.city).trim()) ||
    !!(lead.state && String(lead.state).trim()) ||
    !!(lead.zip_code && String(lead.zip_code).trim())
  if (!hasHint) return false
  return lead.lat == null || lead.lng == null
}

async function loadCsv(fileName) {
  const filepath = path.join(dataDir, fileName)
  if (!fs.existsSync(filepath)) return []
  const { parse } = await import('csv-parse/sync')
  const raw = fs.readFileSync(filepath, 'utf-8')
  return parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true })
}

async function getExistingNames() {
  const names = new Set()
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('kyi_investor_leads')
      .select('display_name')
      .eq('client_id', clientId)
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data) names.add((r.display_name || '').toLowerCase())
    if (data.length < PAGE) break
    from += PAGE
  }
  return names
}

const VALID_ENTITY_TYPES = new Set(['person', 'firm'])

function buildLead(row) {
  const now = new Date().toISOString()
  const entityType = VALID_ENTITY_TYPES.has(row.entity_type) ? row.entity_type : 'firm'
  return {
    client_id: clientId,
    entity_type: entityType,
    display_name: row.display_name,
    street_address: row.street_address || null,
    city: row.city || null,
    state: row.state || null,
    zip_code: row.zip_code || null,
    country: row.country || 'US',
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    sources: row.sources || [],
    signals: row.signals || {},
    raw_score: row.raw_score ?? 0,
    score_breakdown: row.score_breakdown || null,
    tags: row.tags || [],
    created_at: now,
    updated_at: now,
  }
}

let nextId = 0

async function initNextId() {
  const { data } = await supabase
    .from('kyi_investor_leads')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
  nextId = (data?.[0]?.id || 0) + 1
  console.log('  Next ID:', nextId)
}

async function batchInsert(leads, label, stats) {
  if (leads.length === 0) return 0
  const BATCH_SIZE = 500
  let inserted = 0
  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE).map((lead) => ({ ...lead, id: nextId++ }))
    const { error } = await supabase.from('kyi_investor_leads').insert(batch)
    if (error) throw error
    inserted += batch.length
    for (const lead of batch) {
      if (leadNeedsGeocoding(lead)) stats.needsGeocode = (stats.needsGeocode || 0) + 1
    }
  }
  console.log(`  ${label}: ${inserted}`)
  return inserted
}

// ── Original ingest functions ────────────────────────────────────────────────

async function ingestFecDonors(existingNames, stats) {
  const rows = await loadCsv('fec_donors.csv')
  stats.total_rows += rows.length
  const toInsert = []
  for (const row of rows) {
    const name = normalizeName(row.person_name || '')
    if (!name || existingNames.has(name.toLowerCase())) continue
    const city = (row.city || '').trim()
    const state = (row.state || '').trim()
    const coords = city && state ? lookupCoords(city, state) : null
    const signals = {
      fec_donor: true, business_registry: false, sec_13f: false, sec_form_d: false,
      signal_dates: { fec_donor: row.date || '' },
    }
    const occ = (row.occupation || '').toUpperCase()
    const emp = (row.employer || '').toUpperCase()
    if (/VENTURE|CAPITAL|INVESTOR|PARTNER|MANAGING|CEO|FOUNDER/.test(occ)) signals.business_registry = true
    if (/VENTURE|CAPITAL|INVESTMENT|FUND|PARTNERS/.test(emp)) signals.business_registry = true
    toInsert.push(buildLead({
      entity_type: 'person', display_name: name,
      city: city ? city.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
      state: state || null,
      lat: coords ? coords[0] : null, lng: coords ? coords[1] : null,
      sources: [{ source_name: 'FEC', date_observed: row.date, confidence: 0.9 }],
      signals, raw_score: scoreLead(signals),
    }))
    existingNames.add(name.toLowerCase())
  }
  stats.imported += await batchInsert(toInsert, 'FEC donors', stats) || 0
}

async function ingestSec13f(existingNames, stats) {
  const rows = await loadCsv('sec_13f.csv')
  stats.total_rows += rows.length
  const toInsert = []
  for (const row of rows) {
    let name = (row.investor_name || '').replace(/^HR - |^HR\/A - |^NT - /i, '').trim()
    if (!name || existingNames.has(name.toLowerCase())) continue
    const city = (row.city || '').trim() || null
    const state = (row.state || '').trim() || null
    const coords = city && state ? lookupCoords(city, state) : null
    const signals = { sec_13f: true, signal_dates: { sec_13f: row.date || '' } }
    toInsert.push(buildLead({
      entity_type: 'firm', display_name: name,
      city, state,
      lat: coords ? coords[0] : null, lng: coords ? coords[1] : null,
      sources: [{ source_name: 'SEC_13F', url: row.link, date_observed: row.date, confidence: 1 }],
      signals, raw_score: scoreLead(signals),
    }))
    existingNames.add(name.toLowerCase())
  }
  stats.imported += await batchInsert(toInsert, 'SEC 13F', stats) || 0
}

async function ingestWikidata(existingNames, stats) {
  const rows = await loadCsv('wikidata_investors.csv')
  stats.total_rows += rows.length
  const toInsert = []
  for (const row of rows) {
    const country = (row.country || '').trim()
    if (country && !country.includes('United States')) continue
    const name = (row.person_name || '').trim()
    if (!name || existingNames.has(name.toLowerCase())) continue
    const signals = { business_registry: true }
    toInsert.push(buildLead({
      entity_type: 'person', display_name: name, country: 'US',
      sources: [{ source_name: 'Wikidata', source_id: row.wikidata_id, confidence: 0.8 }],
      signals, raw_score: scoreLead(signals),
    }))
    existingNames.add(name.toLowerCase())
  }
  stats.imported += await batchInsert(toInsert, 'Wikidata', stats) || 0
}

// ── Generic SEC filing ingest (reused for all EDGAR-sourced CSVs) ────────────

async function ingestSecFiling(fileName, signalKey, entityType, nameField, sourcePrefix, existingNames, stats) {
  const rows = await loadCsv(fileName)
  if (rows.length === 0) return
  stats.total_rows += rows.length
  const toInsert = []
  for (const row of rows) {
    const name = (row[nameField] || '').trim()
    if (!name || existingNames.has(name.toLowerCase())) continue
    const city = (row.city || '').trim() || null
    const state = (row.state || '').trim() || null
    const coords = city && state ? lookupCoords(city, state) : null
    const signals = { [signalKey]: true, signal_dates: { [signalKey]: row.date || row.filing_date || '' } }
    toInsert.push(buildLead({
      entity_type: entityType,
      display_name: name,
      city, state,
      lat: coords ? coords[0] : null, lng: coords ? coords[1] : null,
      sources: [{ source_name: sourcePrefix, url: row.link || '', date_observed: row.date || row.filing_date || '', confidence: 0.9 }],
      signals,
      raw_score: scoreLead(signals),
    }))
    existingNames.add(name.toLowerCase())
  }
  stats.imported += await batchInsert(toInsert, `${sourcePrefix}`, stats) || 0
}

// ── Generic external source ingest ───────────────────────────────────────────

async function ingestOptional(name, file, opts, existingNames, stats) {
  const rows = await loadCsv(file)
  if (rows.length === 0) return
  stats.total_rows += rows.length
  const toInsert = []
  for (const row of rows) {
    const displayName = opts.getDisplayName(row)
    if (!displayName || existingNames.has(displayName.toLowerCase())) continue
    const city = opts.getCity?.(row) || null
    const state = opts.getState?.(row) || null
    const coords = city && state ? lookupCoords(city, state) : null
    toInsert.push(buildLead({
      entity_type: opts.entity_type || 'person',
      display_name: displayName,
      city,
      state,
      lat: coords ? coords[0] : null,
      lng: coords ? coords[1] : null,
      sources: opts.sources(row),
      signals: opts.signals || {},
      raw_score: scoreLead(opts.signals || {}),
    }))
    existingNames.add(displayName.toLowerCase())
  }
  stats.imported += await batchInsert(toInsert, name, stats) || 0
}

// ── Geo backfill ─────────────────────────────────────────────────────────────
// Updates leads that were imported without lat/lng whenever fresh CSVs now
// carry city/state for those same names. Runs after all ingest functions.

async function backfillMissingGeo(stats) {
  // Build name → geo map from every CSV that carries location columns
  const nameToGeo = new Map()
  const csvSources = [
    { file: 'sec_13f.csv', nameField: 'investor_name', cityField: 'city', stateField: 'state',
      transform: (n) => n.replace(/^HR - |^HR\/A - |^NT - /i, '').trim() },
    { file: 'sec_form_d.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_13d.csv', nameField: 'filer_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_13g.csv', nameField: 'filer_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_form3.csv', nameField: 'filer_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_form4.csv', nameField: 'filer_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_form5.csv', nameField: 'filer_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_10k.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_10q.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_8k.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_def14a.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_20f.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_6k.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_s1.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_s3.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_s4.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_f1.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_schedule_to.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_enforcement.csv', nameField: 'entity_name', cityField: 'city', stateField: 'state' },
    { file: 'sec_adv.csv', nameField: 'adviser_name', cityField: 'city', stateField: 'state' },
    { file: 'finra_brokercheck.csv', nameField: 'entity_name', cityField: 'branch_city', stateField: 'branch_state' },
    { file: 'opencorporates.csv', nameField: 'company_name', cityField: 'city', stateField: 'state' },
    { file: 'lobbying_senate.csv', nameField: 'registrant_name', cityField: 'registrant_city', stateField: 'registrant_state' },
    { file: 'lobbying_house.csv', nameField: 'registrant_name', cityField: 'city', stateField: 'state' },
    { file: 'uspto_patents.csv', nameField: 'assignee_name', cityField: 'city', stateField: 'state' },
  ]

  for (const src of csvSources) {
    if (!fs.existsSync(path.join(dataDir, src.file))) continue
    const rows = await loadCsv(src.file)
    for (const row of rows) {
      let name = (row[src.nameField] || '').trim()
      if (!name) continue
      if (src.transform) name = src.transform(name)
      if (!name) continue
      const city = (row[src.cityField] || '').trim() || null
      const state = (row[src.stateField] || '').trim() || null
      if (!city && !state) continue
      const coords = city && state ? lookupCoords(city, state) : null
      const key = name.toLowerCase()
      if (!nameToGeo.has(key)) {
        nameToGeo.set(key, { city, state, lat: coords?.[0] ?? null, lng: coords?.[1] ?? null })
      }
    }
  }

  if (nameToGeo.size === 0) {
    console.log('  Backfill: no geo data in CSVs to apply')
    return
  }
  console.log(`  Backfill: ${nameToGeo.size} names with geo available in CSVs`)

  // Fetch all leads missing lat/lng for this client
  const toUpdate = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('kyi_investor_leads')
      .select('id, display_name')
      .eq('client_id', clientId)
      .is('lat', null)
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const lead of data) {
      const key = (lead.display_name || '').toLowerCase()
      const geo = nameToGeo.get(key)
      if (geo) toUpdate.push({ id: lead.id, ...geo })
    }
    if (data.length < PAGE) break
    from += PAGE
  }

  if (toUpdate.length === 0) {
    console.log('  Backfill: 0 leads to update (no name matches)')
    return
  }

  const now = new Date().toISOString()
  let updated = 0
  const BATCH = 100
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH)
    for (const item of batch) {
      const { error } = await supabase
        .from('kyi_investor_leads')
        .update({ city: item.city, state: item.state, lat: item.lat, lng: item.lng, updated_at: now })
        .eq('id', item.id)
      if (!error) updated++
    }
  }
  console.log(`  Backfill: updated ${updated} leads with geo data`)
  stats.geoBackfilled = updated
}



async function run() {
  console.log('KYI Import from data folder')
  console.log('  Data dir:', dataDir)
  console.log('  Client ID:', clientId)
  const stats = { total_rows: 0, imported: 0 }
  const existingNames = await getExistingNames()
  console.log('  Existing leads for client:', existingNames.size)

  await initNextId()

  // --- Original sources ---
  await ingestFecDonors(existingNames, stats)
  await ingestSec13f(existingNames, stats)
  await ingestWikidata(existingNames, stats)

  if (fs.existsSync(path.join(dataDir, 'github_users.csv'))) {
    await ingestOptional('GitHub', 'github_users.csv', {
      getDisplayName: (r) => (r.name || r.username || '').trim(),
      getCity: (r) => { const loc = (r.location || '').trim(); return loc.includes(',') ? loc.split(',', 1)[0].trim() || null : loc || null },
      getState: (r) => { const loc = (r.location || '').trim(); return loc.includes(',') ? loc.split(',')[1]?.trim() || null : null },
      entity_type: 'person',
      sources: (r) => [{ source_name: 'GitHub', url: r.profile_url, confidence: 0.7 }],
      signals: { business_registry: true },
    }, existingNames, stats)
  }
  if (fs.existsSync(path.join(dataDir, 'mastodon_users.csv'))) {
    await ingestOptional('Mastodon', 'mastodon_users.csv', {
      getDisplayName: (r) => (r.display_name || r.username || '').trim(),
      entity_type: 'person',
      sources: (r) => [{ source_name: 'Mastodon', url: r.profile_url, confidence: 0.6 }],
      signals: {},
    }, existingNames, stats)
  }
  if (fs.existsSync(path.join(dataDir, 'news_funding.csv'))) {
    await ingestOptional('NewsFunding', 'news_funding.csv', {
      getDisplayName: (r) => (r.title || '').trim().slice(0, 200),
      entity_type: 'firm',
      sources: (r) => [{ source_name: 'NewsFunding', url: r.link, confidence: 0.5 }],
      signals: {},
    }, existingNames, stats)
  }
  if (fs.existsSync(path.join(dataDir, 'reddit_posts.csv'))) {
    await ingestOptional('Reddit', 'reddit_posts.csv', {
      getDisplayName: (r) => (r.author || '').trim(),
      entity_type: 'person',
      sources: (r) => [{ source_name: 'Reddit', url: r.url, confidence: 0.5 }],
      signals: {},
    }, existingNames, stats)
  }
  if (fs.existsSync(path.join(dataDir, 'sec_form_d.csv'))) {
    const rows = await loadCsv('sec_form_d.csv')
    stats.total_rows += rows.length
    const toInsert = []
    for (const row of rows) {
      const name = (row.company_name || '').trim()
      if (!name || existingNames.has(name.toLowerCase())) continue
      const city = (row.city || '').trim() || null
      const state = (row.state || '').trim() || null
      const coords = city && state ? lookupCoords(city, state) : null
      const signals = { sec_form_d: true, signal_dates: { sec_form_d: row.date || '' } }
      toInsert.push(buildLead({
        entity_type: 'firm', display_name: name,
        city, state,
        lat: coords ? coords[0] : null, lng: coords ? coords[1] : null,
        sources: [{ source_name: 'SEC_FORM_D', url: row.link, date_observed: row.date, confidence: 0.9 }],
        signals, raw_score: scoreLead(signals),
      }))
      existingNames.add(name.toLowerCase())
    }
    stats.imported += await batchInsert(toInsert, 'SEC Form D', stats) || 0
  }
  if (fs.existsSync(path.join(dataDir, 'kyi_nodes.csv'))) {
    const rows = await loadCsv('kyi_nodes.csv')
    stats.total_rows += rows.length
    const toInsert = []
    for (const row of rows) {
      const label = (row.label || row.id || '').trim().slice(0, 500)
      if (!label || existingNames.has(label.toLowerCase())) continue
      const nodeType = (row.node_type || '').toLowerCase()
      const entityType = nodeType === 'organization' || nodeType === 'firm' ? 'firm' : 'person'
      const sourceName = (row.source || 'KYI_NODES').replace(/\s+/g, '_')
      toInsert.push(buildLead({
        entity_type: entityType, display_name: label,
        sources: [{ source_name: sourceName, confidence: 0.6 }],
        signals: { business_registry: true }, raw_score: scoreLead({ business_registry: true }),
      }))
      existingNames.add(label.toLowerCase())
    }
    stats.imported += await batchInsert(toInsert, 'KYI nodes', stats) || 0
  }
  if (fs.existsSync(path.join(dataDir, 'kyi_edges.csv'))) {
    const rows = await loadCsv('kyi_edges.csv')
    stats.total_rows += rows.length
    const toInsert = []
    for (const row of rows) {
      const fromNode = (row.from_node || '').trim().slice(0, 300)
      if (!fromNode || fromNode.length < 2 || existingNames.has(fromNode.toLowerCase())) continue
      toInsert.push(buildLead({
        entity_type: 'person', display_name: fromNode,
        sources: [{ source_name: (row.source || 'KYI_EDGES').replace(/\s+/g, '_'), confidence: 0.5 }],
        signals: {}, raw_score: 5,
      }))
      existingNames.add(fromNode.toLowerCase())
    }
    stats.imported += await batchInsert(toInsert, 'KYI edges (persons)', stats) || 0
  }

  // --- New SEC Ownership & Activity ---
  await ingestSecFiling('sec_13d.csv', 'sec_13d', 'firm', 'filer_name', 'SEC_13D', existingNames, stats)
  await ingestSecFiling('sec_13g.csv', 'sec_13g', 'firm', 'filer_name', 'SEC_13G', existingNames, stats)
  await ingestSecFiling('sec_form4.csv', 'sec_form4', 'person', 'filer_name', 'SEC_FORM4', existingNames, stats)
  await ingestSecFiling('sec_form3.csv', 'sec_form3', 'person', 'filer_name', 'SEC_FORM3', existingNames, stats)
  await ingestSecFiling('sec_form5.csv', 'sec_form5', 'person', 'filer_name', 'SEC_FORM5', existingNames, stats)

  // --- New SEC Company Disclosures ---
  await ingestSecFiling('sec_10k.csv', 'sec_10k', 'firm', 'company_name', 'SEC_10K', existingNames, stats)
  await ingestSecFiling('sec_10q.csv', 'sec_10q', 'firm', 'company_name', 'SEC_10Q', existingNames, stats)
  await ingestSecFiling('sec_8k.csv', 'sec_8k', 'firm', 'company_name', 'SEC_8K', existingNames, stats)
  await ingestSecFiling('sec_def14a.csv', 'sec_def14a', 'firm', 'company_name', 'SEC_DEF14A', existingNames, stats)
  await ingestSecFiling('sec_20f.csv', 'sec_20f', 'firm', 'company_name', 'SEC_20F', existingNames, stats)
  await ingestSecFiling('sec_6k.csv', 'sec_6k', 'firm', 'company_name', 'SEC_6K', existingNames, stats)

  // --- New SEC Capital & M&A ---
  await ingestSecFiling('sec_s1.csv', 'sec_s1', 'firm', 'company_name', 'SEC_S1', existingNames, stats)
  await ingestSecFiling('sec_s3.csv', 'sec_s3', 'firm', 'company_name', 'SEC_S3', existingNames, stats)
  await ingestSecFiling('sec_s4.csv', 'sec_s4', 'firm', 'company_name', 'SEC_S4', existingNames, stats)
  await ingestSecFiling('sec_f1.csv', 'sec_f1', 'firm', 'company_name', 'SEC_F1', existingNames, stats)
  await ingestSecFiling('sec_schedule_to.csv', 'sec_schedule_to', 'firm', 'company_name', 'SEC_SCHEDULE_TO', existingNames, stats)

  // --- Enforcement ---
  await ingestSecFiling('sec_enforcement.csv', 'sec_enforcement', 'firm', 'entity_name', 'SEC_ENFORCEMENT', existingNames, stats)

  // --- SEC Subsidiaries ---
  if (fs.existsSync(path.join(dataDir, 'sec_subsidiaries.csv'))) {
    await ingestOptional('SEC Subsidiaries', 'sec_subsidiaries.csv', {
      getDisplayName: (r) => (r.subsidiary_name || '').trim(),
      entity_type: 'firm',
      sources: (r) => [{ source_name: 'SEC_SUBSIDIARY', url: r.link, confidence: 0.8, parent: r.parent_company }],
      signals: { sec_subsidiary: true },
    }, existingNames, stats)
  }

  // --- Fund / Adviser ---
  if (fs.existsSync(path.join(dataDir, 'sec_adv.csv'))) {
    await ingestOptional('SEC ADV', 'sec_adv.csv', {
      getDisplayName: (r) => (r.adviser_name || '').trim(),
      getCity: (r) => (r.city || '').trim() || null,
      getState: (r) => (r.state || '').trim() || null,
      entity_type: 'firm',
      sources: (r) => [{ source_name: 'SEC_ADV', url: r.link, crd: r.crd_number, confidence: 0.95 }],
      signals: { sec_adv: true },
    }, existingNames, stats)
  }
  if (fs.existsSync(path.join(dataDir, 'finra_brokercheck.csv'))) {
    await ingestOptional('FINRA BrokerCheck', 'finra_brokercheck.csv', {
      getDisplayName: (r) => (r.entity_name || '').trim(),
      getCity: (r) => (r.branch_city || '').trim() || null,
      getState: (r) => (r.branch_state || '').trim() || null,
      entity_type: 'firm',
      sources: (r) => [{ source_name: 'FINRA', url: r.link, crd: r.crd_number, confidence: 0.95 }],
      signals: { finra_brokercheck: true },
    }, existingNames, stats)
  }

  // --- Corporate / Entity ---
  if (fs.existsSync(path.join(dataDir, 'opencorporates.csv'))) {
    await ingestOptional('OpenCorporates', 'opencorporates.csv', {
      getDisplayName: (r) => (r.company_name || '').trim(),
      getCity: (r) => (r.city || '').trim() || null,
      getState: (r) => (r.state || '').trim() || null,
      entity_type: 'firm',
      sources: (r) => [{ source_name: 'OPENCORPORATES', url: r.link, confidence: 0.8 }],
      signals: { opencorporates: true },
    }, existingNames, stats)
  }
  if (fs.existsSync(path.join(dataDir, 'companies_house.csv'))) {
    await ingestOptional('Companies House', 'companies_house.csv', {
      getDisplayName: (r) => (r.company_name || '').trim(),
      entity_type: 'firm',
      sources: (r) => [{ source_name: 'COMPANIES_HOUSE', url: r.link, confidence: 0.85 }],
      signals: { companies_house: true },
    }, existingNames, stats)
  }

  // --- Lobbying ---
  if (fs.existsSync(path.join(dataDir, 'lobbying_senate.csv'))) {
    await ingestOptional('Lobbying (Senate)', 'lobbying_senate.csv', {
      getDisplayName: (r) => (r.registrant_name || r.client_name || '').trim(),
      getCity: (r) => (r.registrant_city || '').trim() || null,
      getState: (r) => (r.registrant_state || '').trim() || null,
      entity_type: 'firm',
      sources: (r) => [{ source_name: 'LOBBYING_SENATE', url: r.link, confidence: 0.85 }],
      signals: { lobbying_disclosure: true },
    }, existingNames, stats)
  }
  if (fs.existsSync(path.join(dataDir, 'lobbying_house.csv'))) {
    await ingestOptional('Lobbying (House)', 'lobbying_house.csv', {
      getDisplayName: (r) => (r.registrant_name || r.client_name || '').trim(),
      entity_type: 'firm',
      sources: (r) => [{ source_name: 'LOBBYING_HOUSE', confidence: 0.8 }],
      signals: { lobbying_disclosure: true },
    }, existingNames, stats)
  }

  // --- International ---
  if (fs.existsSync(path.join(dataDir, 'sedar_filings.csv'))) {
    await ingestOptional('SEDAR+', 'sedar_filings.csv', {
      getDisplayName: (r) => (r.issuer_name || '').trim(),
      entity_type: 'firm',
      sources: (r) => [{ source_name: 'SEDAR', url: r.link, confidence: 0.8 }],
      signals: { sedar: true },
    }, existingNames, stats)
  }

  // --- Alternative / Edge ---
  if (fs.existsSync(path.join(dataDir, 'press_releases.csv'))) {
    await ingestOptional('Press Releases', 'press_releases.csv', {
      getDisplayName: (r) => (r.title || '').trim().slice(0, 200),
      entity_type: 'firm',
      sources: (r) => [{ source_name: r.source || 'PRESS', url: r.link, confidence: 0.6 }],
      signals: { press_release: true },
    }, existingNames, stats)
  }
  if (fs.existsSync(path.join(dataDir, 'news_sentiment.csv'))) {
    await ingestOptional('News Sentiment', 'news_sentiment.csv', {
      getDisplayName: (r) => (r.entity_name || '').trim().slice(0, 200),
      entity_type: 'firm',
      sources: (r) => [{ source_name: 'GDELT', url: r.sample_url, confidence: 0.5 }],
      signals: { news_sentiment: true },
    }, existingNames, stats)
  }

  // --- USPTO ---
  if (fs.existsSync(path.join(dataDir, 'uspto_patents.csv'))) {
    await ingestOptional('USPTO Patents', 'uspto_patents.csv', {
      getDisplayName: (r) => (r.assignee_name || '').trim(),
      getCity: (r) => (r.city || '').trim() || null,
      getState: (r) => (r.state || '').trim() || null,
      entity_type: 'firm',
      sources: (r) => [{ source_name: 'USPTO', url: r.link, confidence: 0.9 }],
      signals: { uspto_patent: true },
    }, existingNames, stats)
  }

  // --- Geo backfill: update existing leads that were imported without coordinates ---
  await backfillMissingGeo(stats)

  try {
    const now = new Date().toISOString()
    await supabase.from('kyi_platform_metadata').upsert(
      { key: 'last_lead_import_at', value: { at: now }, updated_at: now },
      { onConflict: 'key' },
    )
    console.log('  Recorded last_lead_import_at:', now)

    if (stats.imported > 0) {
      const { error: notifyError } = await supabase.rpc('notify_kyi_leads_imported', {
        p_lead_count: stats.imported,
        p_needs_geocode_count: stats.needsGeocode > 0 ? stats.needsGeocode : null,
        p_import_batch_key: now,
      })
      if (notifyError) {
        console.warn('  KYI lead notification RPC failed (run supabase-kyi-notifications-migration.sql):', notifyError.message)
      } else {
        console.log('  Notified KYI stakeholders about', stats.imported, 'new leads')
      }
    }
  } catch (e) {
    console.warn('  Could not update kyi_platform_metadata (run supabase-kyi-refinement-migration.sql):', e?.message ?? e)
  }

  console.log('')
  console.log('Done. Total imported this run:', stats.imported)
  if (stats.geoBackfilled) console.log('  Geo backfilled:', stats.geoBackfilled)
  console.log('  Total rows processed:', stats.total_rows)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
