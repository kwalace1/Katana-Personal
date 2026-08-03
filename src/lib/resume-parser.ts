/**
 * Lightweight client-side resume parser.
 *
 * Goals:
 *   - Pull the raw text out of a PDF / TXT resume in the browser
 *   - Best-effort extraction of name, email, phone, location, LinkedIn, skills
 *   - Never throw — callers degrade gracefully when fields are missing
 *
 * .doc / .docx aren't supported (would require `mammoth` or a server-side
 * conversion); we return `unsupported: true` and let the UI ask the user
 * to type the fields manually.
 */

import * as pdfjsLib from 'pdfjs-dist'
// Vite resolves `?url` to a static asset URL the worker can be loaded from.
// `?worker&url` would also work, but the plain ?url form is what pdfjs v5 expects.
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
}

export interface ParsedResume {
  rawText: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  location: string | null
  linkedin: string | null
  skills: string[]
  /** Experience bucket for matching: "0-2" | "2-5" | "5-10" | "10+" */
  experience?: string
  education?: string
  certifications?: string
  position?: string
  unsupported?: boolean
  error?: string
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+/i
// "Austin, TX" / "Austin, TX 78701" / "Cheverly, MD"
const CITY_STATE_RE = /\b([A-Z][A-Za-z .'-]+),\s*([A-Z]{2})(?:\s+\d{5})?\b/

/** State name to abbreviation table (a small subset is fine; we only need to
 *  recognize that "Maryland" alone is a US state to skip false positives). */
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
])

/** Headers we use to chunk out a "Skills" section. */
const SECTION_HEADERS = [
  'professional summary', 'summary',
  'professional experience', 'experience', 'work experience', 'employment',
  'education', 'education & certifications', 'certifications',
  'projects', 'awards', 'publications', 'references',
  'technical skills', 'skills', 'core competencies', 'languages & frameworks',
]

/** Parse resume bytes (e.g. downloaded from storage on demand). */
export async function parseResumeFromArrayBuffer(
  buffer: ArrayBuffer,
  fileName = 'resume.pdf',
): Promise<ParsedResume> {
  const type = fileName.toLowerCase().endsWith('.txt') ? 'text/plain' : 'application/pdf'
  const file = new File([buffer], fileName, { type })
  return parseResumeFile(file)
}

export async function parseResumeFile(file: File): Promise<ParsedResume> {
  const empty: ParsedResume = {
    rawText: '',
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    location: null,
    linkedin: null,
    skills: [],
  }

  const name = file.name.toLowerCase()

  try {
    let text = ''
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      text = await extractPdfText(file)
    } else if (name.endsWith('.txt') || file.type === 'text/plain') {
      text = await file.text()
    } else if (name.endsWith('.doc') || name.endsWith('.docx')) {
      return {
        ...empty,
        unsupported: true,
        error: 'Word documents (.doc/.docx) cannot be parsed in the browser. Save as PDF and re-upload, or enter the contact fields manually.',
      }
    } else {
      // Last-ditch effort: try as text. Worst case rawText is garbage and we
      // fall through with no extracted fields.
      text = await file.text()
    }

    return extractFields(text)
  } catch (err) {
    console.error('Resume parsing failed:', err)
    return {
      ...empty,
      error: err instanceof Error ? err.message : 'Unable to parse resume',
    }
  }
}

async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) })
  const pdf = await loadingTask.promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // pdfjs text items expose `.str` and `.hasEOL`. Reconstruct lines so the
    // line-by-line heuristics below (name on first line, etc.) work.
    let line = ''
    const lines: string[] = []
    for (const item of content.items as any[]) {
      const piece = (item.str ?? '') as string
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

export function extractFields(rawText: string): ParsedResume {
  const text = rawText.replace(/\r\n?/g, '\n')
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  const email = (text.match(EMAIL_RE)?.[0] ?? '').trim() || null
  const phone = normalizePhone(text.match(PHONE_RE)?.[0])
  const linkedinRaw = text.match(LINKEDIN_RE)?.[0] ?? null
  const linkedin = linkedinRaw
    ? (linkedinRaw.startsWith('http') ? linkedinRaw : `https://${linkedinRaw}`)
    : null

  const location = extractLocation(lines)
  const { firstName, lastName } = extractName(lines, email)
  const skills = extractSkills(lines)
  const experienceYears = estimateExperienceYears(text, lines)
  const experience = experienceYearsToBucket(experienceYears)
  const education = extractEducation(lines) ?? ''
  const certifications = extractCertifications(lines)
  const position = extractTargetPosition(lines)

  return {
    rawText: text,
    firstName,
    lastName,
    email,
    phone,
    location,
    linkedin,
    skills,
    experience,
    education,
    certifications: certifications || undefined,
    position: position || undefined,
  }
}

/** Map estimated years of experience to Katana matching buckets. */
export function experienceYearsToBucket(years: number | null): string {
  if (years == null || years < 0) return ''
  if (years < 2) return '0-2'
  if (years < 5) return '2-5'
  if (years < 10) return '5-10'
  return '10+'
}

function estimateExperienceYears(text: string, lines: string[]): number | null {
  const explicit = text.match(/(\d{1,2})\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)/i)
  if (explicit) {
    const n = parseInt(explicit[1], 10)
    if (!Number.isNaN(n)) return n
  }

  const lowered = lines.map((l) => l.toLowerCase())
  const expIdx = lowered.findIndex((l) =>
    ['professional experience', 'experience', 'work experience', 'employment'].includes(l),
  )
  const window = expIdx >= 0 ? lines.slice(expIdx, expIdx + 40).join('\n') : text
  const ranges = [...window.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => parseInt(m[0], 10))
  if (ranges.length >= 2) {
    const min = Math.min(...ranges)
    const max = Math.max(...ranges)
    const span = max - min
    if (span >= 0 && span <= 45) return Math.max(1, span)
  }

  return null
}

function extractEducation(lines: string[]): string | null {
  const lowered = lines.map((l) => l.toLowerCase())
  const eduIdx = lowered.findIndex((l) =>
    l === 'education' || l.startsWith('education ') || l === 'education & certifications',
  )
  const search = eduIdx >= 0 ? lines.slice(eduIdx, eduIdx + 12).join(' ') : lines.slice(0, 30).join(' ')
  const text = search.toLowerCase()

  if (/\b(ph\.?d|doctorate)\b/.test(text)) return "PhD/Doctorate"
  if (/\b(master'?s?|m\.?s\.?|m\.?a\.?|mba)\b/.test(text)) return "Master's Degree"
  if (/\b(bachelor'?s?|b\.?s\.?|b\.?a\.?|b\.?eng)\b/.test(text)) return "Bachelor's Degree"
  if (/\b(associate|a\.?a\.?|a\.?s\.?)\b/.test(text)) return 'Associate Degree'
  if (/\bboot\s?camp\b/.test(text)) return 'Coding Bootcamp'
  if (/\bhigh\s+school\b/.test(text)) return 'High School'

  return null
}

function extractCertifications(lines: string[]): string {
  const lowered = lines.map((l) => l.toLowerCase())
  const certIdx = lowered.findIndex((l) => l === 'certifications' || l.includes('certification'))
  if (certIdx === -1) return ''

  const collected: string[] = []
  for (let i = certIdx + 1; i < lines.length; i++) {
    const lower = lowered[i]
    if (SECTION_HEADERS.includes(lower)) break
    collected.push(lines[i])
    if (collected.length > 8) break
  }

  return collected
    .join(', ')
    .split(/[,;|·•]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && t.length < 60)
    .slice(0, 10)
    .join(', ')
}

function extractTargetPosition(lines: string[]): string | null {
  const lowered = lines.map((l) => l.toLowerCase())
  const sumIdx = lowered.findIndex((l) => l === 'professional summary' || l === 'summary')
  if (sumIdx >= 0 && lines[sumIdx + 1]) {
    const line = lines[sumIdx + 1].slice(0, 80)
    if (line.length > 8 && !/[@\d]/.test(line)) return line
  }
  return null
}

function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw.trim()
}

function extractLocation(lines: string[]): string | null {
  // Scan the top of the document first — most resumes put the location on
  // line 2 or 3, near phone/email.
  const window = lines.slice(0, 8).join('\n') + '\n' + lines.join('\n')
  const m = window.match(CITY_STATE_RE)
  if (!m) return null
  const city = m[1].trim()
  const state = m[2].trim().toUpperCase()
  if (!US_STATES.has(state)) return null
  return `${city}, ${state}`
}

function extractName(lines: string[], email: string | null): {
  firstName: string | null
  lastName: string | null
} {
  // Strategy: walk the first ~5 lines. The name is typically the first line
  // that (a) has 2-4 words, (b) contains no digits / @ / URL bits, and
  // (c) isn't a section header.
  for (const line of lines.slice(0, 5)) {
    if (!line) continue
    if (/[@\d]/.test(line)) continue
    if (/https?:|www\.|\.com\b/i.test(line)) continue
    if (SECTION_HEADERS.includes(line.toLowerCase())) continue

    const words = line
      .replace(/[,;|]/g, ' ')
      .split(/\s+/)
      .filter((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w))

    if (words.length < 2 || words.length > 5) continue

    // Drop single-letter middle initials like "M."
    const meaningful = words.filter((w) => w.replace(/\./g, '').length > 1)
    if (meaningful.length < 2) continue

    return {
      firstName: titleCase(meaningful[0]),
      lastName: titleCase(meaningful[meaningful.length - 1]),
    }
  }

  // Fallback: derive a guess from the email local part (jane.doe -> Jane Doe)
  if (email) {
    const local = email.split('@')[0]
    const parts = local.split(/[._-]+/).filter(Boolean)
    if (parts.length >= 2) {
      return {
        firstName: titleCase(parts[0]),
        lastName: titleCase(parts[parts.length - 1]),
      }
    }
  }

  return { firstName: null, lastName: null }
}

function titleCase(word: string): string {
  if (!word) return word
  // Preserve dotted initials like "M."
  if (/\.$/.test(word) && word.length <= 3) return word.toUpperCase()
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

function extractSkills(lines: string[]): string[] {
  // Find a "Skills" header, then concatenate following lines until the next
  // recognized header. Split on commas, semicolons, bullets, and pipes.
  const lowered = lines.map((l) => l.toLowerCase())
  const skillsIdx = lowered.findIndex((l) =>
    l === 'skills' || l === 'technical skills' || l === 'core competencies' || l === 'languages & frameworks'
  )
  if (skillsIdx === -1) return []

  const collected: string[] = []
  for (let i = skillsIdx + 1; i < lines.length; i++) {
    const lower = lowered[i]
    if (SECTION_HEADERS.includes(lower)) break
    collected.push(lines[i])
    if (collected.length > 12) break // safety net for poorly structured PDFs
  }

  const tokens = collected
    .join(' ')
    .replace(/^([A-Z][A-Za-z &/]+):\s*/gm, '') // strip "Languages & Frameworks:" sub-labels
    .split(/[,;|·•\u2022]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && t.length <= 40 && !/^\d+$/.test(t))

  return Array.from(new Set(tokens)).slice(0, 30)
}
