/**
 * Generate blind-review resume PDFs: PII and demographic identifiers removed.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { AnonymousResumeProfile } from './anonymous-resume-profile'
import {
  buildAnonymousProfileFromParsed,
  collectPiiTokensFromParsed,
  parseCoverLetterProfile,
  redactResumeForBlindReview,
} from './anonymous-resume-profile'
import {
  applicationBlindResumeStoragePath,
  applicationResumeStoragePath,
  updateApplicationResumeProfile,
  uploadApplicationResume,
} from './recruitment-db'
import { parseResumeFromArrayBuffer, type ParsedResume } from './resume-parser'
import { supabase } from './supabase'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
}

const REDACTED = '[REDACTED]'

export function triggerPdfDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Build a clean PDF from redacted plain text (fallback when no stored file). */
export async function createAnonymizedPdfFromText(
  redactedText: string,
  headerLabel: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontSize = 10
  const lineHeight = fontSize * 1.35
  const margin = 50
  const pageWidth = 612
  const pageHeight = 792
  const maxWidth = pageWidth - margin * 2

  let page = pdf.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const drawLine = (text: string, isBold = false) => {
    const f = isBold ? bold : font
    const words = text.split(/\s+/)
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      const w = f.widthOfTextAtSize(test, fontSize)
      if (w > maxWidth && line) {
        if (y < margin + lineHeight) {
          page = pdf.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
        }
        page.drawText(line, { x: margin, y, size: fontSize, font: f, color: rgb(0.1, 0.1, 0.1) })
        y -= lineHeight
        line = word
      } else {
        line = test
      }
    }
    if (line) {
      if (y < margin + lineHeight) {
        page = pdf.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }
      page.drawText(line, { x: margin, y, size: fontSize, font: f, color: rgb(0.1, 0.1, 0.1) })
      y -= lineHeight
    }
  }

  drawLine('Blind Review Copy', true)
  drawLine(`Applicant ${headerLabel}`, false)
  y -= lineHeight * 0.5

  const sectionHeader =
    /^(professional summary|technical skills|professional experience|projects|education|certifications|additional information|skills|experience|work experience)$/i

  const lines = redactedText.split(/\n/)
  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed) {
      y -= lineHeight * 0.35
      continue
    }
    const isSection = sectionHeader.test(trimmed.replace(/:$/, ''))
    drawLine(trimmed, isSection)
    y -= lineHeight * (isSection ? 0.15 : 0.05)
  }

  return pdf.save()
}

function shouldRedactTextItem(str: string, piiTokens: string[]): boolean {
  const t = str.trim()
  if (!t || t.length < 2) return false

  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(t)) return true
  if (/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(t)) return true
  if (/https?:\/\//i.test(t) || /linkedin\.com/i.test(t)) return true

  const lower = t.toLowerCase()
  if (
    /\b(male|female|non-?binary|gender\s*:)\b/i.test(t) ||
    /\b(age\s*:|years?\s*old|date\s*of\s*birth|d\.?o\.?b\.?)\b/i.test(t) ||
    /\b(ethnicity|race\/ethnicity|hispanic|latino|african\s*american|asian\s*american|native\s*american|pacific\s*islander)\b/i.test(t) ||
    /\b(he\/him|she\/her|they\/them)\b/i.test(t) ||
    /\b(linkedin|github|portfolio)\b/i.test(t) ||
    /\b[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}\b/.test(t) ||
    /\b(graduated|class\s+of)\s*(19|20)\d{2}\b/i.test(t)
  ) {
    return true
  }

  for (const token of piiTokens) {
    if (token.length < 2) continue
    if (lower === token.toLowerCase()) return true
    if (token.length >= 4 && lower.includes(token.toLowerCase())) return true
  }

  return false
}

/** Overlay white boxes on PII text in the original PDF layout. */
export async function redactPdfBytes(
  pdfBytes: ArrayBuffer,
  piiTokens: string[],
): Promise<Uint8Array> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) })
  const pdfJs = await loadingTask.promise
  const pdfLib = await PDFDocument.load(pdfBytes)
  const pages = pdfLib.getPages()
  const pageCount = Math.min(pdfJs.numPages, pages.length)

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const pdfJsPage = await pdfJs.getPage(pageNum)
    const content = await pdfJsPage.getTextContent()
    const libPage = pages[pageNum - 1]
    if (!libPage) continue
    const pageHeight = libPage.getHeight()

    for (const item of content.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>) {
      const str = (item.str ?? '').trim()
      if (!str || !shouldRedactTextItem(str, piiTokens)) continue

      const transform = item.transform ?? [1, 0, 0, 1, 0, 0]
      const x = transform[4] ?? 0
      const y = transform[5] ?? 0
      const fontHeight = Math.abs(transform[3] ?? 12) || 12
      const width = item.width ?? fontHeight * str.length * 0.45
      const boxHeight = fontHeight * 1.2

      const rectY = pageHeight - y - boxHeight

      libPage.drawRectangle({
        x: x - 1,
        y: rectY,
        width: width + 4,
        height: boxHeight + 2,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      })
      libPage.drawText(REDACTED, {
        x,
        y: rectY + 1,
        size: Math.min(fontHeight, 9),
        color: rgb(0.45, 0.45, 0.45),
      })
    }
  }

  return pdfLib.save()
}

/** Redact a stored PDF; on failure build a text-based anonymized PDF instead. */
export async function buildAnonymizedPdfBytes(
  raw: ArrayBuffer,
  fileName: string,
  options?: { piiTokens?: string[]; fallbackText?: string; headerLabel?: string },
): Promise<Uint8Array | null> {
  const parsed = await parseResumeFromArrayBuffer(raw, fileName)
  const tokens = options?.piiTokens ?? collectPiiTokensFromParsed(parsed)
  const fallbackText =
    options?.fallbackText?.trim() ||
    redactResumeForBlindReview(parsed.rawText, { piiTokens: tokens })

  try {
    return await redactPdfBytes(raw, tokens)
  } catch (err) {
    console.warn('[anonymized-resume-pdf] Layout redaction failed, using text PDF:', err)
    if (!fallbackText) return null
    return createAnonymizedPdfFromText(
      fallbackText,
      options?.headerLabel ?? 'Anonymous Applicant',
    )
  }
}

/**
 * Parse an uploaded resume, redact PII/demographics, and store a blind PDF copy.
 * Original file remains at applications/{id}/resume.{ext}.
 */
export async function generateAndStoreBlindedResumePdf(
  applicationId: string,
  file: File,
): Promise<string | null> {
  const raw = await file.arrayBuffer()
  const parsed = await parseResumeFromArrayBuffer(raw, file.name)
  const piiTokens = collectPiiTokensFromParsed(parsed)
  const fallbackText = redactResumeForBlindReview(parsed.rawText, { piiTokens })
  const blindBytes = await buildAnonymizedPdfBytes(raw, file.name, {
    piiTokens,
    fallbackText,
    headerLabel: applicationId,
  })
  if (!blindBytes) return null

  const path = applicationBlindResumeStoragePath(applicationId)

  const { error } = await supabase.storage.from('application-resumes').upload(path, blindBytes, {
    upsert: true,
    contentType: 'application/pdf',
  })

  if (error) {
    console.warn('[anonymized-resume-pdf] Blind PDF upload failed:', error.message)
    return null
  }
  return path
}

export async function fetchResumeBytesFromStorage(storagePath: string): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage
    .from('application-resumes')
    .download(storagePath)

  if (error || !data) {
    return null
  }
  return data.arrayBuffer()
}

export function resolveResumeStoragePath(
  profile: AnonymousResumeProfile | null | undefined,
  resumeUrl: string | null | undefined,
  applicationId?: string,
): string | null {
  if (profile?.storagePath?.trim()) return profile.storagePath.trim()
  if (resumeUrl?.trim()) {
    const trimmed = resumeUrl.trim()
    const marker = '/application-resumes/'
    const idx = trimmed.indexOf(marker)
    if (idx >= 0) return trimmed.slice(idx + marker.length).split('?')[0]
    if (!trimmed.startsWith('http')) return trimmed.replace(/^\/+/, '')
  }
  if (applicationId) {
    return applicationResumeStoragePath(applicationId)
  }
  return null
}

/** Try common storage locations for this application's resume. */
export async function discoverResumeStoragePath(
  applicationId: string,
  profile: AnonymousResumeProfile | null | undefined,
  resumeUrl: string | null | undefined,
): Promise<string | null> {
  const explicit = resolveResumeStoragePath(profile, resumeUrl)
  const candidates = new Set<string>()
  if (explicit) candidates.add(explicit)
  candidates.add(applicationResumeStoragePath(applicationId))
  candidates.add(applicationResumeStoragePath(applicationId, 'resume.PDF'))

  for (const path of candidates) {
    const bytes = await fetchResumeBytesFromStorage(path)
    if (bytes) return path
  }

  const { data: listed } = await supabase.storage
    .from('application-resumes')
    .list(`applications/${applicationId}`)
  const file = listed?.find((f) => f.name && !f.name.startsWith('.'))
  if (file?.name) {
    const path = `applications/${applicationId}/${file.name}`
    const bytes = await fetchResumeBytesFromStorage(path)
    if (bytes) return path
  }

  return null
}

async function buildAnonymizedPdfFromStorage(
  storagePath: string,
  fileName: string,
  fallbackText?: string,
  headerLabel?: string,
): Promise<Uint8Array | null> {
  const raw = await fetchResumeBytesFromStorage(storagePath)
  if (!raw) return null

  return buildAnonymizedPdfBytes(raw, fileName, { fallbackText, headerLabel })
}

function resolveRedactedText(
  profile: AnonymousResumeProfile | null | undefined,
  coverLetter: string,
): string {
  if (profile?.redactedFullText?.trim()) return profile.redactedFullText.trim()
  if (profile?.summary?.trim()) return profile.summary.trim()

  const fromLetter = parseCoverLetterProfile(coverLetter)
  if (fromLetter.skills || fromLetter.experience || fromLetter.education) {
    const parts = [
      fromLetter.skills && `Skills: ${fromLetter.skills}`,
      fromLetter.experience && `Experience: ${fromLetter.experience}`,
      fromLetter.education && `Education: ${fromLetter.education}`,
      fromLetter.certifications && `Certifications: ${fromLetter.certifications}`,
    ].filter(Boolean)
    return redactResumeForBlindReview(parts.join('\n'), { piiTokens: profile?.piiTokens })
  }

  const letter = coverLetter?.trim() ?? ''
  if (letter.length > 80 && !letter.toLowerCase().startsWith('dear ')) {
    return redactResumeForBlindReview(letter, { piiTokens: profile?.piiTokens })
  }

  return ''
}

function pickResumeFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.txt,application/pdf,text/plain'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

export type ResumeDownloadOptions = {
  applicationId: string
  anonymousId: string
  isRevealed: boolean
  resumeProfile: AnonymousResumeProfile | null | undefined
  resumeUrl?: string | null
  resumeFileName?: string | null
  coverLetter?: string
  resumeFile?: File | null
  /** When true, prompt HR to attach a PDF if nothing is stored yet. */
  allowBackfillUpload?: boolean
}

export async function downloadResumeForApplication(opts: ResumeDownloadOptions): Promise<void> {
  const filenameBase = opts.anonymousId || opts.applicationId
  const coverLetter = opts.coverLetter ?? ''
  const redactedText = resolveRedactedText(opts.resumeProfile, coverLetter)

  if (opts.isRevealed) {
    const path = await discoverResumeStoragePath(
      opts.applicationId,
      opts.resumeProfile,
      opts.resumeUrl,
    )
    if (path) {
      const bytes = await fetchResumeBytesFromStorage(path)
      if (bytes) {
        triggerPdfDownload(new Uint8Array(bytes), `${filenameBase}-resume-original.pdf`)
        return
      }
    }
    if (opts.resumeUrl?.startsWith('http')) {
      window.open(opts.resumeUrl, '_blank', 'noopener,noreferrer')
      return
    }
  }

  const blindPath =
    opts.resumeProfile?.blindStoragePath?.trim() ||
    applicationBlindResumeStoragePath(opts.applicationId)
  const storedBlind = await fetchResumeBytesFromStorage(blindPath)
  if (storedBlind) {
    triggerPdfDownload(new Uint8Array(storedBlind), `${filenameBase}-resume-anonymized.pdf`)
    return
  }

  let pdfBytes: Uint8Array | null = null

  const tryFile = async (file: File) => {
    const raw = await file.arrayBuffer()
    const parsed = await parseResumeFromArrayBuffer(raw, file.name)
    const tokens = collectPiiTokensFromParsed(parsed)
    const redacted = await buildAnonymizedPdfBytes(raw, file.name, {
      piiTokens: tokens,
      fallbackText: redactedText || redactResumeForBlindReview(parsed.rawText, { piiTokens: tokens }),
      headerLabel: opts.anonymousId,
    })
    const profile = enrichAnonymousProfileFromParsed(parsed, {
      storagePath: applicationResumeStoragePath(opts.applicationId, file.name),
    })
    void uploadApplicationResume(opts.applicationId, file)
    void updateApplicationResumeProfile(opts.applicationId, profile)
    return redacted
  }

  if (!pdfBytes && opts.resumeFile) {
    pdfBytes = await tryFile(opts.resumeFile)
  }

  if (!pdfBytes) {
    const storagePath = await discoverResumeStoragePath(
      opts.applicationId,
      opts.resumeProfile,
      opts.resumeUrl,
    )
    if (storagePath) {
      pdfBytes = await buildAnonymizedPdfFromStorage(
        storagePath,
        opts.resumeFileName ?? 'resume.pdf',
        redactedText,
        opts.anonymousId,
      )
    }
  }

  // Text PDF fallback — preserves content when layout redaction or storage is unavailable.
  if (!pdfBytes && redactedText) {
    try {
      pdfBytes = await createAnonymizedPdfFromText(redactedText, opts.anonymousId)
    } catch (err) {
      console.warn('[anonymized-resume-pdf] Text PDF generation failed:', err)
    }
  }

  if (!pdfBytes && opts.allowBackfillUpload !== false) {
    const attach = window.confirm(
      'No resume file is stored for this application yet.\n\n' +
        'Click OK to select the candidate\'s PDF resume from your computer. ' +
        'It will be parsed, anonymized, and saved for future downloads.',
    )
    if (attach) {
      const file = await pickResumeFile()
      if (file) {
        pdfBytes = await tryFile(file)
      }
    }
  }

  if (!pdfBytes) {
    alert(
      'Could not build an anonymized resume.\n\n' +
        '• New applications: apply on Careers with a PDF attached, or use Add Candidate with resume upload.\n' +
        '• Existing applications: use the prompt above to attach the PDF once.',
    )
    return
  }

  triggerPdfDownload(pdfBytes, `${filenameBase}-resume-anonymized.pdf`)
}

export function enrichAnonymousProfileFromParsed(
  parsed: ParsedResume,
  overrides?: Partial<AnonymousResumeProfile>,
): AnonymousResumeProfile {
  const piiTokens = collectPiiTokensFromParsed(parsed)
  const redactedFullText = redactResumeForBlindReview(parsed.rawText, { piiTokens })
  return {
    ...buildAnonymousProfileFromParsed(parsed, overrides),
    redactedFullText,
    piiTokens,
  }
}
