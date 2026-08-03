/**
 * Shared CSV / XLSX parsing for KYI and PM import flows.
 */

import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type ParsedSheet = {
  /** First row as headers (trimmed strings) */
  headers: string[]
  /** Data rows as parallel arrays aligned to headers */
  rows: string[][]
  /** Original sheet name (XLSX only) */
  sheetName?: string
}

export interface ParseFileResult {
  ok: true
  sheets: ParsedSheet[]
}
export interface ParseFileError {
  ok: false
  error: string
}

export type ParseFileOutcome = ParseFileResult | ParseFileError

function normalizeCell(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return String(v).trim()
}

/** Parse CSV text into a single sheet. */
export function parseCsvText(text: string): ParseFileOutcome {
  const trimmed = text.replace(/^\uFEFF/, '')
  if (!trimmed.trim()) {
    return { ok: false, error: 'CSV file is empty.' }
  }
  const parsed = Papa.parse<string[]>(trimmed, {
    skipEmptyLines: 'greedy',
  })
  if (parsed.errors?.length) {
    const msg = parsed.errors.map((e) => e.message || String(e.type)).join('; ')
    return { ok: false, error: `CSV parse error: ${msg}` }
  }
  const data = parsed.data as string[][]
  if (!data.length) {
    return { ok: false, error: 'CSV has no rows.' }
  }
  const headers = (data[0] ?? []).map((h) => normalizeCell(h))
  const rows = data.slice(1).map((r) => headers.map((_, i) => normalizeCell(r[i])))
  return { ok: true, sheets: [{ headers, rows }] }
}

/** Parse first sheet of an XLSX ArrayBuffer. */
export function parseXlsxArrayBuffer(buf: ArrayBuffer): ParseFileOutcome {
  try {
    const wb = XLSX.read(buf, { type: 'array' })
    const name = wb.SheetNames[0]
    if (!name) {
      return { ok: false, error: 'Workbook has no sheets.' }
    }
    const ws = wb.Sheets[name]
    const aoa = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][]
    if (!aoa.length) {
      return { ok: false, error: 'Sheet is empty.' }
    }
    const headers = (aoa[0] as unknown[]).map((c) => normalizeCell(c))
    const rows = aoa.slice(1).map((line) =>
      headers.map((_, i) => normalizeCell((line as unknown[])[i])),
    )
    return { ok: true, sheets: [{ headers, rows, sheetName: name }] }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to read Excel file.' }
  }
}

export async function parseTabularFile(file: File): Promise<ParseFileOutcome> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) {
    const text = await file.text()
    return parseCsvText(text)
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buf = await file.arrayBuffer()
    return parseXlsxArrayBuffer(buf)
  }
  return { ok: false, error: 'Unsupported format. Use .csv, .xlsx, or .xls.' }
}

/** Build a row object from header → cell map (lowercase keys). */
export function rowToRecord(headers: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((h, i) => {
    const key = (h || `col_${i}`).trim().toLowerCase().replace(/\s+/g, '_')
    out[key] = row[i] ?? ''
  })
  return out
}
