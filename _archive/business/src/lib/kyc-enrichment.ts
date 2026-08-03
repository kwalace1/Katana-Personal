/**
 * KYC external enrichment — fetch public data and derive external signals.
 * Used by api/kyc-enrich, batch scripts, and the Customers UI.
 */

import type { KycClientSignals } from './kyc-client-scoring'

// ==================== TYPES ====================

export interface RegistryMatch {
  company_name: string
  company_number: string
  jurisdiction: string
  status: string
  incorporation_date: string
  company_type: string
  city: string
  state: string
  url: string
}

export interface NewsArticle {
  title: string
  url: string
  date: string
  tone: number
  themes: string[]
}

export interface EnrichmentPayload {
  company_query: string
  registry: RegistryMatch | null
  news: NewsArticle[]
  fetched_at: string
  errors: string[]
}

export type KycExternalSignals = KycClientSignals & {
  registry_match?: boolean
  registry_active?: boolean
  recent_news?: boolean
  expansion_news?: boolean
  contraction_news?: boolean
  leadership_news?: boolean
  funding_news?: boolean
  press_mention?: boolean
  hiring_activity?: boolean
  new_location?: boolean
  website_change?: boolean
}

export const KYC_EXTERNAL_SIGNAL_LABELS: Record<
  string,
  { label: string; category: string; color: string; sentiment: 'positive' | 'negative' | 'neutral' }
> = {
  registry_match: { label: 'Registry Match', category: 'External', color: 'gray', sentiment: 'neutral' },
  registry_active: { label: 'Active Registry', category: 'External', color: 'green', sentiment: 'positive' },
  recent_news: { label: 'Recent News', category: 'External', color: 'blue', sentiment: 'neutral' },
  expansion_news: { label: 'Expansion Signal', category: 'External', color: 'green', sentiment: 'positive' },
  contraction_news: { label: 'Contraction Risk', category: 'External', color: 'red', sentiment: 'negative' },
  leadership_news: { label: 'Leadership Change', category: 'External', color: 'amber', sentiment: 'neutral' },
  funding_news: { label: 'Funding News', category: 'External', color: 'green', sentiment: 'positive' },
  press_mention: { label: 'Press Mention', category: 'External', color: 'sky', sentiment: 'neutral' },
  hiring_activity: { label: 'Hiring Activity', category: 'External', color: 'green', sentiment: 'positive' },
  new_location: { label: 'New Location', category: 'External', color: 'green', sentiment: 'positive' },
  website_change: { label: 'Website Change', category: 'External', color: 'blue', sentiment: 'neutral' },
}

const EXPANSION_RE =
  /\b(expansion|expand|growth|hiring|hiring for|job postings?|recruiting|raised|investment|series [a-e]|acquisition|acquires|partnership|launch|opens|new location|new office|new store)\b/i
const CONTRACTION_RE =
  /\b(layoffs?|laid off|restructur|bankruptcy|closure|closes|downsiz|cut jobs|workforce reduction|insolv)\b/i
const LEADERSHIP_RE =
  /\b(ceo|chief executive|appointed|resign|steps down|new president|leadership change|named president)\b/i
const FUNDING_RE = /\b(funding|raised|series [a-e]|venture|investment round|capital raise|ipo)\b/i
const HIRING_RE = /\b(hiring|job posting|recruiting|now hiring|open positions?|operations staff|warehouse staff)\b/i
const LOCATION_RE = /\b(new location|new office|new store|grand opening|opens in|expands to)\b/i
const WEBSITE_RE = /\b(website redesign|new website|rebrand|site launch|digital transformation)\b/i

const FETCH_TIMEOUT_MS = 25_000

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'Katana-KYC/1.0' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function normalizeCompanyName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function jurisdictionCode(state?: string | null, country?: string | null): string {
  const c = (country ?? 'us').trim().toLowerCase()
  if (c === 'us' || c === 'usa' || c === 'united states' || c === '') return 'us'
  if (c.length === 2) return c
  return 'us'
}

export async function fetchCompanyRegistry(
  companyName: string,
  opts?: { state?: string | null; country?: string | null },
): Promise<RegistryMatch | null> {
  const name = normalizeCompanyName(companyName)
  if (!name) return null

  const jurisdiction = jurisdictionCode(opts?.state, opts?.country)
  const url =
    `https://api.opencorporates.com/v0.4/companies/search` +
    `?q=${encodeURIComponent(name)}&jurisdiction_code=${encodeURIComponent(jurisdiction)}&per_page=5&order=score`

  const data = (await fetchJson(url)) as {
    results?: { companies?: Array<{ company?: Record<string, unknown> }> }
  }

  const companies = data?.results?.companies ?? []
  const queryLower = name.toLowerCase()

  for (const item of companies) {
    const c = item.company ?? {}
    const foundName = String(c.name ?? '').trim()
    if (!foundName) continue
    const foundLower = foundName.toLowerCase()
    if (!foundLower.includes(queryLower) && !queryLower.includes(foundLower.split(/\s+/)[0] ?? '')) continue

    const addr = (c.registered_address as Record<string, unknown> | undefined) ?? {}
    return {
      company_name: foundName,
      company_number: String(c.company_number ?? ''),
      jurisdiction: String(c.jurisdiction_code ?? jurisdiction),
      status: String(c.current_status ?? ''),
      incorporation_date: String(c.incorporation_date ?? ''),
      company_type: String(c.company_type ?? ''),
      city: String(addr.locality ?? ''),
      state: String(addr.region ?? opts?.state ?? ''),
      url: String(c.opencorporates_url ?? ''),
    }
  }

  return null
}

export async function fetchCompanyNews(companyName: string, timespanDays = 90): Promise<NewsArticle[]> {
  const name = normalizeCompanyName(companyName)
  if (!name) return []

  const timespan = `${Math.min(Math.max(timespanDays, 7), 90)}d`
  const query = `"${name}"`
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}` +
    `&mode=ArtList&timespan=${timespan}&maxrecords=12&format=json`

  try {
    const data = (await fetchJson(url)) as { articles?: Array<Record<string, unknown>> }
    const articles = data?.articles ?? []
    return articles
      .map((art) => ({
        title: String(art.title ?? '').trim(),
        url: String(art.url ?? ''),
        date: String(art.seendate ?? ''),
        tone: Number(art.tone ?? 0),
        themes: String(art.socialimage ?? '')
          .split(';')
          .filter(Boolean)
          .slice(0, 3),
      }))
      .filter((a) => a.title.length > 0)
  } catch {
    return []
  }
}

export function parseEnrichmentToSignals(payload: EnrichmentPayload): KycExternalSignals {
  const signals: KycExternalSignals = {}

  if (payload.registry) {
    signals.registry_match = true
    const status = payload.registry.status.toLowerCase()
    if (status.includes('active') || status.includes('good standing') || status === '') {
      signals.registry_active = true
    }
  }

  if (payload.news.length > 0) {
    signals.recent_news = true
    signals.press_mention = true
  }

  for (const article of payload.news) {
    const text = `${article.title} ${article.themes.join(' ')}`
    if (EXPANSION_RE.test(text)) signals.expansion_news = true
    if (CONTRACTION_RE.test(text)) signals.contraction_news = true
    if (LEADERSHIP_RE.test(text)) signals.leadership_news = true
    if (FUNDING_RE.test(text)) signals.funding_news = true
    if (HIRING_RE.test(text)) signals.hiring_activity = true
    if (LOCATION_RE.test(text)) signals.new_location = true
    if (WEBSITE_RE.test(text)) signals.website_change = true
  }

  return signals
}

export function enrichmentMetadata(payload: EnrichmentPayload): Record<string, unknown> {
  return {
    company_query: payload.company_query,
    fetched_at: payload.fetched_at,
    registry: payload.registry,
    news_count: payload.news.length,
    news_headlines: payload.news.slice(0, 5).map((n) => ({
      title: n.title,
      url: n.url,
      date: n.date,
    })),
    errors: payload.errors,
  }
}

export async function enrichCompanyFromPublicSources(opts: {
  name: string
  state?: string | null
  country?: string | null
}): Promise<{
  payload: EnrichmentPayload
  external_signals: KycExternalSignals
  enrichment: Record<string, unknown>
}> {
  const company_query = normalizeCompanyName(opts.name)
  const errors: string[] = []

  let registry: RegistryMatch | null = null
  let news: NewsArticle[] = []

  try {
    registry = await fetchCompanyRegistry(company_query, opts)
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Registry fetch failed')
  }

  try {
    news = await fetchCompanyNews(company_query)
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'News fetch failed')
  }

  const payload: EnrichmentPayload = {
    company_query,
    registry,
    news,
    fetched_at: new Date().toISOString(),
    errors,
  }

  const external_signals = parseEnrichmentToSignals(payload)
  return {
    payload,
    external_signals,
    enrichment: enrichmentMetadata(payload),
  }
}

export function mergeSignalLayers(
  internal: KycClientSignals,
  external: KycExternalSignals | null | undefined,
): KycClientSignals {
  if (!external) return internal
  return { ...internal, ...external }
}

export function getExternalSignalKeys(signals: KycClientSignals | null | undefined): string[] {
  return Object.entries(signals ?? {})
    .filter(([key, val]) => val === true && key in KYC_EXTERNAL_SIGNAL_LABELS)
    .map(([key]) => key)
}

export const KYC_EXTERNAL_ATTENTION_WEIGHTS: Record<string, number> = {
  contraction_news: 16,
  leadership_news: 8,
  funding_news: 6,
  expansion_news: 4,
  hiring_activity: 5,
  new_location: 4,
  website_change: 3,
  recent_news: 3,
  registry_match: 2,
}
