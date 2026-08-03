/**
 * Client-side text extraction for Automation document indexing.
 * Supports PDF, TXT, CSV, JSON, DOCX, XLSX. Images/unsupported → status flag.
 */

import * as XLSX from 'xlsx'

export type ExtractStatus = 'pending' | 'ready' | 'unsupported' | 'failed'

export interface ExtractResult {
  status: ExtractStatus
  text: string
  error?: string
}

const MAX_CHARS = 500_000

function truncate(text: string): string {
  const cleaned = text.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim()
  if (cleaned.length <= MAX_CHARS) return cleaned
  return `${cleaned.slice(0, MAX_CHARS)}\n…[truncated]`
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  if (typeof window !== 'undefined') {
    const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
  }
  const buf = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) })
  const pdf = await loadingTask.promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let line = ''
    const lines: string[] = []
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      const piece = item.str ?? ''
      line += (line && piece && !line.endsWith(' ') && !piece.startsWith(' ') ? ' ' : '') + piece
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

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const buf = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buf })
  return result.value || ''
}

function extractSpreadsheetText(_file: File, buffer: ArrayBuffer): string {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const parts: string[] = []
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const csv = XLSX.utils.sheet_to_csv(sheet)
    if (csv.trim()) {
      parts.push(`## Sheet: ${name}\n${csv.trim()}`)
    }
  }
  return parts.join('\n\n')
}

function extOf(file: File): string {
  return (file.name.split('.').pop() || '').toLowerCase()
}

export function isExtractableFile(file: File): boolean {
  const ext = extOf(file)
  return [
    'pdf', 'txt', 'csv', 'json', 'docx', 'xls', 'xlsx', 'md', 'markdown',
  ].includes(ext)
}

/**
 * Extract searchable text from an uploaded file. Never throws.
 */
export async function extractDocumentText(file: File): Promise<ExtractResult> {
  const ext = extOf(file)
  const mime = file.type || ''

  try {
    if (ext === 'pdf' || mime === 'application/pdf') {
      const text = truncate(await extractPdfText(file))
      if (!text) {
        return { status: 'failed', text: '', error: 'No extractable text in PDF (may be scanned)' }
      }
      return { status: 'ready', text }
    }

    if (
      ext === 'txt' ||
      ext === 'md' ||
      ext === 'markdown' ||
      ext === 'csv' ||
      ext === 'json' ||
      mime.startsWith('text/') ||
      mime === 'application/json'
    ) {
      const text = truncate(await file.text())
      if (!text) {
        return { status: 'failed', text: '', error: 'File is empty' }
      }
      return { status: 'ready', text }
    }

    if (
      ext === 'docx' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const text = truncate(await extractDocxText(file))
      if (!text) {
        return { status: 'failed', text: '', error: 'No extractable text in Word document' }
      }
      return { status: 'ready', text }
    }

    if (
      ext === 'xls' ||
      ext === 'xlsx' ||
      mime.includes('spreadsheet') ||
      mime === 'application/vnd.ms-excel'
    ) {
      const buf = await file.arrayBuffer()
      const text = truncate(extractSpreadsheetText(file, buf))
      if (!text) {
        return { status: 'failed', text: '', error: 'Spreadsheet has no readable cells' }
      }
      return { status: 'ready', text }
    }

    if (ext === 'doc') {
      return {
        status: 'unsupported',
        text: '',
        error: 'Legacy .doc is not supported — upload .docx or PDF instead',
      }
    }

    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'zip', 'ppt', 'pptx'].includes(ext)) {
      return {
        status: 'unsupported',
        text: '',
        error: `No text extraction for .${ext} files (stored for download only)`,
      }
    }

    // Last resort: try as UTF-8 text
    const fallback = truncate(await file.text())
    if (fallback && !/[\u0000-\u0008]/.test(fallback.slice(0, 200))) {
      return { status: 'ready', text: fallback }
    }

    return {
      status: 'unsupported',
      text: '',
      error: `Cannot extract text from .${ext || 'unknown'}`,
    }
  } catch (err) {
    return {
      status: 'failed',
      text: '',
      error: err instanceof Error ? err.message : 'Extraction failed',
    }
  }
}
