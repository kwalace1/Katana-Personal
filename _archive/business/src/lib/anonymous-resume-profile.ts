/**
 * Anonymous resume profile — professional signals without PII.
 * Used for blind screening and Katana match scoring before identity reveal.
 */

import type { ParsedResume } from './resume-parser'

/** Real identity stored sealed until recruiter reveals after interview. */
export interface SealedIdentity {
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
  linkedin?: string | null
  portfolio?: string | null
  coverLetter?: string
  resumeFileName?: string | null
  /** Tokens for PDF redaction — never exposed in blind UI. */
  piiTokens?: string[]
}

export const BLIND_FIRST_NAME = 'Anonymous'
export const BLIND_LAST_NAME = 'Candidate'
export const BLIND_EMAIL = 'sealed@katana.blind'
export const BLIND_PHONE = '[REDACTED]'
export const BLIND_LOCATION = '[REDACTED]'
export const BLIND_RESUME_FILENAME = 'resume.pdf'

export interface AnonymousResumeProfile {
  skills: string
  experience: string
  education: string
  certifications?: string
  position?: string
  /** Redacted excerpt from resume (no names, emails, phones, URLs). */
  summary?: string
  /** Full resume text after blind-review redaction (for anonymized PDF export). */
  redactedFullText?: string
  /** Tokens detected at parse time — used only for PDF redaction, never shown in UI. */
  piiTokens?: string[]
  /** Supabase storage path under application-resumes bucket (original PDF). */
  storagePath?: string
  /** Pre-generated blind PDF path (applications/{id}/resume-blind.pdf). */
  blindStoragePath?: string
  /** Real PII sealed until identity reveal. */
  sealedIdentity?: SealedIdentity
  parsedAt?: string
}

export type PiiTokenSource = {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  location?: string | null
  linkedin?: string | null
}

/** Redact contact / link PII from free text. */
export function redactPII(text: string): string {
  let redacted = text
  redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL REDACTED]')
  redacted = redacted.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE REDACTED]')
  redacted = redacted.replace(/https?:\/\/(www\.)?linkedin\.com\/[^\s]*/gi, '[LINK REDACTED]')
  redacted = redacted.replace(
    /https?:\/\/(www\.)?(twitter|facebook|instagram|github)\.com\/[^\s]*/gi,
    '[LINK REDACTED]',
  )
  redacted = redacted.replace(
    /\d+\s+[\w\s]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir)\.?\s*,?\s*[\w\s]*,?\s*[A-Z]{2}\s*\d{5}/gi,
    '[ADDRESS REDACTED]',
  )
  // City, ST in resume headers (e.g. "Camden, NJ • phone")
  redacted = redacted.replace(
    /\b[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}\b(?=\s*[•|])/g,
    '[LOCATION REDACTED]',
  )
  // Social labels without URLs (common in PDF headers: "LinkedIn • GitHub")
  redacted = redacted.replace(/\b(LinkedIn|GitHub|Portfolio|personal\s+website)\b/gi, '[LINK REDACTED]')
  return redacted
}

/** Redact graduation years and similar age proxies (keep employment date ranges). */
export function redactAgeProxies(text: string): string {
  let redacted = text
  redacted = redacted.replace(
    /\b(graduated|expected\s+graduation|class\s+of|completion)\s*:?\s*(19|20)\d{2}\b/gi,
    '$1 [REDACTED]',
  )
  redacted = redacted.replace(/\bGraduated\s+(19|20)\d{2}\b/gi, 'Graduated [REDACTED]')
  return redacted
}

/** Remove demographic and identity markers for blind review. */
export function redactDemographicMarkers(text: string): string {
  let redacted = text

  redacted = redacted.replace(
    /^\s*(gender|sex)\s*:\s*.+$/gim,
    'Gender: [REDACTED]',
  )
  redacted = redacted.replace(
    /^\s*(age|date\s*of\s*birth|d\.?o\.?b\.?)\s*:\s*.+$/gim,
    'Age/DOB: [REDACTED]',
  )
  redacted = redacted.replace(
    /^\s*(ethnicity|race|race\/ethnicity|nationality)\s*:\s*.+$/gim,
    'Ethnicity: [REDACTED]',
  )
  redacted = redacted.replace(
    /^\s*(marital\s*status|veteran\s*status|disability|religion|sexual\s*orientation|citizenship|visa\s*status)\s*:\s*.+$/gim,
    '[REDACTED]',
  )

  redacted = redacted.replace(
    /\b(male|female|non-?binary|man|woman)\b(?=\s*(,|\||\)|$|\n))/gi,
    '[REDACTED]',
  )
  redacted = redacted.replace(/\b(he\/him|she\/her|they\/them)\b/gi, '[REDACTED]')
  redacted = redacted.replace(/\b(age\s*:?\s*)\d{1,3}\b/gi, '$1[REDACTED]')
  redacted = redacted.replace(/\b\d{1,2}\s*years?\s*old\b/gi, '[AGE REDACTED]')
  redacted = redacted.replace(
    /\b(hispanic|latino|latina|african\s*american|black|asian|white|native\s*american|pacific\s*islander|middle\s*eastern)\b(?=\s*(,|\||\)|$|\n))/gi,
    '[REDACTED]',
  )

  return redacted
}

export function collectPiiTokensFromParsed(parsed: ParsedResume): string[] {
  const tokens = new Set<string>()
  const add = (v: string | null | undefined) => {
    const t = v?.trim()
    if (t && t.length > 1) tokens.add(t)
  }

  add(parsed.firstName)
  add(parsed.lastName)
  if (parsed.firstName && parsed.lastName) {
    add(`${parsed.firstName} ${parsed.lastName}`)
  }
  add(parsed.email)
  add(parsed.phone)
  add(parsed.location)
  if (parsed.linkedin) {
    add(parsed.linkedin)
    const slug = parsed.linkedin.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]
    if (slug) add(slug.replace(/-/g, ' '))
  }

  const local = parsed.email?.split('@')[0]
  if (local && local.includes('.')) {
    local.split(/[._-]+/).forEach((p) => add(p))
  }

  return Array.from(tokens)
}

export function redactKnownTokens(text: string, tokens: string[]): string {
  let out = text
  const sorted = [...tokens].sort((a, b) => b.length - a.length)
  for (const token of sorted) {
    if (token.length < 2) continue
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '[NAME REDACTED]')
  }
  return out
}

/** Full blind-review redaction pipeline for resume plain text. */
export function redactResumeForBlindReview(
  rawText: string,
  options?: { piiTokens?: string[] },
): string {
  if (!rawText?.trim()) return ''
  let text = redactPII(rawText)
  text = redactDemographicMarkers(text)
  text = redactAgeProxies(text)
  if (options?.piiTokens?.length) {
    text = redactKnownTokens(text, options.piiTokens)
  }
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

export function skillsArrayToString(skills: string[]): string {
  return skills.filter(Boolean).join(', ')
}

/** Build anonymous profile from parsed resume (PII fields discarded from display). */
export function buildAnonymousProfileFromParsed(
  parsed: ParsedResume,
  overrides?: Partial<AnonymousResumeProfile>,
): AnonymousResumeProfile {
  const piiTokens = overrides?.piiTokens ?? collectPiiTokensFromParsed(parsed)
  const redactedFullText =
    overrides?.redactedFullText ?? redactResumeForBlindReview(parsed.rawText, { piiTokens })

  const skills =
    overrides?.skills ??
    (parsed.skills.length > 0 ? skillsArrayToString(parsed.skills) : '')

  const summary = redactedFullText ? redactedFullText.slice(0, 600).trim() : undefined

  return {
    skills,
    experience: overrides?.experience ?? parsed.experience ?? '',
    education: overrides?.education ?? parsed.education ?? '',
    certifications: overrides?.certifications ?? parsed.certifications ?? undefined,
    position: overrides?.position ?? parsed.position ?? undefined,
    summary,
    redactedFullText,
    piiTokens,
    storagePath: overrides?.storagePath,
    parsedAt: new Date().toISOString(),
  }
}

/** Parse HR add-candidate cover letter format: "Skills: ...\nExperience: ..." */
export function parseCoverLetterProfile(coverLetter: string): Partial<AnonymousResumeProfile> {
  if (!coverLetter?.trim()) return {}

  const getField = (key: string): string => {
    const re = new RegExp(`${key}:\\s*([^\\n]+)`, 'i')
    const m = coverLetter.match(re)
    return m?.[1]?.trim() ?? ''
  }

  const skills = getField('Skills')
  const experience = getField('Experience')
  const education = getField('Education')
  const certifications = getField('Certifications')

  if (!skills && !experience && !education) return {}

  return {
    skills,
    experience,
    education,
    certifications: certifications || undefined,
    parsedAt: undefined,
  }
}

export function mergeResumeProfile(
  stored: AnonymousResumeProfile | null | undefined,
  coverLetter: string,
): AnonymousResumeProfile | null {
  if (stored?.skills || stored?.experience || stored?.education || stored?.redactedFullText) {
    return stored
  }
  const fromLetter = parseCoverLetterProfile(coverLetter)
  if (!fromLetter.skills && !fromLetter.experience && !fromLetter.education) {
    return stored ?? null
  }
  return {
    skills: fromLetter.skills ?? '',
    experience: fromLetter.experience ?? '',
    education: fromLetter.education ?? '',
    certifications: fromLetter.certifications,
    parsedAt: stored?.parsedAt,
    summary: stored?.summary,
    position: stored?.position,
    redactedFullText: stored?.redactedFullText,
    piiTokens: stored?.piiTokens,
    storagePath: stored?.storagePath,
  }
}

export function hasAnonymousProfile(profile: AnonymousResumeProfile | null | undefined): boolean {
  if (!profile) return false
  return Boolean(
    profile.skills?.trim() ||
      profile.experience?.trim() ||
      profile.education?.trim() ||
      profile.summary?.trim() ||
      profile.redactedFullText?.trim(),
  )
}

/** Tokens from application form fields (when resume was not parsed). */
export function collectPiiTokensFromApplication(application: {
  firstName: string
  lastName: string
  email: string
  phone?: string
  location?: string
  linkedin?: string | null
}): string[] {
  const tokens = new Set<string>()
  const add = (v: string | null | undefined) => {
    const t = v?.trim()
    if (t && t.length > 1) tokens.add(t)
  }
  add(application.firstName)
  add(application.lastName)
  if (application.firstName?.trim() && application.lastName?.trim()) {
    add(`${application.firstName.trim()} ${application.lastName.trim()}`)
  }
  add(application.email)
  add(application.phone)
  add(application.location)
  add(application.linkedin ?? undefined)
  const local = application.email?.split('@')[0]
  if (local && local.includes('.')) {
    local.split(/[._-]+/).forEach((p) => add(p))
  }
  return Array.from(tokens)
}

export function buildSealedIdentity(application: {
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
  coverLetter?: string
  linkedin?: string | null
  portfolio?: string | null
  resumeFileName?: string | null
  resumeProfile?: AnonymousResumeProfile | null
}): SealedIdentity {
  const fromForm = collectPiiTokensFromApplication(application)
  const fromResume = application.resumeProfile?.piiTokens ?? []
  const piiTokens = Array.from(new Set([...fromResume, ...fromForm]))

  return {
    firstName: application.firstName.trim(),
    lastName: application.lastName.trim(),
    email: application.email.trim(),
    phone: application.phone.trim(),
    location: application.location.trim(),
    linkedin: application.linkedin ?? null,
    portfolio: application.portfolio ?? null,
    coverLetter: application.coverLetter?.trim() || undefined,
    resumeFileName: application.resumeFileName?.trim() || null,
    piiTokens: piiTokens.length ? piiTokens : undefined,
  }
}

/** Strip tokens and sealed payload from profile returned to blind UI. */
export function sanitizeProfileForBlindView(
  profile: AnonymousResumeProfile | null | undefined,
): AnonymousResumeProfile | null | undefined {
  if (!profile) return profile
  const { piiTokens: _t, sealedIdentity: _s, ...safe } = profile
  return safe
}

/** Redact free-text application fields (cover letter, notes) for blind review. */
export function redactApplicationText(
  text: string,
  piiTokens?: string[],
): string {
  if (!text?.trim()) return ''
  return redactResumeForBlindReview(text, { piiTokens })
}

export type BlindMaskableApplication = {
  isRevealed?: boolean
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
  coverLetter: string
  linkedin?: string | null
  portfolio?: string | null
  resumeFileName?: string | null
  resumeProfile?: AnonymousResumeProfile | null
}

/** Apply blind placeholders pre-reveal; restore sealed identity after reveal. */
export function applyBlindViewToApplication<T extends BlindMaskableApplication>(app: T): T {
  const sealed = app.resumeProfile?.sealedIdentity

  if (app.isRevealed) {
    if (!sealed) return app
    return {
      ...app,
      firstName: sealed.firstName || app.firstName,
      lastName: sealed.lastName || app.lastName,
      email: sealed.email || app.email,
      phone: sealed.phone || app.phone,
      location: sealed.location || app.location,
      linkedin: sealed.linkedin ?? app.linkedin,
      portfolio: sealed.portfolio ?? app.portfolio,
      coverLetter: sealed.coverLetter ?? app.coverLetter,
      resumeFileName: sealed.resumeFileName ?? app.resumeFileName,
      resumeProfile: app.resumeProfile
        ? { ...sanitizeProfileForBlindView(app.resumeProfile)!, piiTokens: sealed.piiTokens }
        : app.resumeProfile,
    }
  }

  const tokens = sealed?.piiTokens ?? app.resumeProfile?.piiTokens
  const blindCover =
    app.resumeProfile?.redactedFullText?.trim() ||
    redactApplicationText(app.coverLetter, tokens)

  return {
    ...app,
    firstName: BLIND_FIRST_NAME,
    lastName: BLIND_LAST_NAME,
    email: BLIND_EMAIL,
    phone: BLIND_PHONE,
    location: BLIND_LOCATION,
    linkedin: null,
    portfolio: null,
    coverLetter: blindCover,
    resumeFileName: app.resumeFileName ? BLIND_RESUME_FILENAME : app.resumeFileName,
    resumeProfile: sanitizeProfileForBlindView(app.resumeProfile) ?? app.resumeProfile,
  }
}

/** Attach sealed identity and remove public pii tokens from profile before persistence. */
export function sealResumeProfileForStorage(
  profile: AnonymousResumeProfile,
  sealed: SealedIdentity,
): AnonymousResumeProfile {
  const { piiTokens, ...rest } = profile
  return {
    ...rest,
    sealedIdentity: {
      ...sealed,
      piiTokens: piiTokens ?? sealed.piiTokens,
    },
  }
}
