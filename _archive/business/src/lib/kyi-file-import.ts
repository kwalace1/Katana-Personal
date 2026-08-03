/**
 * KYI CSV/XLSX import: column detection, validation, normalization, Supabase inserts.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getOrganizationId } from '@/lib/auth-helpers'
import {
  PLATFORM_CLIENT_ID,
  createInvestor,
  KYI_SEGMENT_PERSONAL_NETWORK,
} from '@/lib/kyi-api'
import type { ParsedSheet } from '@/lib/file-parse-utils'
import { rowToRecord } from '@/lib/file-parse-utils'

export type KyiImportTarget = 'leads' | 'investors' | 'northstar' | 'personal_network'

export interface KyiColumnMapping {
  /** DB / logical field → header index in sheet (or -1 if unused) */
  display_name: number
  first_name?: number
  last_name?: number
  email?: number
  phone?: number
  city?: number
  state?: number
  zip_code?: number
  firm?: number
  title?: number
  industry?: number
  location?: number
  notes?: number
  profile_url?: number
}

const HEADER_ALIASES: Record<keyof KyiColumnMapping, string[]> = {
  display_name: ['display_name', 'name', 'full_name', 'fullname', 'investor', 'person', 'contact'],
  first_name: ['first_name', 'firstname', 'fname', 'given'],
  last_name: ['last_name', 'lastname', 'lname', 'surname', 'family'],
  email: ['email', 'e-mail', 'mail'],
  phone: ['phone', 'tel', 'mobile', 'cell'],
  city: ['city', 'town'],
  state: ['state', 'province', 'region', 'st'],
  zip_code: ['zip', 'zip_code', 'postal', 'postcode'],
  firm: ['firm', 'company', 'organization', 'org', 'employer', 'company_name'],
  title: ['title', 'role', 'position', 'job_title'],
  industry: ['industry', 'sector'],
  location: ['location', 'address', 'metro'],
  notes: ['notes', 'comments', 'description'],
  profile_url: [
    'profile_url',
    'profile',
    'linkedin',
    'linkedin_url',
    'linkedin_profile',
    'url',
    'website',
  ],
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

/** Auto-detect column indices from header row. */
export function detectKyiMapping(headers: string[]): KyiColumnMapping {
  const normalized = headers.map(normHeader)
  const findIdx = (aliases: string[]): number => {
    for (let i = 0; i < normalized.length; i++) {
      const h = normalized[i]
      if (aliases.some((a) => h === a || h.includes(a))) return i
    }
    return -1
  }

  const keys = Object.keys(HEADER_ALIASES) as (keyof KyiColumnMapping)[]
  const acc: Partial<KyiColumnMapping> = {}
  for (const key of keys) {
    const idx = findIdx(HEADER_ALIASES[key].map(normHeader))
    acc[key] = idx
  }
  const mapping = acc as KyiColumnMapping

  if (mapping.display_name < 0) {
    const fn = mapping.first_name ?? -1
    const ln = mapping.last_name ?? -1
    if (fn >= 0 || ln >= 0) {
      mapping.display_name = -2 // synthetic: combine first+last
    } else if (normalized.length > 0) {
      mapping.display_name = 0
    }
  }
  return mapping
}

function cell(row: string[], idx: number): string {
  if (idx < 0) return ''
  return (row[idx] ?? '').trim()
}

function buildDisplayName(row: string[], m: KyiColumnMapping): string {
  if (m.display_name === -2) {
    const a = cell(row, m.first_name ?? -1)
    const b = cell(row, m.last_name ?? -1)
    return [a, b].filter(Boolean).join(' ').trim()
  }
  if (m.display_name >= 0) return cell(row, m.display_name)
  return ''
}

function buildLocation(row: string[], m: KyiColumnMapping): string {
  const explicit = cell(row, m.location ?? -1)
  if (explicit) return explicit
  const city = cell(row, m.city ?? -1)
  const state = cell(row, m.state ?? -1)
  return [city, state].filter(Boolean).join(', ')
}

export interface KyiImportRowIssue {
  rowIndex: number
  message: string
}

export interface KyiImportPreview {
  validRows: number
  issues: KyiImportRowIssue[]
  sample: Record<string, string>[]
}

export function previewKyiImport(sheet: ParsedSheet, m: KyiColumnMapping, maxSample = 5): KyiImportPreview {
  const issues: KyiImportRowIssue[] = []
  const sample: Record<string, string>[] = []
  let validRows = 0

  sheet.rows.forEach((row, i) => {
    const display = buildDisplayName(row, m)
    if (!display) {
      issues.push({ rowIndex: i + 2, message: 'Missing name / display_name' })
      return
    }
    validRows++
    if (sample.length < maxSample) {
      const rec = rowToRecord(sheet.headers, row)
      rec._display_name = display
      sample.push(rec)
    }
  })

  return { validRows, issues, sample }
}

export interface KyiImportExecuteOptions {
  companyId: number
  target: KyiImportTarget
  sheet: ParsedSheet
  mapping: KyiColumnMapping
  dataCategorySlug?: string | null
  /** Personal network: contribute public identity to shared ecosystem (default true) */
  contributeToEcosystem?: boolean
}

export interface KyiImportExecuteResult {
  inserted: number
  failed: number
  contributed: number
  errors: string[]
}

export async function executeKyiImport(opts: KyiImportExecuteOptions): Promise<KyiImportExecuteResult> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }

  const { companyId, target, sheet, mapping, dataCategorySlug, contributeToEcosystem } = opts
  let inserted = 0
  let failed = 0
  let contributed = 0
  const errors: string[] = []

  if (target === 'northstar') {
    const { importNorthstarInvestorRow } = await import('@/lib/kyi-northstar')
    const headers = sheet.headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
    for (let i = 0; i < sheet.rows.length; i++) {
      const row = sheet.rows[i]
      const rec: Record<string, string> = {}
      headers.forEach((h, idx) => {
        if (h) rec[h] = (row[idx] ?? '').trim()
      })
      const name = rec.name || rec.display_name || rec.full_name
      if (!name) {
        failed++
        continue
      }
      try {
        await importNorthstarInvestorRow(companyId, rec)
        inserted++
      } catch (e) {
        failed++
        errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'insert failed'}`)
      }
    }
    return { inserted, failed, contributed: 0, errors: errors.slice(0, 20) }
  }

  if (target === 'investors' || target === 'personal_network') {
    const isPersonal = target === 'personal_network'
    const contribute = isPersonal ? contributeToEcosystem !== false : true
    for (let i = 0; i < sheet.rows.length; i++) {
      const row = sheet.rows[i]
      const full_name = buildDisplayName(row, mapping)
      if (!full_name) {
        failed++
        continue
      }
      const notesRaw = cell(row, mapping.notes ?? -1)
      const notes = isPersonal
        ? [notesRaw, 'Source: personal network upload'].filter(Boolean).join('\n')
        : notesRaw || undefined
      try {
        const created = await createInvestor({
          company_id: companyId,
          full_name,
          email: cell(row, mapping.email ?? -1) || undefined,
          phone: cell(row, mapping.phone ?? -1) || undefined,
          location: buildLocation(row, mapping) || undefined,
          industry: cell(row, mapping.industry ?? -1) || undefined,
          firm: cell(row, mapping.firm ?? -1) || undefined,
          title: cell(row, mapping.title ?? -1) || undefined,
          profile_url: cell(row, mapping.profile_url ?? -1) || undefined,
          notes,
          user_role_classification: 'investor',
          admin_override_investor_role: true,
          segment_type: isPersonal ? KYI_SEGMENT_PERSONAL_NETWORK : 'current_investor',
          contribute_to_ecosystem: contribute,
        })
        inserted++
        if (created.global_investor_id != null) contributed++
      } catch (e) {
        failed++
        errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'insert failed'}`)
      }
    }
    return { inserted, failed, contributed, errors: errors.slice(0, 20) }
  }

  // leads → kyi_investor_leads (org-scoped; null-org rows are platform catalog only)
  const now = new Date().toISOString()
  const orgId = await getOrganizationId()
  let needsGeocodeCount = 0

  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]
    const display_name = buildDisplayName(row, mapping)
    if (!display_name) {
      failed++
      continue
    }
    const payload: Record<string, unknown> = {
      // client_id still required by NOT NULL FK; tenancy is via organization_id
      client_id: PLATFORM_CLIENT_ID,
      organization_id: orgId,
      entity_type: 'person',
      display_name,
      city: cell(row, mapping.city ?? -1) || null,
      state: cell(row, mapping.state ?? -1) || null,
      zip_code: cell(row, mapping.zip_code ?? -1) || null,
      raw_score: 0,
      created_at: now,
      updated_at: now,
    }
    if (dataCategorySlug?.trim()) {
      payload.tags = [dataCategorySlug.trim()]
    }

    const { error } = await supabase.from('kyi_investor_leads').insert(payload)
    if (error) {
      failed++
      errors.push(`Row ${i + 2}: ${error.message}`)
    } else {
      inserted++
      const city = cell(row, mapping.city ?? -1)
      const state = cell(row, mapping.state ?? -1)
      const zip = cell(row, mapping.zip_code ?? -1)
      if (city || state || zip) needsGeocodeCount++
    }
  }

  if (inserted > 0) {
    try {
      const { notifyKyiLeadsAddedToPool } = await import('@/lib/notification-modules')
      void notifyKyiLeadsAddedToPool({
        count: inserted,
        needsGeocodeCount: needsGeocodeCount > 0 ? needsGeocodeCount : null,
        importBatchKey: `kyi:manual:${now}`,
      })
    } catch (notifyErr) {
      console.warn('[kyi-file-import] Lead pool notification skipped:', notifyErr)
    }
  }

  return { inserted, failed, contributed: 0, errors: errors.slice(0, 20) }
}
