/**
 * Bank statement CSV / PDF text parsing for Katana Finance imports.
 */

import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
}

export interface ParsedStatementRow {
  transaction_date: string
  description: string
  amount: number
  raw_line?: string
}

export interface StatementParseResult {
  rows: ParsedStatementRow[]
  warnings: string[]
  format: 'csv' | 'pdf' | 'unknown'
}

const DATE_PATTERNS = [
  /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
  /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // MM/DD/YY
  /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // MM-DD-YYYY
]

function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  for (const pattern of DATE_PATTERNS) {
    const m = s.match(pattern)
    if (!m) continue
    if (m[1].length === 4) {
      return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    }
    const month = m[1].padStart(2, '0')
    const day = m[2].padStart(2, '0')
    let year = m[3]
    if (year.length === 2) {
      const y = parseInt(year, 10)
      year = String(y >= 70 ? 1900 + y : 2000 + y)
    }
    return `${year}-${month}-${day}`
  }
  return null
}

function parseAmount(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/[$,]/g, '')
    .replace(/\(([^)]+)\)/, '-$1')
  if (!cleaned || cleaned === '-') return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  result.push(current.trim())
  return result
}

function detectCsvColumns(header: string[]): {
  dateIdx: number
  descIdx: number
  amountIdx: number | null
  debitIdx: number | null
  creditIdx: number | null
} | null {
  const lower = header.map((h) => h.toLowerCase().replace(/[^a-z0-9 ]/g, ''))
  const dateIdx = lower.findIndex((h) =>
    h.includes('date') || h.includes('posted') || h === 'trans date',
  )
  const descIdx = lower.findIndex((h) =>
    h.includes('description') || h.includes('memo') || h.includes('payee') || h.includes('name'),
  )
  const amountIdx = lower.findIndex((h) => h === 'amount' || h.includes('net amount'))
  const debitIdx = lower.findIndex((h) => h.includes('debit') || h === 'withdrawal')
  const creditIdx = lower.findIndex((h) => h.includes('credit') || h === 'deposit')

  if (dateIdx < 0) return null
  const desc = descIdx >= 0 ? descIdx : dateIdx + 1
  if (amountIdx >= 0) return { dateIdx, descIdx: desc, amountIdx, debitIdx: null, creditIdx: null }
  if (debitIdx >= 0 || creditIdx >= 0) {
    return { dateIdx, descIdx: desc, amountIdx: null, debitIdx: debitIdx >= 0 ? debitIdx : null, creditIdx: creditIdx >= 0 ? creditIdx : null }
  }
  // Fallback: date, description, amount as last column
  if (header.length >= 3) {
    return { dateIdx, descIdx: desc, amountIdx: header.length - 1, debitIdx: null, creditIdx: null }
  }
  return null
}

export function parseStatementCsv(text: string): StatementParseResult {
  const warnings: string[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim())
  if (lines.length < 2) {
    return { rows: [], warnings: ['CSV file appears empty or has no data rows.'], format: 'csv' }
  }

  const header = splitCsvLine(lines[0])
  const cols = detectCsvColumns(header)
  if (!cols) {
    return {
      rows: [],
      warnings: ['Could not detect date and amount columns. Expected headers like Date, Description, Amount.'],
      format: 'csv',
    }
  }

  const rows: ParsedStatementRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i])
    if (parts.every((p) => !p.trim())) continue

    const date = normalizeDate(parts[cols.dateIdx] ?? '')
    if (!date) continue

    const description = (parts[cols.descIdx] ?? parts[cols.dateIdx + 1] ?? 'Imported transaction').trim()
    let amount: number | null = null

    if (cols.amountIdx != null) {
      amount = parseAmount(parts[cols.amountIdx] ?? '')
    } else {
      const debit = cols.debitIdx != null ? parseAmount(parts[cols.debitIdx] ?? '') : null
      const credit = cols.creditIdx != null ? parseAmount(parts[cols.creditIdx] ?? '') : null
      if (credit != null && credit !== 0) amount = Math.abs(credit)
      else if (debit != null && debit !== 0) amount = -Math.abs(debit)
    }

    if (amount == null || amount === 0) continue

    rows.push({ transaction_date: date, description, amount, raw_line: lines[i] })
  }

  if (rows.length === 0) {
    warnings.push('No valid transaction rows found in CSV.')
  }

  return { rows, warnings, format: 'csv' }
}

async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) })
  const pdf = await loadingTask.promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let line = ''
    const lines: string[] = []
    for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
      const piece = item.str ?? ''
      line += (line && piece && !line.endsWith(' ') ? ' ' : '') + piece
      if (item.hasEOL) {
        lines.push(line.trim())
        line = ''
      }
    }
    if (line.trim()) lines.push(line.trim())
    pages.push(lines.filter(Boolean).join('\n'))
  }
  return pages.join('\n\n')
}

/** Best-effort PDF line parsing: date + description + signed amount at end */
export function parseStatementPdfText(text: string): StatementParseResult {
  const warnings: string[] = [
    'PDF parsing is best-effort. Review imported rows before categorizing.',
  ]
  const rows: ParsedStatementRow[] = []
  const lines = text.split('\n')

  const linePattern =
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const m = trimmed.match(linePattern)
    if (!m) continue
    const date = normalizeDate(m[1])
    const amount = parseAmount(m[3])
    if (!date || amount == null) continue
    rows.push({
      transaction_date: date,
      description: m[2].trim(),
      amount,
      raw_line: trimmed,
    })
  }

  if (rows.length === 0) {
    warnings.push('No transaction lines detected in PDF. Try exporting CSV from your bank instead.')
  }

  return { rows, warnings, format: 'pdf' }
}

export async function parseStatementFile(file: File): Promise<StatementParseResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'text/plain') {
    const text = await file.text()
    return parseStatementCsv(text)
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const text = await extractPdfText(file)
    return parseStatementPdfText(text)
  }
  return {
    rows: [],
    warnings: ['Unsupported file type. Upload CSV or PDF bank statements.'],
    format: 'unknown',
  }
}

export function dedupeParsedRows(
  rows: ParsedStatementRow[],
  existing: { transaction_date: string; amount: number; description: string }[],
): { toImport: ParsedStatementRow[]; skipped: number } {
  const key = (d: string, a: number, desc: string) =>
    `${d}|${a.toFixed(2)}|${desc.trim().toLowerCase().slice(0, 40)}`

  const existingKeys = new Set(
    existing.map((e) => key(e.transaction_date, Number(e.amount), e.description)),
  )

  const toImport: ParsedStatementRow[] = []
  const seen = new Set<string>()
  let skipped = 0

  for (const row of rows) {
    const k = key(row.transaction_date, row.amount, row.description)
    if (existingKeys.has(k) || seen.has(k)) {
      skipped += 1
      continue
    }
    seen.add(k)
    toImport.push(row)
  }

  return { toImport, skipped }
}
