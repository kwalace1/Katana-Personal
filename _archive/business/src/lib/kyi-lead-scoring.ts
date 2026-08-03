/**
 * Lead quality scoring — keep in sync with `scoreLead()` in scripts/kyi-import-data.mjs.
 *
 * Scores are computed from signal flags only (not from stored raw_score), so UI/API
 * stay correct after geocoding or signal updates without re-import.
 */

export type KyiLeadSignals = Record<string, unknown> & {
  sec_13f?: boolean
  sec_form_d?: boolean
  fec_donor?: boolean
  business_registry?: boolean
  [key: string]: unknown
}

export const KYI_LEAD_SIGNAL_WEIGHTS = {
  sec_13d: 30,
  sec_13g: 25,
  sec_13f: 25,
  sec_form_d: 25,
  sec_form4: 20,
  sec_form3: 15,
  sec_form5: 10,
  sec_10k: 20,
  sec_10q: 10,
  sec_8k: 15,
  sec_def14a: 15,
  sec_20f: 15,
  sec_6k: 10,
  sec_s1: 25,
  sec_s3: 15,
  sec_s4: 20,
  sec_f1: 20,
  sec_schedule_to: 20,
  sec_enforcement: 10,
  sec_subsidiary: 10,
  sec_adv: 20,
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
  multi_2: 1.15,
  multi_3: 1.25,
  multi_4: 1.35,
  multi_5: 1.45,
} as const

/** Strong multi-signal lead — maps to 100% in the fit meter. */
export const KYI_SCORE_REFERENCE_MAX = 90

const GEO_BONUS = 2
const RAISE_BOOST_CAP = 15
const SECTOR_MATCH_BOOST = 8

export type RaiseContext = {
  stage?: string | null
  industry?: string | null
  sectorTags?: string[]
  preferredTypes?: string[]
}

export type LeadScoreOpts = {
  hasCoordinates?: boolean
  raise?: RaiseContext | null
  tags?: string[]
  metadata?: Record<string, unknown> | null
}

const CAPITAL_SIGNAL_KEYS = ['sec_form_d', 'sec_adv', 'sec_13f', 'sec_s1', 'sec_s3'] as const

function normalizeTokens(values: (string | null | undefined)[]): string[] {
  return values
    .flatMap((v) => (v ?? '').split(/[,;|/]+/))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function computeRaiseBoost(
  signals: KyiLeadSignals,
  opts?: LeadScoreOpts,
): number {
  const raise = opts?.raise
  if (!raise) return 0
  let boost = 0
  const preferred = normalizeTokens(raise.preferredTypes ?? [])
  const wantsCapital =
    preferred.length === 0 ||
    preferred.some((p) =>
      /vc|venture|pe|private equity|family office|angel|fund|capital|adviser|advisor/i.test(p),
    )
  if (wantsCapital) {
    for (const key of CAPITAL_SIGNAL_KEYS) {
      if (signals[key]) boost += 3
    }
  }
  const industry = (raise.industry ?? '').trim().toLowerCase()
  const sectorTags = normalizeTokens(raise.sectorTags ?? [])
  const leadTags = (opts?.tags ?? []).map((t) => t.toLowerCase())
  const metaSlug = String(
    opts?.metadata?.data_category_slug ?? opts?.metadata?.category_slug ?? '',
  ).toLowerCase()
  const haystack = [...leadTags, metaSlug, industry].filter(Boolean).join(' ')
  if (industry && haystack.includes(industry)) boost += SECTOR_MATCH_BOOST
  for (const tag of sectorTags) {
    if (tag && haystack.includes(tag)) {
      boost += 4
      break
    }
  }
  return Math.min(RAISE_BOOST_CAP, boost)
}

export function computeLeadScore(
  signals: KyiLeadSignals | null | undefined,
  opts?: LeadScoreOpts,
): number {
  const s = signals ?? {}
  let base = 0
  const fired: string[] = []
  for (const [key, weight] of Object.entries(KYI_LEAD_SIGNAL_WEIGHTS)) {
    if (key.startsWith('multi_')) continue
    if (s[key]) {
      base += weight
      fired.push(key)
    }
  }
  const mult =
    fired.length >= 5
      ? KYI_LEAD_SIGNAL_WEIGHTS.multi_5
      : fired.length >= 4
        ? KYI_LEAD_SIGNAL_WEIGHTS.multi_4
        : fired.length >= 3
          ? KYI_LEAD_SIGNAL_WEIGHTS.multi_3
          : fired.length >= 2
            ? KYI_LEAD_SIGNAL_WEIGHTS.multi_2
            : 1
  let score = Math.round(base * mult)
  if (opts?.hasCoordinates) score += GEO_BONUS
  score += computeRaiseBoost(s, opts)
  return score
}

export interface LeadScoreBreakdownItem {
  key: string
  weight: number
}

/** Top contributing signal keys for UI explainability. */
export function getLeadScoreBreakdown(
  signals: KyiLeadSignals | null | undefined,
  opts?: LeadScoreOpts,
  limit = 3,
): LeadScoreBreakdownItem[] {
  const s = signals ?? {}
  const items: LeadScoreBreakdownItem[] = []
  for (const [key, weight] of Object.entries(KYI_LEAD_SIGNAL_WEIGHTS)) {
    if (key.startsWith('multi_')) continue
    if (s[key]) items.push({ key, weight })
  }
  items.sort((a, b) => b.weight - a.weight)
  const top = items.slice(0, limit)
  const raiseBoost = computeRaiseBoost(s, opts)
  if (raiseBoost > 0 && top.length < limit) {
    top.push({ key: 'raise_fit', weight: raiseBoost })
  }
  return top.slice(0, limit)
}

/** 0–100 fit score for display (not a literal database percentile). */
export function leadScoreToFitPercent(score: number): number {
  return Math.min(100, Math.max(0, Math.round((score / KYI_SCORE_REFERENCE_MAX) * 100)))
}

/** Simple sector relevance check for optional lead list filter. */
export function leadMatchesSector(
  lead: {
    tags?: string[]
    metadata?: Record<string, unknown> | null
    signals?: KyiLeadSignals | null
  },
  raise: RaiseContext | null | undefined,
): boolean {
  if (!raise) return true
  const industry = (raise.industry ?? '').trim().toLowerCase()
  const sectorTags = normalizeTokens(raise.sectorTags ?? [])
  if (!industry && sectorTags.length === 0) return true
  const leadTags = (lead.tags ?? []).map((t) => t.toLowerCase())
  const metaSlug = String(
    lead.metadata?.data_category_slug ?? lead.metadata?.category_slug ?? '',
  ).toLowerCase()
  const haystack = [...leadTags, metaSlug].join(' ')
  if (industry && haystack.includes(industry)) return true
  return sectorTags.some((t) => t && haystack.includes(t))
}

export type KyiLeadFilterPresetId =
  | 'capital_signals'
  | 'ownership'
  | 'exclude_enforcement'
  | 'firms_only'

export const KYI_LEAD_FILTER_PRESETS: Record<
  KyiLeadFilterPresetId,
  { label: string; signalKeys?: string[]; excludeSignals?: string[]; entityType?: 'firm' }
> = {
  capital_signals: {
    label: 'Capital signals',
    signalKeys: ['sec_form_d', 'sec_adv', 'sec_s1', 'sec_s3', 'sec_f1'],
  },
  ownership: {
    label: 'Ownership',
    signalKeys: ['sec_13f', 'sec_13d', 'sec_13g'],
  },
  exclude_enforcement: {
    label: 'Exclude enforcement',
    excludeSignals: ['sec_enforcement'],
  },
  firms_only: {
    label: 'Firms only',
    entityType: 'firm',
  },
}

export function leadMatchesFilterPresets(
  lead: {
    entity_type: string
    signals?: KyiLeadSignals | null
  },
  presetIds: KyiLeadFilterPresetId[],
): boolean {
  if (presetIds.length === 0) return true
  const signals = lead.signals ?? {}
  for (const id of presetIds) {
    const preset = KYI_LEAD_FILTER_PRESETS[id]
    if (preset.entityType && lead.entity_type !== preset.entityType) return false
    if (preset.excludeSignals?.some((k) => signals[k])) return false
    if (preset.signalKeys?.length) {
      const any = preset.signalKeys.some((k) => signals[k])
      if (!any) return false
    }
  }
  return true
}
