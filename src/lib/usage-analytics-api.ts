// Client data layer for the "AI Usage & Credits" dashboard.
//
// All numbers come from the `usage-analytics` edge function, which pulls them
// from OpenRouter server-side (the key never reaches the browser). We fetch the
// full 30-day window ONCE and do every range/rollup client-side, so switching
// between 7/14/30 days is instant and never refetches.
//
// The aggregation helpers below are pure functions of the row set — they carry
// the dashboard's correctness, so they're unit-tested in usage-analytics-api.test.ts.
import Papa from 'papaparse'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsageRow {
  date: string // YYYY-MM-DD (UTC)
  model: string
  provider: string | null
  usage: number // paid OpenRouter spend, USD
  byok_usage: number // spend via the org's own provider key (BYOK), USD
  requests: number
  prompt_tokens: number
  completion_tokens: number
  reasoning_tokens: number
}

export interface UsageCredits {
  total_credits: number
  total_usage: number
  remaining: number
}

export type UsageStatus =
  | 'ok'
  | 'key_unauthorized'
  | 'no_key'
  | 'openrouter_error'
  | 'openrouter_unreachable'
  | 'forbidden'
  | 'unauthorized'
  | 'not_configured'
  | 'error'

export interface UsageAnalyticsResponse {
  status: UsageStatus
  keyType?: 'provisioning' | 'inference' | 'none'
  credits?: UsageCredits | null
  rows?: UsageRow[]
  meta?: { fetchedAt: string; rangeDays: number; rowCount: number }
  message?: string
}

export type RangeDays = 1 | 3 | 7 | 14 | 30
export const RANGE_OPTIONS: RangeDays[] = [1, 3, 7, 14, 30]

/** Short labels for the segmented range control (data is daily UTC, so the
 *  shortest window is the most recent completed day, surfaced as "24h"). */
export const RANGE_LABELS: Record<RangeDays, string> = {
  1: '24h',
  3: '3d',
  7: '7d',
  14: '14d',
  30: '30d',
}

/** Prose form for chart/table descriptions ("last 24 hours", "last 7 days"). */
export const RANGE_LABELS_LONG: Record<RangeDays, string> = {
  1: '24 hours',
  3: '3 days',
  7: '7 days',
  14: '14 days',
  30: '30 days',
}

export type UsageMetric = 'usage' | 'requests' | 'tokens'

/** Fold-to-"Other" threshold: the categorical palette is safe up to this many
 *  distinct series (see the dataviz skill); the rest collapse into "Other". */
export const OTHER_LABEL = 'Other'
export const MAX_SERIES = 6

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchUsageAnalytics(): Promise<UsageAnalyticsResponse> {
  if (!isSupabaseConfigured) {
    return { status: 'not_configured', message: 'Supabase is not configured.' }
  }
  const { data, error } = await supabase.functions.invoke('usage-analytics', { body: {} })
  if (error) {
    // supabase-js surfaces non-2xx as an error; the Response is on `.context`.
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json()
        const mappedStatus: UsageStatus =
          ctx.status === 403 ? 'forbidden' : ctx.status === 401 ? 'unauthorized' : 'error'
        return {
          status: (body?.status as UsageStatus) || mappedStatus,
          message: body?.error || body?.message,
        }
      } catch {
        /* fall through */
      }
    }
    return { status: 'error', message: error.message }
  }
  return (data as UsageAnalyticsResponse) ?? { status: 'error', message: 'Empty response.' }
}

// ---------------------------------------------------------------------------
// Range selection
// ---------------------------------------------------------------------------

/** The N most recent distinct dates present in the data. Using the dates that
 *  actually exist (rather than "now − N days") sidesteps OpenRouter's
 *  "last 30 *completed* UTC days" boundary, where today's row may be absent. */
export function lastNDates(rows: UsageRow[], n: number): string[] {
  const dates = [...new Set(rows.map((r) => r.date))].sort()
  return dates.slice(-n)
}

export function filterByRange(rows: UsageRow[], days: RangeDays): UsageRow[] {
  const keep = new Set(lastNDates(rows, days))
  return rows.filter((r) => keep.has(r.date))
}

// ---------------------------------------------------------------------------
// Metrics & totals
// ---------------------------------------------------------------------------

export function rowTokens(r: UsageRow): number {
  return r.prompt_tokens + r.completion_tokens + r.reasoning_tokens
}

export function metricValue(r: UsageRow, m: UsageMetric): number {
  if (m === 'usage') return r.usage
  if (m === 'requests') return r.requests
  return rowTokens(r)
}

export interface UsageTotals {
  spend: number // paid OpenRouter spend
  byokSpend: number
  requests: number
  promptTokens: number
  completionTokens: number
  reasoningTokens: number
  totalTokens: number
  /** Blended cost per 1M tokens = paid spend / total tokens × 1e6. */
  blendedPerMillion: number
}

export function computeTotals(rows: UsageRow[]): UsageTotals {
  const t: UsageTotals = {
    spend: 0,
    byokSpend: 0,
    requests: 0,
    promptTokens: 0,
    completionTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    blendedPerMillion: 0,
  }
  for (const r of rows) {
    t.spend += r.usage
    t.byokSpend += r.byok_usage
    t.requests += r.requests
    t.promptTokens += r.prompt_tokens
    t.completionTokens += r.completion_tokens
    t.reasoningTokens += r.reasoning_tokens
  }
  t.totalTokens = t.promptTokens + t.completionTokens + t.reasoningTokens
  t.blendedPerMillion = t.totalTokens > 0 ? (t.spend / t.totalTokens) * 1_000_000 : 0
  return t
}

// ---------------------------------------------------------------------------
// Rankings & series
// ---------------------------------------------------------------------------

export interface ModelRank {
  model: string
  spend: number
  byokSpend: number
  requests: number
  tokens: number
  share: number // of the selected metric, 0..1
}

/** Models ranked by `metric` desc, each with a share of that metric's total. */
export function rankModels(rows: UsageRow[], metric: UsageMetric = 'usage'): ModelRank[] {
  const by = new Map<string, ModelRank>()
  for (const r of rows) {
    const cur =
      by.get(r.model) ??
      { model: r.model, spend: 0, byokSpend: 0, requests: 0, tokens: 0, share: 0 }
    cur.spend += r.usage
    cur.byokSpend += r.byok_usage
    cur.requests += r.requests
    cur.tokens += rowTokens(r)
    by.set(r.model, cur)
  }
  const ranks = [...by.values()]
  const metricOf = (m: ModelRank) =>
    metric === 'usage' ? m.spend : metric === 'requests' ? m.requests : m.tokens
  const total = ranks.reduce((s, m) => s + metricOf(m), 0)
  for (const m of ranks) m.share = total > 0 ? metricOf(m) / total : 0
  return ranks.sort((a, b) => metricOf(b) - metricOf(a))
}

export interface ProviderRank {
  provider: string
  spend: number
  requests: number
  tokens: number
  share: number
}

export function rankProviders(rows: UsageRow[], metric: UsageMetric = 'usage'): ProviderRank[] {
  const by = new Map<string, ProviderRank>()
  for (const r of rows) {
    const key = r.provider || 'Unknown'
    const cur = by.get(key) ?? { provider: key, spend: 0, requests: 0, tokens: 0, share: 0 }
    cur.spend += r.usage
    cur.requests += r.requests
    cur.tokens += rowTokens(r)
    by.set(key, cur)
  }
  const ranks = [...by.values()]
  const metricOf = (p: ProviderRank) =>
    metric === 'usage' ? p.spend : metric === 'requests' ? p.requests : p.tokens
  const total = ranks.reduce((s, p) => s + metricOf(p), 0)
  for (const p of ranks) p.share = total > 0 ? metricOf(p) / total : 0
  return ranks.sort((a, b) => metricOf(b) - metricOf(a))
}

/** Top `limit` model names by `metric`; the rest are represented by "Other". */
export function topModelNames(
  rows: UsageRow[],
  metric: UsageMetric = 'usage',
  limit = MAX_SERIES,
): string[] {
  return rankModels(rows, metric)
    .slice(0, limit)
    .map((m) => m.model)
}

export interface DayPoint {
  date: string
  [series: string]: number | string
}

/** Sorted list of distinct dates present (ascending). */
export function distinctDates(rows: UsageRow[]): string[] {
  return [...new Set(rows.map((r) => r.date))].sort()
}

/**
 * Pivot rows into one point per day, with a numeric key per model in `models`
 * (everything else folded into "Other"). Days with no data still appear as
 * zero-filled points so the time axis is continuous.
 */
export function pivotByDayModel(
  rows: UsageRow[],
  metric: UsageMetric,
  models: string[],
): DayPoint[] {
  const known = new Set(models)
  const dates = distinctDates(rows)
  const points = new Map<string, DayPoint>()
  for (const date of dates) {
    const p: DayPoint = { date }
    for (const m of models) p[m] = 0
    p[OTHER_LABEL] = 0
    points.set(date, p)
  }
  for (const r of rows) {
    const p = points.get(r.date)
    if (!p) continue
    const key = known.has(r.model) ? r.model : OTHER_LABEL
    p[key] = (p[key] as number) + metricValue(r, metric)
  }
  return [...points.values()]
}

export interface TokenDayPoint {
  date: string
  prompt: number
  completion: number
  reasoning: number
}

export function tokenBreakdownByDay(rows: UsageRow[]): TokenDayPoint[] {
  const by = new Map<string, TokenDayPoint>()
  for (const date of distinctDates(rows)) {
    by.set(date, { date, prompt: 0, completion: 0, reasoning: 0 })
  }
  for (const r of rows) {
    const p = by.get(r.date)
    if (!p) continue
    p.prompt += r.prompt_tokens
    p.completion += r.completion_tokens
    p.reasoning += r.reasoning_tokens
  }
  return [...by.values()]
}

export interface UsageTypeDayPoint {
  date: string
  paid: number
  byok: number
}

export function usageTypeByDay(rows: UsageRow[]): UsageTypeDayPoint[] {
  const by = new Map<string, UsageTypeDayPoint>()
  for (const date of distinctDates(rows)) {
    by.set(date, { date, paid: 0, byok: 0 })
  }
  for (const r of rows) {
    const p = by.get(r.date)
    if (!p) continue
    p.paid += r.usage
    p.byok += r.byok_usage
  }
  return [...by.values()]
}

// ---------------------------------------------------------------------------
// Trending — current window vs the preceding equal-length window
// ---------------------------------------------------------------------------

export interface ModelTrend {
  model: string
  current: number
  previous: number
  delta: number
  deltaPct: number | null // null when previous == 0 (i.e. new)
  isNew: boolean
}

export function trendingModels(
  allRows: UsageRow[],
  days: RangeDays,
  metric: UsageMetric = 'usage',
): ModelTrend[] {
  const dates = distinctDates(allRows)
  const current = new Set(dates.slice(-days))
  const previous = new Set(dates.slice(-days * 2, -days))

  const sums = new Map<string, { current: number; previous: number }>()
  for (const r of allRows) {
    const inCur = current.has(r.date)
    const inPrev = previous.has(r.date)
    if (!inCur && !inPrev) continue
    const cur = sums.get(r.model) ?? { current: 0, previous: 0 }
    if (inCur) cur.current += metricValue(r, metric)
    if (inPrev) cur.previous += metricValue(r, metric)
    sums.set(r.model, cur)
  }

  const trends: ModelTrend[] = [...sums.entries()].map(([model, s]) => {
    const delta = s.current - s.previous
    return {
      model,
      current: s.current,
      previous: s.previous,
      delta,
      deltaPct: s.previous > 0 ? (delta / s.previous) * 100 : null,
      isNew: s.previous === 0 && s.current > 0,
    }
  })
  // Rank by current-window magnitude desc (matches OpenRouter's "Trending").
  return trends.filter((t) => t.current > 0).sort((a, b) => b.current - a.current)
}

/**
 * Split the full row set into the current window (last `days` dates) and the
 * immediately-preceding window of the same length — for "vs previous period"
 * deltas. The previous window is empty when there isn't enough history.
 */
export function splitWindows(
  all: UsageRow[],
  days: RangeDays,
): { current: UsageRow[]; previous: UsageRow[] } {
  const dates = distinctDates(all)
  const current = new Set(dates.slice(-days))
  const previous = new Set(dates.slice(-days * 2, -days))
  return {
    current: all.filter((r) => current.has(r.date)),
    previous: all.filter((r) => previous.has(r.date)),
  }
}

/** Percent change, or null when there's no positive baseline to compare against. */
export function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

const CSV_HEADERS: Array<keyof UsageRow> = [
  'date',
  'model',
  'provider',
  'usage',
  'byok_usage',
  'requests',
  'prompt_tokens',
  'completion_tokens',
  'reasoning_tokens',
]

/** Full per-day-per-model rows as CSV — "export all of this data". */
export function usageRowsToCsv(rows: UsageRow[]): string {
  const sorted = [...rows].sort((a, b) =>
    a.date === b.date ? a.model.localeCompare(b.model) : a.date.localeCompare(b.date),
  )
  return Papa.unparse({
    fields: CSV_HEADERS as string[],
    data: sorted.map((r) => CSV_HEADERS.map((h) => r[h] ?? '')),
  })
}

/** Trigger a browser download of `csv` as `filename`. No-op outside the browser. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatUsd(n: number, opts?: { maxFrac?: number }): string {
  const maxFrac = opts?.maxFrac ?? (Math.abs(n) < 1 ? 4 : 2)
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  })
}

export function formatCompact(n: number): string {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}
