/**
 * Shared utilities for KYI fetcher modules.
 * Extracted from kyi-fetch-data.mjs for modular reuse.
 */
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

const REQUEST_TIMEOUT_MS = 30_000

export function dateStr(d) {
  return d.toISOString().slice(0, 10)
}

export function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const opts = {
      headers: { Accept: 'application/json', 'User-Agent': 'Katana-KYI/1.0 (kyi-fetch)', ...headers },
      timeout: REQUEST_TIMEOUT_MS,
    }
    const req = lib
      .get(url, opts, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchJson(res.headers.location, headers).then(resolve).catch(reject)
        }
        if (res.statusCode !== 200) {
          const chunks = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () =>
            reject(new Error(`HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString().slice(0, 200)}`)),
          )
          return
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()))
          } catch (e) {
            reject(new Error('JSON parse error: ' + e.message))
          }
        })
        res.on('error', reject)
      })
      .on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timed out: ${url}`))
    })
  })
}

export function fetchText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const opts = {
      headers: { 'User-Agent': 'Katana-KYI/1.0 (kyi-fetch)', ...headers },
      timeout: REQUEST_TIMEOUT_MS,
    }
    const req = lib
      .get(url, opts, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchText(res.headers.location, headers).then(resolve).catch(reject)
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString()))
        res.on('error', reject)
      })
      .on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timed out: ${url}`))
    })
  })
}

export function fetchBuffer(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const opts = {
      headers: { 'User-Agent': 'Katana-KYI/1.0 (kyi-fetch)', ...headers },
      timeout: 120_000,
    }
    const req = lib
      .get(url, opts, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchBuffer(res.headers.location, headers).then(resolve).catch(reject)
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      .on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timed out: ${url}`))
    })
  })
}

export function escapeCsv(val) {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function writeCsv(dataDir, filename, headers, rows) {
  const filepath = path.join(dataDir, filename)
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(headers.map((h) => escapeCsv(row[h])).join(','))
  fs.writeFileSync(filepath, lines.join('\n') + '\n')
  console.log(`  ${filename}: ${rows.length} rows`)
}

/** SEC EDGAR EFTS helper: fetch filings by form type(s). */
export async function fetchEdgarFilings(forms, lookbackDays, maxResults = 200) {
  const startDate = dateStr(daysAgo(lookbackDays))
  const endDate = dateStr(new Date())
  const url =
    `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(forms)}%22` +
    `&forms=${encodeURIComponent(forms)}` +
    `&dateRange=custom&startdt=${startDate}&enddt=${endDate}` +
    `&start=0&count=${maxResults}`
  const data = await fetchJson(url, { 'User-Agent': 'Katana-KYI/1.0 admin@katana.dev' })
  return data.hits?.hits || []
}

/** Parse common fields from an EDGAR EFTS hit, including location when available. */
export function parseEdgarHit(hit) {
  const s = hit._source || {}
  const displayNames = Array.isArray(s.display_names) ? s.display_names : []
  const name = (displayNames[0] || '').trim()
  const cik = Array.isArray(s.ciks) ? s.ciks[0] || '' : ''
  const adsh = s.adsh || ''
  const adshPath = adsh.replace(/-/g, '')
  const filingUrl =
    cik && adsh
      ? `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${adshPath}/${adsh}-index.htm`
      : ''

  // biz_locations is e.g. ["Santa Monica, CA"] — parse into city + state
  const bizLocations = Array.isArray(s.biz_locations) ? s.biz_locations : []
  const firstLoc = (bizLocations[0] || '').trim()
  let city = ''
  let state = ''
  if (firstLoc) {
    const commaIdx = firstLoc.lastIndexOf(',')
    if (commaIdx >= 0) {
      city = firstLoc.slice(0, commaIdx).trim()
      state = firstLoc.slice(commaIdx + 1).trim()
    } else {
      city = firstLoc
    }
  }
  // Fallback: biz_states alone when biz_locations is empty
  if (!state) {
    const bizStates = Array.isArray(s.biz_states) ? s.biz_states : []
    state = (bizStates[0] || '').trim()
  }

  return {
    name,
    cik,
    adsh,
    form: s.form || '',
    fileDate: s.file_date || '',
    filingUrl,
    city,
    state,
  }
}
