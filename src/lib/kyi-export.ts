import {
  getCompanyInvestors,
  getLeads,
  KYI_SIGNAL_LABELS,
  type KYILead,
  type KYIInvestor,
} from '@/lib/kyi-api'

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(filename: string, rows: string[][]): void {
  const header = rows[0]
  const body = rows.slice(1).map((r) => r.map(csvEscape).join(','))
  const csv = [header.map(csvEscape).join(','), ...body].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function signalLabels(inv: KYIInvestor): string {
  const snap = inv.lead_snapshot
  if (!snap?.top_signals?.length) return ''
  return snap.top_signals
    .map((k) => KYI_SIGNAL_LABELS[k]?.label ?? k)
    .join('; ')
}

export async function exportTargetedInvestorsCsv(companyId: number, companyName: string): Promise<void> {
  const investors = await getCompanyInvestors(companyId, { segmentTypes: ['targeted_investor'] })
  const rows: string[][] = [
    [
      'Name',
      'Firm',
      'Title',
      'Location',
      'Email',
      'Phone',
      'Outreach status',
      'Fit %',
      'Signals',
      'Source lead id',
      'Notes',
    ],
  ]
  for (const inv of investors) {
    rows.push([
      inv.full_name,
      inv.firm ?? '',
      inv.title ?? '',
      inv.location ?? '',
      inv.email ?? '',
      inv.phone ?? '',
      inv.outreach_status ?? 'new',
      inv.lead_snapshot?.fit_percent != null ? String(inv.lead_snapshot.fit_percent) : '',
      signalLabels(inv),
      inv.source_lead_id != null ? String(inv.source_lead_id) : '',
      inv.notes ?? '',
    ])
  }
  const safe = companyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'company'
  downloadCsv(`kyi-targeted-${safe}-${companyId}.csv`, rows)
}

export async function exportLocalizedLeadsCsv(
  companyId: number,
  companyName: string,
  leads: KYILead[],
): Promise<void> {
  const rows: string[][] = [
    ['Name', 'Entity type', 'City', 'State', 'Fit %', 'Raw score', 'Tags', 'Lead id'],
  ]
  for (const l of leads) {
    rows.push([
      l.display_name,
      l.entity_type,
      l.city ?? '',
      l.state ?? '',
      String(l.fit_percent),
      String(l.raw_score),
      (l.tags ?? []).join('; '),
      String(l.id),
    ])
  }
  const safe = companyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'company'
  downloadCsv(`kyi-leads-${safe}-${companyId}.csv`, rows)
}

export async function exportLocalizedLeadsCsvFromApi(
  companyId: number,
  companyName: string,
  opts?: Parameters<typeof getLeads>[1],
): Promise<void> {
  const res = await getLeads(companyId, { ...opts, thinning: 'all' })
  await exportLocalizedLeadsCsv(companyId, companyName, res.leads)
}
