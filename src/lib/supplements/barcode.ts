/**
 * Supplement barcode identity.
 * NIH DSLD is the only product source. A match is accepted only when the
 * label's UPC/SKU is the scanned code. Nothing here writes a checklist row.
 */

const DSLD_BASE = 'https://api.ods.od.nih.gov/dsld/v9'
const DSLD_UA = 'KatanaPersonal - Web - Version 1.0 - https://katana-personal.vercel.app'

export class InvalidBarcodeError extends Error {
  constructor() {
    super('Invalid barcode')
    this.name = 'InvalidBarcodeError'
  }
}

export const SUPPLEMENT_NOT_FOUND_MESSAGE = 'Supplement not found. You can still add it manually.'

export class SupplementLookupError extends Error {
  constructor(message = 'Supplement lookup failed') {
    super(message)
    this.name = 'SupplementLookupError'
  }
}

export type SupplementTimeSlot = 'morning' | 'afternoon' | 'evening'

export type SupplementDraft = {
  name: string
  doseNotes: string
  timeOfDay: SupplementTimeSlot
}

export type SupplementMatch = {
  name: string
  /** Manufacturer's labeled serving, when DSLD states one. Not a personal dose. */
  labelServing?: string
}

type DsldServing = {
  minQuantity?: number | null
  maxQuantity?: number | null
  unit?: string | null
}

export type DsldLabel = {
  fullName?: string | null
  brandName?: string | null
  upcSku?: string | null
  offMarket?: number | null
  entryDate?: string | null
  servingSizes?: DsldServing[] | null
}

type DsldSearchHit = {
  _id?: string | number
  _source?: DsldLabel
}

/** Digits only, limited to GTIN lengths we can look up. 12–14 must pass the GS1 check digit. */
export function normalizeProductBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return null
  if (digits.length !== 8 && !gs1CheckDigitOk(digits)) return null
  return digits
}

/** GS1 mod-10 check digit used by UPC-A, EAN-13, and GTIN-14. */
export function gs1CheckDigitOk(digits: string): boolean {
  if (!/^\d{2,}$/.test(digits)) return false
  const nums = digits.split('').map((d) => Number(d))
  const check = nums.pop()
  if (check === undefined) return false
  let sum = 0
  for (let i = 0; i < nums.length; i++) {
    const fromRight = nums.length - 1 - i
    const weight = fromRight % 2 === 0 ? 3 : 1
    sum += nums[i]! * weight
  }
  return (10 - (sum % 10)) % 10 === check
}

/** Quoted DSLD phrases. Some labels store a spaced UPC instead of digits only. */
export function barcodeSearchPhrases(code: string): string[] {
  const phrases = [code]
  if (code.length === 12) {
    phrases.push(`${code[0]} ${code.slice(1, 6)} ${code.slice(6, 11)} ${code[11]}`)
  }
  if (code.length === 13 && code.startsWith('0')) {
    const upc = code.slice(1)
    phrases.push(`${upc[0]} ${upc.slice(1, 6)} ${upc.slice(6, 11)} ${upc[11]}`)
  }
  return [...new Set(phrases)]
}

export function upcMatches(scanned: string, upcSku: string | null | undefined): boolean {
  const stored = (upcSku || '').replace(/\D/g, '')
  if (!stored || !scanned) return false
  if (stored === scanned) return true
  if (scanned.length === 13 && scanned.startsWith('0') && scanned.slice(1) === stored) return true
  if (stored.length === 13 && stored.startsWith('0') && stored.slice(1) === scanned) return true
  return false
}

export function productDisplayName(label: DsldLabel): string | null {
  const name = (label.fullName || '').replace(/\s+/g, ' ').trim()
  if (!name) return null
  const brand = (label.brandName || '').replace(/\s+/g, ' ').trim()
  if (!brand) return name
  if (name.toLowerCase().includes(brand.toLowerCase())) return name
  return `${brand} ${name}`
}

/** Label serving size only. Ingredient amounts are intentionally ignored. */
export function labelServingText(label: DsldLabel): string | undefined {
  const size = (label.servingSizes || []).find((row) => {
    const qty = Number(row?.minQuantity)
    const unit = (row?.unit || '').trim()
    return Number.isFinite(qty) && qty > 0 && unit.length > 0 && unit.toLowerCase() !== 'not present'
  })
  if (!size) return undefined
  const min = Number(size.minQuantity)
  const max = Number(size.maxQuantity)
  const qty = Number.isFinite(max) && max > min ? `${min}–${max}` : String(min)
  return `${qty} ${(size.unit || '').trim()}`
}

export function pickMatchingLabel(scanned: string, labels: DsldLabel[]): DsldLabel | null {
  const matches = labels.filter((label) => upcMatches(scanned, label.upcSku) && productDisplayName(label))
  if (matches.length === 0) return null
  return matches.slice().sort((a, b) => {
    const aOn = a.offMarket === 1 ? 1 : 0
    const bOn = b.offMarket === 1 ? 1 : 0
    if (aOn !== bOn) return aOn - bOn
    return (b.entryDate || '').localeCompare(a.entryDate || '')
  })[0]!
}

export function matchFromLabel(label: DsldLabel): SupplementMatch | null {
  const name = productDisplayName(label)
  if (!name) return null
  const labelServing = labelServingText(label)
  return labelServing ? { name, labelServing } : { name }
}

/**
 * Fill the draft from a confirmed label. Time of day stays whatever the user chose.
 * Existing dose notes are kept so a label serving is never written over a personal note.
 */
export function applySupplementMatch(draft: SupplementDraft, match: SupplementMatch): SupplementDraft {
  const fromLabel = match.labelServing ? `Label serving: ${match.labelServing}` : ''
  return {
    name: match.name,
    doseNotes: draft.doseNotes.trim() ? draft.doseNotes : fromLabel,
    timeOfDay: draft.timeOfDay,
  }
}

/** Camera frames of the same code should not start another lookup. */
export function acceptCameraCode(previous: string | null, raw: string): string | null {
  const code = normalizeProductBarcode(raw)
  if (!code || code === previous) return null
  return code
}

async function dsldJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  let res: Response
  try {
    res = await fetchImpl(url, {
      headers: { Accept: 'application/json', 'User-Agent': DSLD_UA },
    })
  } catch {
    throw new SupplementLookupError()
  }
  if (!res.ok) throw new SupplementLookupError()
  try {
    return (await res.json()) as T
  } catch {
    throw new SupplementLookupError()
  }
}

async function searchLabelIds(fetchImpl: typeof fetch, phrase: string, status: 1 | 2): Promise<string[]> {
  const url =
    `${DSLD_BASE}/search-filter?q=${encodeURIComponent(`"${phrase}"`)}` +
    `&status=${status}&size=5`
  const json = await dsldJson<{ hits?: DsldSearchHit[] }>(fetchImpl, url)
  return (json.hits || [])
    .map((hit) => (hit._id === undefined || hit._id === null ? '' : String(hit._id)))
    .filter((id) => id.length > 0)
}

/**
 * Look up one barcode in the NIH Dietary Supplement Label Database.
 * Returns null when the code is valid and DSLD has no label with that UPC.
 */
export async function lookupSupplementByBarcode(
  raw: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SupplementMatch | null> {
  const code = normalizeProductBarcode(raw)
  if (!code) throw new InvalidBarcodeError()

  const seen = new Set<string>()
  for (const status of [1, 2] as const) {
    const labels: DsldLabel[] = []
    for (const phrase of barcodeSearchPhrases(code)) {
      const ids = await searchLabelIds(fetchImpl, phrase, status)
      for (const id of ids) {
        if (seen.has(id)) continue
        seen.add(id)
        if (seen.size > 8) break
        const label = await dsldJson<DsldLabel>(fetchImpl, `${DSLD_BASE}/label/${encodeURIComponent(id)}`)
        if (upcMatches(code, label.upcSku)) labels.push(label)
      }
      if (labels.length > 0) break
    }
    const best = pickMatchingLabel(code, labels)
    const match = best ? matchFromLabel(best) : null
    if (match) return match
  }
  return null
}

export type SupplementBarcodeResult =
  | { status: 'found'; match: SupplementMatch }
  | { status: 'not_found' }

/** Same-origin lookup. A valid code with no DSLD label is not_found, not an error. */
export async function fetchSupplementBarcode(raw: string): Promise<SupplementBarcodeResult> {
  const code = normalizeProductBarcode(raw)
  if (!code) throw new InvalidBarcodeError()
  let res: Response
  try {
    res = await fetch(`/api/supplement-barcode?code=${encodeURIComponent(code)}`)
  } catch {
    throw new SupplementLookupError()
  }
  if (res.status === 400) throw new InvalidBarcodeError()
  if (!res.ok) throw new SupplementLookupError()
  let json: { found?: boolean; name?: unknown; labelServing?: unknown }
  try {
    json = (await res.json()) as { found?: boolean; name?: unknown; labelServing?: unknown }
  } catch {
    throw new SupplementLookupError()
  }
  const name = typeof json.name === 'string' ? json.name.trim() : ''
  if (!json.found || !name) return { status: 'not_found' }
  const labelServing = typeof json.labelServing === 'string' ? json.labelServing.trim() : ''
  return {
    status: 'found',
    match: labelServing ? { name, labelServing } : { name },
  }
}
